import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';

export const metadata: Metadata = {
  title: 'Account deleted | DiemDesk',
  description: 'Your DiemDesk account and everything in it has been deleted.',
  robots: { index: false, follow: true },
};

// Where deletion lands. A destructive action has to end somewhere that confirms
// it actually happened — bouncing someone to the home page leaves them
// wondering whether it worked, which is the worst possible doubt to leave after
// this particular button.
export default function AccountDeletedPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Your account is gone</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Deleted, along with everything that was in it. We kept no copy and no shadow record, so
          there is nothing left for us to look up — which is the point.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Every free tool still works without an account. If you ever want one again, you can sign
          up fresh with the same email.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition hover:bg-primary/90"
          >
            Back to the tools
          </Link>
          <Link href="/feedback" className="text-sm font-medium text-primary underline underline-offset-2">
            Tell us why you left
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
