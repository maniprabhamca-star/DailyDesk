// One place to say "the session is over".
//
// Every API helper on the site had its own 401 branch, and each of them did the
// same half-job: show a message about *that* feature and leave the dead token in
// place. So a lapsed session meant Notes said "please sign in to use your notes",
// Habits said its own version, billing span forever (REG-034) — and the header
// still showed you signed in, because nothing had told the auth layer anything
// had happened. One 401 anywhere means one thing everywhere.

export const SESSION_EXPIRED_EVENT = 'dd-session-expired';

/** Clear the dead credentials and tell the auth provider, wherever it is. */
export function reportSessionExpired(): void {
  if (typeof window === 'undefined') return;
  try {
    // Nothing is gained by keeping a token the server has already rejected, and
    // leaving it means every later call fails the same way.
    localStorage.removeItem('dd_token');
    localStorage.removeItem('dd_user');
  } catch {
    /* private mode — the event below still does its job */
  }
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

/** A 401 on the sign-in endpoints means "wrong password", not "session over". */
export const isAuthEndpoint = (path: string): boolean => path.startsWith('/api/auth/');
