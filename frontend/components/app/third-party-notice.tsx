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
// Boxed, but deliberately NOT the same box as the explainer that usually sits
// above it: that one is filled, this one is outlined and dashed. Two identical
// grey slabs stacked read as one long block nobody finishes; a filled box
// followed by an outlined one reads as "here is the explanation" then "and here
// is who we are not". Dashed rather than solid, and muted rather than amber,
// because this is a clarification and a warning box would misrepresent it.
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
      className={`flex gap-2.5 rounded-xl border border-dashed border-border px-4 py-3 ${className}`}
      aria-label="Affiliation notice"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
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
