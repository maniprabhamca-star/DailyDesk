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
// Deliberately quiet: small, muted, end of the page. It is a clarification, not
// a warning, and a scary box would misrepresent what it says.

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
    <p className={`text-xs leading-relaxed text-muted-foreground ${className}`}>
      <b className="font-semibold text-foreground">DiemDesk is not affiliated with, endorsed by, or connected to{' '}
      {subject}.</b>{' '}
      {because}. DiemDesk is a set of general-purpose document tools that happen to suit this work, and this page
      exists to say which of them apply and how.
      {children ? <> {children}</> : null}
    </p>
  );
}
