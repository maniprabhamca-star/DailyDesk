#!/usr/bin/env bash
#
# Nightly Postgres backup for DiemDesk: dump → verify → copy off the box.
#
# The database is the only thing here that cannot be rebuilt. The code is on
# GitHub, the VPS can be reprovisioned in an afternoon, Stripe holds the payment
# history — but users, notes, expenses, vault metadata and MCP tokens exist in
# exactly one place, on one disk. Until this runs, the whole product is one
# failed volume away from starting again with nothing.
#
# Three things this deliberately does that a one-line pg_dump in cron does not:
#
#   1. It VERIFIES the dump before trusting it. A backup nobody has ever read
#      back is a hypothesis. pg_restore --list parses the archive's table of
#      contents, so a truncated or half-written file fails here rather than on
#      the day it is needed.
#   2. It gets the copy OFF THE MACHINE. A dump beside the database it protects
#      survives a bad migration and nothing else.
#   3. It SAYS SO when it fails. A silent backup that stopped working in March
#      is worse than no backup, because you stop worrying about it.
#
# Install (as root on the VPS):
#   cp /var/www/dailydesk/backend/scripts/backup-db.sh /usr/local/bin/
#   chmod 750 /usr/local/bin/backup-db.sh
#   # secrets, root-only:
#   install -m 600 /dev/null /etc/diemdesk-backup.env && editor /etc/diemdesk-backup.env
#   # nightly at 03:20, log where the status page can see the outcome:
#   ( crontab -l 2>/dev/null; echo '20 3 * * * /usr/local/bin/backup-db.sh >> /var/log/diemdesk-backup.log 2>&1' ) | crontab -
#
# /etc/diemdesk-backup.env:
#   PGDATABASE=dailydesk
#   PGUSER=dailydesk
#   PGPASSWORD=...
#   R2_BUCKET=diemdesk-backups
#   R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
#   R2_ACCESS_KEY_ID=...
#   R2_SECRET_ACCESS_KEY=...
#   # optional: client-side encryption before upload. If you set this, LOSING IT
#   # LOSES THE BACKUP — there is no recovery path. Left unset, the copy relies
#   # on R2's own at-rest encryption and the bucket being private, which is the
#   # right default for most people.
#   # BACKUP_PASSPHRASE=...
#
# Restore is documented in docs/runbooks/restore-database.md. Read it before you
# need it, not during.

set -Eeuo pipefail

ENV_FILE="${BACKUP_ENV_FILE:-/etc/diemdesk-backup.env}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
KEEP_LOCAL="${KEEP_LOCAL:-14}"
ALERT_TO="${OWNER_EMAILS:-maniprabhamca@gmail.com}"
SENDMAIL="${SENDMAIL_PATH:-/usr/sbin/sendmail}"

# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && set -a && . "$ENV_FILE" && set +a

DB="${PGDATABASE:-dailydesk}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
# The name matters: the /dashboard/system backup check looks for a file starting
# with the database name, because this box is shared with another project whose
# unrelated dump in the same directory was once read as evidence that we had a
# backup of ours.
OUT="${BACKUP_DIR}/${DB}-${STAMP}.dump"

# Every exit path that is not success reports itself. `set -e` plus this trap
# means a failure in any command below becomes an email, rather than a line in a
# log file nobody opens.
fail() {
  local line=$1 code=$2
  local msg="DiemDesk backup FAILED on $(hostname) at line ${line} (exit ${code}).
Database: ${DB}
Intended file: ${OUT}
Log: /var/log/diemdesk-backup.log

The database is currently unbacked or the last good copy is older than it looks.
Check the log and re-run: /usr/local/bin/backup-db.sh"
  echo "$msg" >&2
  if [ -x "$SENDMAIL" ]; then
    printf 'To: %s\nFrom: %s\nSubject: [DiemDesk] Database backup FAILED\n\n%s\n' \
      "$ALERT_TO" "$ALERT_TO" "$msg" | "$SENDMAIL" -t || true
  fi
  exit "$code"
}
trap 'fail "$LINENO" "$?"' ERR

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# ── 1. dump ─────────────────────────────────────────────────────────────────
# Custom format (-Fc): compressed already, and restorable table-by-table, which
# is what you actually want at 2am when one table is wrong rather than all of
# them. Plain SQL is only easier until the first time you need half of it.
pg_dump -Fc --no-owner --no-privileges -f "$OUT" "$DB"
chmod 600 "$OUT"

# ── 2. verify ───────────────────────────────────────────────────────────────
# Parse the archive back. This is cheap and it is the whole difference between a
# backup and a file.
if ! pg_restore --list "$OUT" > /dev/null 2>&1; then
  rm -f "$OUT"
  echo "dump failed verification and was deleted rather than kept as false comfort" >&2
  exit 1
fi

TABLES=$(pg_restore --list "$OUT" | grep -c 'TABLE DATA' || true)
SIZE=$(du -h "$OUT" | cut -f1)
# A dump that suddenly contains no tables is a successful backup of nothing.
if [ "$TABLES" -lt 5 ]; then
  rm -f "$OUT"
  echo "dump contained only ${TABLES} tables, which is not this database" >&2
  exit 1
fi

UPLOAD="$OUT"
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -in "$OUT" -out "${OUT}.enc" -pass env:BACKUP_PASSPHRASE
  chmod 600 "${OUT}.enc"
  UPLOAD="${OUT}.enc"
fi

# ── 3. off the box ──────────────────────────────────────────────────────────
# rclone with inline flags rather than an rclone.conf: the credentials stay in
# one root-only env file instead of being copied into a second one.
if [ -n "${R2_BUCKET:-}" ] && [ -n "${R2_ENDPOINT:-}" ]; then
  rclone copy "$UPLOAD" ":s3:${R2_BUCKET}/postgres/" \
    --s3-provider=Cloudflare \
    --s3-access-key-id="$R2_ACCESS_KEY_ID" \
    --s3-secret-access-key="$R2_SECRET_ACCESS_KEY" \
    --s3-endpoint="$R2_ENDPOINT" \
    --s3-no-check-bucket \
    --retries 3 --low-level-retries 10 --stats-log-level NOTICE

  # Trust nothing that has not been read back. rclone exiting 0 is a claim; the
  # object appearing in a listing at the right size is evidence.
  REMOTE_SIZE=$(rclone size ":s3:${R2_BUCKET}/postgres/$(basename "$UPLOAD")" \
    --s3-provider=Cloudflare \
    --s3-access-key-id="$R2_ACCESS_KEY_ID" \
    --s3-secret-access-key="$R2_SECRET_ACCESS_KEY" \
    --s3-endpoint="$R2_ENDPOINT" \
    --json 2>/dev/null | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')
  LOCAL_SIZE=$(stat -c %s "$UPLOAD")
  if [ "${REMOTE_SIZE:-0}" != "$LOCAL_SIZE" ]; then
    echo "uploaded object is ${REMOTE_SIZE:-missing} bytes, local is ${LOCAL_SIZE}" >&2
    exit 1
  fi
  [ "$UPLOAD" != "$OUT" ] && rm -f "$UPLOAD"
else
  echo "WARNING: R2 is not configured — this backup is on the same disk as the database it protects." >&2
fi

# ── 4. retention ────────────────────────────────────────────────────────────
# Local copies are for fast restores; R2 holds the history. Set a lifecycle rule
# on the bucket for the remote side rather than deleting objects from here — a
# script with delete rights on its own backups is one bug away from having none.
ls -1t "${BACKUP_DIR}/${DB}-"*.dump 2>/dev/null | tail -n +$((KEEP_LOCAL + 1)) | xargs -r rm -f

echo "$(date -u +%FT%TZ) backup ok: $(basename "$OUT") · ${SIZE} · ${TABLES} tables · r2=${R2_BUCKET:-none}"
