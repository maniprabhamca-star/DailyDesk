// Removes temp files and directories a crashed request left behind.
//
// Every tool that shells out to an engine writes into os.tmpdir() and deletes
// it again on BOTH the success and the failure path. That covers everything the
// code can control. What it cannot cover is the process being killed between
// the write and the delete — an OOM kill, a pm2 restart mid-conversion, a
// deploy at the wrong moment. The copy then sits there until something removes
// it, and for a receipt or a bank statement "until the monthly cleanup cron" is
// not a good enough answer.
//
// So: sweep on boot, which is exactly when a crash has just happened, and again
// on a slow timer.

const fs = require('fs');
const path = require('path');
const os = require('os');

// Every prefix the app creates. mkdtempSync makes directories; multer's disk
// storage writes plain FILES named ddconv-<hex>.<ext>, so both are handled.
const PREFIXES = ['dd-ocr-', 'dd-rcpt-', 'ddconv-', 'ddout-', 'ddlo-'];

// Comfortably longer than the longest job (OCR at 180s) plus its cleanup, so a
// sweep can never delete a directory a live request is still using. The two
// cluster instances both sweep; that is harmless, because removal is
// age-gated and idempotent.
const MIN_AGE_MS = 30 * 60 * 1000;
const EVERY_MS = 60 * 60 * 1000;

function sweepOnce() {
  const dir = os.tmpdir();
  const cutoff = Date.now() - MIN_AGE_MS;
  let removed = 0;

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return 0; // no temp dir to read is not a reason to fall over
  }

  for (const name of entries) {
    if (!PREFIXES.some((p) => name.startsWith(p))) continue;
    const full = path.join(dir, name);
    try {
      // mtime, not ctime: a directory being actively written to keeps moving,
      // so an in-flight job is never old enough to qualify.
      if (fs.statSync(full).mtimeMs > cutoff) continue;
      fs.rmSync(full, { recursive: true, force: true });
      removed++;
    } catch {
      // Gone already, or owned by the other instance mid-sweep. Either way,
      // not our problem and not worth a stack trace.
    }
  }
  return removed;
}

/** Sweep now, then hourly. Safe to call more than once. */
function startTempSweeper() {
  const run = (when) => {
    const n = sweepOnce();
    // Silence when there is nothing to say. A line here means a request died
    // without cleaning up, which is worth knowing about.
    if (n > 0) console.warn(`[temp-sweeper] removed ${n} orphaned temp entr${n === 1 ? 'y' : 'ies'} (${when})`);
  };

  run('boot');
  const timer = setInterval(() => run('hourly'), EVERY_MS);
  timer.unref?.(); // never hold the process open on its own account
  return timer;
}

module.exports = { startTempSweeper, sweepOnce, PREFIXES, MIN_AGE_MS };
