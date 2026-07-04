#!/usr/bin/env bash
# DiemDesk server monitor + capacity/growth predictor + push alerts.
#
# Modes:
#   dd-monitor infra    -> sample host/API/DB health, alert on threshold breaches (run every 5 min)
#   dd-monitor growth   -> snapshot users/DAU, project days-to-capacity, daily digest (run daily)
#   dd-monitor test     -> send a test push so you can confirm notifications work
#
# Alerts are pushed to ntfy.sh (free, no account — you just subscribe to the
# topic on your phone). Config (topic + optional overrides) lives in
# /etc/dd-monitor.conf so the secret-ish topic stays out of git.
#
# Design goals: zero heavy deps (bash + awk + curl + psql + redis-cli), never
# crash the box, dedupe alerts with a cooldown, and warn BEFORE thresholds are
# hit by projecting the growth trend.
set -uo pipefail

# ---- config (overridable via /etc/dd-monitor.conf) -------------------------
NTFY_URL="https://ntfy.sh"
NTFY_TOPIC=""                     # REQUIRED — set in /etc/dd-monitor.conf
ENV_FILE="/var/www/dailydesk/backend/.env"
STATE_DIR="/var/lib/dd-monitor"
INFRA_CSV="/var/log/dd-metrics.csv"
DAILY_CSV="/var/log/dd-daily.csv"
STATUS_JSON="/var/log/dd-status.json"     # latest infra sample (admin dashboard reads this)
GROWTH_JSON="/var/log/dd-growth.json"     # latest growth snapshot + projection
API_HEALTH="http://127.0.0.1:4000/health"
COOLDOWN=21600                    # 6h between repeat alerts for the same key

# Infra thresholds (WARN / CRIT)
LOAD_RATIO_WARN=0.625; LOAD_RATIO_CRIT=0.85    # load1 / cores  (0.625 = 2.5 of 4 cores)
MEM_WARN=70;  MEM_CRIT=88                       # % RAM used
DISK_WARN=80; DISK_CRIT=92                       # % disk used
P95_WARN=300; P95_CRIT=800                       # API p95 latency ms
PGCONN_WARN=0.70; PGCONN_CRIT=0.90               # active / max_connections

# Capacity milestones (DAU) + how many days of lead-time you want before a breach
VERTICAL_AT_DAU=40000      # bump the box (8 cores + more workers) before ~50k
HORIZONTAL_AT_DAU=90000    # multi-server + managed DB before ~100k
LEAD_DAYS=7                # warn this many days before the projected crossing

# ---- Email alerts (optional). SMTP works with any provider: Gmail app-password,
#      Mailgun, SendGrid, Amazon SES, etc. Set these in /etc/dd-monitor.conf.
SMTP_HOST=""; SMTP_PORT=465; SMTP_USER=""; SMTP_PASS=""
EMAIL_FROM="alerts@diemdesk.com"
ALERT_EMAILS=""            # comma-separated recipient list (the "email list")

# ---- SMS alerts (optional, via Twilio). By default SMS fires on CRITICAL only,
#      so you're not texted for every warning. Set SMS_ON_CRIT_ONLY=0 to get all.
TWILIO_SID=""; TWILIO_TOKEN=""; TWILIO_FROM=""
ALERT_SMS=""               # comma-separated E.164 numbers, e.g. +15551234567
SMS_ON_CRIT_ONLY=1

[ -f /etc/dd-monitor.conf ] && . /etc/dd-monitor.conf

mkdir -p "$STATE_DIR"
MODE="${1:-infra}"

# ---- helpers ---------------------------------------------------------------
gt() { awk -v a="$1" -v b="$2" 'BEGIN{exit !(a+0>b+0)}'; }   # a > b ?

# ---- extra notification channels (optional, config-driven) -----------------
# Email via SMTP (curl speaks SMTP — no MTA/extra package needed).
# Recipients come from the admin-managed DB table (alert_recipients); if that's
# empty/unavailable, fall back to ALERT_EMAILS in the config.
send_email() { # subject body
  [ -z "${SMTP_HOST:-}" ] && return 0
  local recipients
  recipients=$(pg "select string_agg(email, ',') from alert_recipients where active=true" 2>/dev/null)
  [ -z "$recipients" ] && recipients="${ALERT_EMAILS:-}"
  [ -z "$recipients" ] && return 0
  local subject="$1" body="$2" to
  for to in ${recipients//,/ }; do
    printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n' \
      "${EMAIL_FROM}" "$to" "[DiemDesk] $subject" "$body" \
    | curl -s -m 15 --ssl-reqd --url "smtps://${SMTP_HOST}:${SMTP_PORT:-465}" \
        --mail-from "${EMAIL_FROM}" --mail-rcpt "$to" \
        --user "${SMTP_USER}:${SMTP_PASS}" -T - >/dev/null 2>&1
  done
}
# SMS via Twilio.
send_sms() { # message
  if [ -z "${ALERT_SMS:-}" ] || [ -z "${TWILIO_SID:-}" ]; then return 0; fi
  local msg="$1" num
  for num in ${ALERT_SMS//,/ }; do
    curl -s -m 15 -X POST "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json" \
      --data-urlencode "To=${num}" --data-urlencode "From=${TWILIO_FROM}" \
      --data-urlencode "Body=${msg}" -u "${TWILIO_SID}:${TWILIO_TOKEN}" >/dev/null 2>&1
  done
}

# Fan out an alert to phone push (ntfy) + email + SMS, with per-key cooldown so
# we don't spam. Email goes on every alert; SMS on CRITICAL only (by default).
notify() { # key priority tags title message
  local key="$1" prio="$2" tags="$3" title="$4" msg="$5"
  local now last f="$STATE_DIR/alert_$1.ts"
  now=$(date +%s); last=0; [ -f "$f" ] && last=$(cat "$f" 2>/dev/null || echo 0)
  if [ $((now - last)) -lt "$COOLDOWN" ] && [ "$prio" != "max" ]; then return; fi

  # 1) phone push (ntfy)
  if [ -n "${NTFY_TOPIC:-}" ]; then
    curl -s -m 10 -H "Title: $title" -H "Priority: $prio" -H "Tags: $tags" \
      -d "$msg" "$NTFY_URL/$NTFY_TOPIC" >/dev/null 2>&1
  fi
  # 2) email — every alert
  send_email "$title" "$msg"
  # 3) SMS — critical only (unless SMS_ON_CRIT_ONLY=0)
  if [ "$prio" = "crit" ] || [ "${SMS_ON_CRIT_ONLY:-1}" = "0" ]; then
    send_sms "$title: $msg"
  fi

  echo "$now" > "$f"
  echo "[dd-monitor] alerted: $title — $msg"
}
clear_alert() { rm -f "$STATE_DIR/alert_$1.ts" 2>/dev/null; }  # reset cooldown when healthy

# DB query helper (reads creds from backend .env)
pg() {
  local u p n
  u=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d= -f2-)
  p=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
  n=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d= -f2-)
  PGPASSWORD="$p" psql -U "$u" -d "$n" -h 127.0.0.1 -tAc "$1" 2>/dev/null
}

# ---- infra mode ------------------------------------------------------------
infra() {
  local cores load1 loadratio mem_used mem_total mem_pct disk_pct
  cores=$(nproc)
  load1=$(awk '{print $1}' /proc/loadavg)
  loadratio=$(awk -v l="$load1" -v c="$cores" 'BEGIN{printf "%.3f", l/c}')
  read -r mem_total mem_used < <(free -m | awk '/^Mem:/{print $2, $3}')
  mem_pct=$(awk -v u="$mem_used" -v t="$mem_total" 'BEGIN{printf "%.1f", 100*u/t}')
  disk_pct=$(df -P / | awk 'NR==2{gsub("%","",$5); print $5}')

  # API p95 latency: 20 quick health probes, take the 95th percentile (ms)
  local times=() t p95
  for _ in $(seq 1 20); do
    t=$(curl -s -o /dev/null -m 5 -w '%{time_total}' "$API_HEALTH" 2>/dev/null || echo 5)
    times+=("$(awk -v x="$t" 'BEGIN{printf "%.0f", x*1000}')")
  done
  p95=$(printf '%s\n' "${times[@]}" | sort -n | awk '{a[NR]=$0} END{print a[int(NR*0.95+0.999)]}')

  # Postgres connections vs max
  local pgc pgmax pgratio
  pgc=$(pg "select count(*) from pg_stat_activity"); pgc=${pgc:-0}
  pgmax=$(pg "show max_connections"); pgmax=${pgmax:-100}
  pgratio=$(awk -v a="$pgc" -v b="$pgmax" 'BEGIN{printf "%.3f", (b>0)?a/b:0}')

  local redis_ok; redis_ok=$(redis-cli ping 2>/dev/null || echo DOWN)

  # log a row for history/trends
  echo "$(date -u +%FT%TZ),$loadratio,$mem_pct,$disk_pct,$p95,$pgc,$pgmax,$redis_ok" >> "$INFRA_CSV"

  # machine-readable snapshot for the admin dashboard (one file = current state)
  cat > "$STATUS_JSON" <<JSON
{"ts":"$(date -u +%FT%TZ)","load1":$load1,"cores":$cores,"load_ratio":$loadratio,"mem_pct":$mem_pct,"disk_pct":$disk_pct,"api_p95_ms":$p95,"pg_conn":$pgc,"pg_max":$pgmax,"redis":"$redis_ok","thresholds":{"load_ratio_warn":$LOAD_RATIO_WARN,"load_ratio_crit":$LOAD_RATIO_CRIT,"mem_warn":$MEM_WARN,"mem_crit":$MEM_CRIT,"disk_warn":$DISK_WARN,"disk_crit":$DISK_CRIT,"p95_warn":$P95_WARN,"p95_crit":$P95_CRIT,"pgconn_warn":$PGCONN_WARN,"pgconn_crit":$PGCONN_CRIT}}
JSON

  # evaluate thresholds -> alerts (CRIT beats WARN; clear cooldown when healthy)
  if   gt "$loadratio" "$LOAD_RATIO_CRIT"; then notify load crit rotating_light "DiemDesk CPU CRITICAL" "load ${load1} on ${cores} cores (ratio ${loadratio}). Scale the box NOW."
  elif gt "$loadratio" "$LOAD_RATIO_WARN"; then notify load high warning "DiemDesk CPU high" "load ${load1}/${cores} cores (ratio ${loadratio}). Approaching capacity — plan the vertical bump."
  else clear_alert load; fi

  if   gt "$mem_pct" "$MEM_CRIT"; then notify mem crit rotating_light "DiemDesk RAM CRITICAL" "RAM ${mem_pct}% used."
  elif gt "$mem_pct" "$MEM_WARN"; then notify mem high warning "DiemDesk RAM high" "RAM ${mem_pct}% used."
  else clear_alert mem; fi

  if   gt "$disk_pct" "$DISK_CRIT"; then notify disk crit rotating_light "DiemDesk disk CRITICAL" "disk ${disk_pct}% full."
  elif gt "$disk_pct" "$DISK_WARN"; then notify disk high warning "DiemDesk disk high" "disk ${disk_pct}% full."
  else clear_alert disk; fi

  if   gt "$p95" "$P95_CRIT"; then notify lat crit rotating_light "DiemDesk API latency CRITICAL" "health p95 ${p95}ms."
  elif gt "$p95" "$P95_WARN"; then notify lat high warning "DiemDesk API latency high" "health p95 ${p95}ms — investigate / scale."
  else clear_alert lat; fi

  if   gt "$pgratio" "$PGCONN_CRIT"; then notify pg crit rotating_light "DiemDesk Postgres conns CRITICAL" "${pgc}/${pgmax} connections. Add pgbouncer / managed DB."
  elif gt "$pgratio" "$PGCONN_WARN"; then notify pg high warning "DiemDesk Postgres conns high" "${pgc}/${pgmax} connections."
  else clear_alert pg; fi

  [ "$redis_ok" != "PONG" ] && notify redis crit rotating_light "DiemDesk Redis DOWN" "redis-cli ping => ${redis_ok}. Rate limiter is failing open."

  echo "OK load=${loadratio} mem=${mem_pct}% disk=${disk_pct}% p95=${p95}ms pg=${pgc}/${pgmax} redis=${redis_ok}"
}

# ---- growth mode -----------------------------------------------------------
growth() {
  local today total dau signups pro
  today=$(date -u +%F)
  total=$(pg "select count(*) from users"); total=${total:-0}
  pro=$(pg "select count(*) from users where plan='pro'"); pro=${pro:-0}
  signups=$(pg "select count(*) from users where created_at > now() - interval '24 hours'"); signups=${signups:-0}
  dau=$(pg "select count(distinct coalesce(user_id::text, ip_address::text)) from user_events where created_at > now() - interval '24 hours'"); dau=${dau:-0}

  # one snapshot row per day (idempotent)
  touch "$DAILY_CSV"
  if ! grep -q "^$today," "$DAILY_CSV"; then
    echo "$today,$total,$dau,$signups,$pro" >> "$DAILY_CSV"
  fi

  # project DAU: linear fit over the trailing history (needs >=2 days)
  local proj_msg="not enough history yet (collecting daily snapshots)"
  local ndays; ndays=$(wc -l < "$DAILY_CSV")
  if [ "$ndays" -ge 2 ]; then
    # slope = (dau_today - dau_first) / days_span ; project days to each milestone
    proj_msg=$(awk -F, -v vday="$VERTICAL_AT_DAU" -v hday="$HORIZONTAL_AT_DAU" -v lead="$LEAD_DAYS" '
      { d[NR]=$3; day[NR]=$1 }
      END{
        n=NR; first=d[1]; last=d[n];
        # days span from first to last row
        span=n-1; if(span<1) span=1;
        slope=(last-first)/span;   # DAU per day
        if(slope<=0){ print "flat/declining DAU (" last " today) — no scaling pressure"; exit }
        vdays=(vday-last)/slope; hdays=(hday-last)/slope;
        msg=sprintf("DAU %d, growing ~%.0f/day.", last, slope);
        if(vdays>0) msg=sprintf("%s ~%.0f days to %d (vertical bump).", msg, vdays, vday);
        if(hdays>0) msg=sprintf("%s ~%.0f days to %d (go multi-server).", msg, hdays, hday);
        print msg;
        # advance-warning flag consumed by the caller
        if(vdays>0 && vdays<=lead) print "WARN_VERTICAL " int(vdays);
        if(hdays>0 && hdays<=lead) print "WARN_HORIZONTAL " int(hdays);
      }' "$DAILY_CSV")
  fi

  # fire advance-warning pushes if the projection says a milestone is near
  if echo "$proj_msg" | grep -q "WARN_VERTICAL"; then
    local dleft; dleft=$(echo "$proj_msg" | awk '/WARN_VERTICAL/{print $2}')
    notify grow_v max chart_with_upwards_trend "DiemDesk: scale up soon" "Growth projects ~${dleft} days to the vertical-scale point (${VERTICAL_AT_DAU} DAU). Resize the box + add workers ahead of the peak."
  fi
  if echo "$proj_msg" | grep -q "WARN_HORIZONTAL"; then
    local dleft; dleft=$(echo "$proj_msg" | awk '/WARN_HORIZONTAL/{print $2}')
    notify grow_h max chart_with_upwards_trend "DiemDesk: go multi-server soon" "Growth projects ~${dleft} days to the horizontal-scale point (${HORIZONTAL_AT_DAU} DAU). Stand up a 2nd node + managed DB now."
  fi

  local clean; clean=$(echo "$proj_msg" | grep -v '^WARN_' | head -1); clean=${clean//\"/}

  # machine-readable growth snapshot for the admin dashboard
  cat > "$GROWTH_JSON" <<JSON
{"date":"$today","total_users":$total,"dau":$dau,"signups_24h":$signups,"pro":$pro,"projection":"$clean","milestones":{"vertical_at_dau":$VERTICAL_AT_DAU,"horizontal_at_dau":$HORIZONTAL_AT_DAU,"lead_days":$LEAD_DAYS}}
JSON
  # daily digest (always sent, low priority)
  notify digest_$today default bar_chart "DiemDesk daily: ${total} users, ${dau} DAU" \
    "Total ${total} (Pro ${pro}) · signups 24h ${signups} · DAU ${dau}. ${clean}"
  echo "growth: total=$total dau=$dau signups=$signups pro=$pro :: $clean"
}

case "$MODE" in
  infra)  infra ;;
  growth) growth ;;
  test)
    echo "Testing notification channels…"
    if [ -n "${NTFY_TOPIC:-}" ]; then
      curl -s -m 10 -H "Title: DiemDesk test alert" -H "Tags: white_check_mark" \
        -d "If you see this on your phone, ntfy alerts work. $(date)" "$NTFY_URL/$NTFY_TOPIC" >/dev/null \
        && echo "  ntfy: sent to $NTFY_TOPIC"
    else echo "  ntfy: (NTFY_TOPIC unset)"; fi
    send_email "Test alert" "If you got this email, DiemDesk email alerts work. $(date)"
    [ -n "${ALERT_EMAILS:-}" ] && echo "  email: attempted to $ALERT_EMAILS" || echo "  email: (not configured)"
    send_sms "DiemDesk test alert — SMS works. $(date)"
    [ -n "${ALERT_SMS:-}" ] && echo "  sms: attempted to $ALERT_SMS" || echo "  sms: (not configured)"
    ;;
  *) echo "usage: dd-monitor {infra|growth|test}"; exit 1 ;;
esac
