'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

// "Continue with Google" via Google Identity Services. Renders nothing unless
// NEXT_PUBLIC_GOOGLE_CLIENT_ID is set at build time, so the feature stays fully
// inert until the OAuth client id is configured. The GIS button returns a signed
// ID token (credential); the backend verifies it and issues our own session JWT.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

type GoogleCredentialResponse = { credential?: string };
type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (cfg: { client_id: string; callback: (r: GoogleCredentialResponse) => void }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
};
declare global {
  interface Window { google?: GoogleAccounts }
}

export function GoogleSignIn({ redirectTo = '/' }: { redirectTo?: string }) {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    function render() {
      if (cancelled || !window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp: GoogleCredentialResponse) => {
          if (!resp.credential) { setError('Google sign-in was cancelled.'); return; }
          loginWithGoogle(resp.credential)
            .then(() => router.push(redirectTo))
            .catch((e) => setError(e instanceof Error ? e.message : 'Google sign-in failed.'));
        },
      });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 320, text: 'continue_with', shape: 'pill' });
    }

    const existing = document.getElementById('gsi-script');
    if (existing) {
      render();
    } else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.id = 'gsi-script';
      s.onload = render;
      document.head.appendChild(s);
    }
    return () => { cancelled = true; };
  }, [loginWithGoogle, router, redirectTo]);

  if (!CLIENT_ID) return null;

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <div ref={ref} className="mt-4 flex justify-center" />
      {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
