import { Info } from 'lucide-react';

// The non-affiliation notice, in one place.
//
// Several page families name somebody else: the sector pages cite statutes and
// regulators, the bank pages name banks, the forms libraries name the IRS and
// USCIS, the passport pages quote government photo specifications. Each of
// those names is there to describe what the tool does — "we read this
// statement format", "this is the size that authority asks for" — and none of
// them implies a relationship. Saying so once per page is cheap; being
// mistaken for an official or endorsed service is not.
//
// It lives in a component rather than as copy on each page because four
// hand-written versions of the same sentence drift, and the one that drifts is
// the one that matters.
//
// Amber, matching the "Fair disclosure" box on /compare and the alternative
// pages exactly (border-amber-300/50 · bg-amber-50/40, with the dark-mode pair).
// Those two are the site's other standing disclosure, and a reader meeting one
// on /compare and the other on /for/immigration should recognise them as the
// same kind of thing. Two different-looking boxes saying "here is something we
// are being straight with you about" is a design that has not decided.
//
// Still dashed, and still small and muted in its type, so it reads as a
// clarification rather than a warning — the colour carries the family, the
// weight carries the tone.
export function ThirdPartyNotice({
  /** Who or what the page names — "the Internal Revenue Service", "HDFC Bank", "any government department". */
  subject,
  /** Why that name appears, in the page's own terms. One clause, no full stop. */
  because,
  /** Extra sentence for families that need one (not advice, we do not file for you). */
  children,
  className = '',
}: {
  subject: string;
  because: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={`flex gap-2.5 rounded-xl border border-dashed border-amber-300/50 bg-amber-50/40 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/10 ${className}`}
      aria-label="Affiliation notice"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-amber-600/80 dark:text-amber-500/70" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <b className="font-semibold text-foreground">DiemDesk is not affiliated with, endorsed by, or connected to{' '}
        {subject}.</b>{' '}
        {because}. DiemDesk is a set of general-purpose document tools that happen to suit this work, and this page
        exists to say which of them apply and how.
        {children ? <> {children}</> : null}
      </p>
    </aside>
  );
}
