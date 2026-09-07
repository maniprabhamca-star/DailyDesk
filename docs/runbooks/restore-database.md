# Restoring the DiemDesk database

Read this before you need it. The worst time to work out a restore procedure is
while the thing is down.

Backups are produced by `backend/scripts/backup-db.sh` — nightly at 03:20 UTC,
custom-format `pg_dump` archives named `dailydesk-<timestamp>.dump`, kept 14 deep
in `/root/backups` on the VPS and copied to Cloudflare R2 under
`s3://diemdesk-backups/postgres/`.

## What is actually in there

Everything that exists in exactly one place: accounts and plan status, the Pro
cancellation records, File Vault metadata, MCP connect tokens, and the app data
(notes, habits, expenses, bio pages, files).

Not in there, and not needing to be: payment history, which lives in Stripe and
survives independently of this box.

## Restore, fastest path

From a local copy, if the box is still alive:

```bash
ls -lt /root/backups/dailydesk-*.dump | head
pg_restore --list /root/backups/dailydesk-<stamp>.dump | head    # confirm it parses
```

Then, into a **new** database first — never straight over the live one, because
a restore that turns out to be from the wrong night is not undoable:

```bash
createdb dailydesk_restore
pg_restore --no-owner --no-privileges -d dailydesk_restore /root/backups/dailydesk-<stamp>.dump
psql dailydesk_restore -c '\dt'
psql dailydesk_restore -c 'SELECT count(*) FROM users;'
```

Only once that looks right, swap:

```bash
pm2 stop dailydesk-api
psql -c 'ALTER DATABASE dailydesk RENAME TO dailydesk_broken_'"$(date -u +%Y%m%d)"';'
psql -c 'ALTER DATABASE dailydesk_restore RENAME TO dailydesk;'
pm2 start dailydesk-api
```

Keep `dailydesk_broken_*` until you are certain. Disk is cheaper than regret.

## Restore when the box is gone

```bash
rclone copy :s3:diemdesk-backups/postgres/ ./restore/ \
  --s3-provider=Cloudflare \
  --s3-access-key-id=... --s3-secret-access-key=... \
  --s3-endpoint=https://<account-id>.r2.cloudflarestorage.com \
  --max-age 48h
```

Then the same `pg_restore` as above. Provision Postgres, restore, point the new
API at it.

## If the backup was encrypted

Only if `BACKUP_PASSPHRASE` was set — the default is unset, and the objects are
plain `.dump` files protected by R2's at-rest encryption and a private bucket.

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in dailydesk-<stamp>.dump.enc -out dailydesk-<stamp>.dump \
  -pass env:BACKUP_PASSPHRASE
```

There is no recovery if that passphrase is lost. That is the whole trade, and it
is why it is off by default.

## Proving it works

A backup nobody has restored is a hypothesis. Restore into `dailydesk_restore`
once a quarter, check `SELECT count(*) FROM users`, drop it. Ten minutes, and it
is the only thing that turns "we have backups" into a fact.

The `/dashboard/system` page reports the age and size of the newest dump and
whether an off-site copy is configured. It measures rather than asserts: if it
says the backup is 40 hours old, it read the file's mtime.
