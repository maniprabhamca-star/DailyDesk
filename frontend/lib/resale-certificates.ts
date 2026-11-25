// Resale / sales-tax exemption certificates, state by state — Phase 1, matrix 1.
//
// ── What a "matrix" is, and why it is not a directory ────────────────────────
// A per-state forms directory is 1,500–4,500 documents and destroys the only
// thing we can say that the big libraries cannot: every entry here was read at
// source and is re-checked. So the unit is a MATRIX — one form type, every
// jurisdiction, on one page. Nobody needs "all Georgia forms". They need one
// form and do not know which state publishes which version of it.
//
// ── ⭐ The header row: the MTC multijurisdiction certificate ─────────────────
// The Multistate Tax Commission publishes a Uniform Sales & Use Tax Resale
// Certificate that a large majority of states accept. That one document is
// what makes the matrix tractable: it answers most of the grid by itself, and
// the states that will not take it are the interesting rows.
//
// ── ⚠⚠ "Accepted" is not one thing, and this is the whole point of the page ──
// The certificate carries 32 numbered notes, and reading them is the work. A
// seller's real question is "can I take this form from a customer in X?" and
// the answer is very often a qualified yes:
//
//   • nine states take it as a RESALE certificate only, and say in terms that
//     it is not valid as an exemption certificate (CA, CT, KY, MD, NV, PA, RI,
//     TN, WI);
//   • four will not let it cover a taxable SERVICE bought for resale
//     (CO, HI, IL, NM);
//   • Florida wants the form AND a resale authorisation number from the
//     Department of Revenue;
//   • Hawaii inverts it — the SELLER uses it to claim a lower general excise
//     rate, rather than the buyer claiming an exemption;
//   • thirteen jurisdictions do not appear on the certificate at all.
//
// A page that printed a tick against 38 states would be the wrong page. The
// qualification is the information.
//
// ── ⚠ Counted off the document, not off the prose ────────────────────────────
// mtc.gov's own page says "36 States have indicated" the certificate can be
// used. The certificate itself prints 38 registration boxes: 37 states plus
// the Alaska Remote Sellers Sales Tax Commission, which is a municipal body
// rather than a state revenue department. We publish what the form prints and
// say where the two disagree, because the alternative is repeating a number we
// cannot reproduce. MTC_* below are measured with pdf-lib and pdf.js on the
// real PDF, on CHECKED_ON.
//
// ── The rule we do not bend, same as the federal library ─────────────────────
// We never host a copy. Every row links to the issuing authority's own page.
// See lib/us-forms.ts for the long form of the argument.

/** The day every status, note and measurement here was verified at source. */
export const CHECKED_ON = '2026-11-25';

/** CHECKED_ON as prose. Built from the parts, never `new Date(CHECKED_ON)` —
 *  a bare YYYY-MM-DD parses as UTC midnight and renders a day early west of
 *  UTC, which is exactly the claim this date exists to support. Same reasoning
 *  and same guard as lib/us-forms.ts. */
export const CHECKED_ON_LABEL = (() => {
  const [y, m, d] = CHECKED_ON.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
})();

// ── The header row ───────────────────────────────────────────────────────────

/** The revision the MTC prints on the form itself, in its own words. */
export const MTC_REVISION = 'Revised October 14, 2022';
/** Pages of the published PDF, instructions included. Measured. */
export const MTC_PAGES = 9;
/** Fillable fields on the real PDF, measured with pdf-lib. */
export const MTC_FIELDS = 60;
/** Registration boxes printed on page 1 — 37 states plus AK/ARSSTC. Measured. */
export const MTC_BOXES = 38;
/** Numbered notes on pages 2–6, which carry every caveat below. Measured. */
export const MTC_NOTES = 32;
/** What mtc.gov's own prose claims, which is not what the form prints. */
export const MTC_CLAIMED_STATES = 36;

export const MTC = {
  name: 'Uniform Sales & Use Tax Resale Certificate — Multijurisdiction',
  short: 'MTC uniform resale certificate',
  authority: 'Multistate Tax Commission',
  officialName: 'the MTC page for the uniform resale certificate',
  officialUrl: 'https://www.mtc.gov/resources/uniform-sales-use-tax-exemption-certificate/',
  /** Used only by the fetch route, which streams it live. We store nothing. */
  pdfUrl: 'https://www.mtc.gov/wp-content/uploads/2023/01/Unif-Resale-Cert-revised-10-14-22.pdf',
} as const;

// ── Jurisdictions ────────────────────────────────────────────────────────────

/** How a jurisdiction treats the MTC certificate.
 *
 *  `accepted`    — listed, with no limitation or only an informational note.
 *  `resale-only` — listed, but the notes say in terms that it is NOT valid as
 *                  an exemption certificate. Taking it for a non-resale
 *                  exemption is the mistake this column exists to prevent.
 *  `conditional` — listed, but the certificate alone is not enough, or a
 *                  whole class of purchase is carved out.
 *  `absent`      — not printed on the certificate. Not the same as "refused":
 *                  five of these have no general sales tax at all. */
export type MtcStatus = 'accepted' | 'resale-only' | 'conditional' | 'absent';

export type Jurisdiction = {
  /** USPS code. The stable key — names and slugs are presentation. */
  code: string;
  name: string;
  slug: string;
  /** Does a general STATE sales tax exist at all? Alaska is the trap: no state
   *  sales tax, but municipalities levy one and the ARSSTC administers it for
   *  remote sellers, which is why Alaska appears on the certificate. */
  salesTax: boolean;
  status: MtcStatus;
  /** The note number printed beside the state's box, where there is one.
   *  Several states carry two; note 5 is shared by CO, HI, IL and NM. */
  notes?: number[];
  /** Our one-line summary of what the notes actually restrict. Paraphrased —
   *  the certificate's own wording is on the certificate, which we link to
   *  rather than reproduce. Omitted where there is nothing to qualify. */
  limit?: string;
  authority: string;
  /** The revenue department's own site. ⚠ Two of these are deliberately NOT
   *  the link mtc.gov gives: its California link points at the Franchise Tax
   *  Board, which administers income tax and not sales tax, and it omits
   *  Nevada entirely even though Nevada is printed on the certificate. */
  authorityUrl: string;
};

// ⚠ The nine taxing jurisdictions absent from the certificate say only that —
// that they are absent. Ship 1 wrote "Use <State>'s own." against all nine,
// before any of those documents had been read. Ship 2 read them and four of
// the nine claims were false: Mississippi publishes no certificate at all,
// the District's could not be opened, and West Virginia and Wyoming have no
// own form — their route is the Streamlined certificate. The route is now
// rendered from OWN_CERTS and SST_MEMBERS, which are verified per entry, so a
// row can no longer promise a document nobody has looked at.
export const JURISDICTIONS: Jurisdiction[] = [
  {
    code: 'AL', name: 'Alabama', slug: 'alabama', salesTax: true, status: 'accepted', notes: [2],
    limit: 'The seller carries the burden of judging whether the buyer’s claim is good.',
    authority: 'Alabama Department of Revenue', authorityUrl: 'https://revenue.alabama.gov/',
  },
  {
    code: 'AK', name: 'Alaska', slug: 'alaska', salesTax: false, status: 'conditional', notes: [1],
    limit: 'There is no state sales tax, but municipalities levy one. The certificate works only through the Alaska Remote Sellers Sales Tax Commission, and only when it carries what the ARSSTC requires.',
    authority: 'Alaska Department of Revenue', authorityUrl: 'https://dor.alaska.gov/',
  },
  {
    code: 'AZ', name: 'Arizona', slug: 'arizona', salesTax: true, status: 'conditional', notes: [3],
    limit: 'Only for tangible personal property bought for resale in the ordinary course of business.',
    authority: 'Arizona Department of Revenue', authorityUrl: 'https://azdor.gov/',
  },
  {
    code: 'AR', name: 'Arkansas', slug: 'arkansas', salesTax: true, status: 'accepted',
    authority: 'Arkansas Department of Finance and Administration', authorityUrl: 'https://www.dfa.arkansas.gov/',
  },
  {
    code: 'CA', name: 'California', slug: 'california', salesTax: true, status: 'resale-only', notes: [4],
    limit: 'Not valid as an exemption certificate. Resale only.',
    authority: 'California Department of Tax and Fee Administration', authorityUrl: 'https://www.cdtfa.ca.gov/',
  },
  {
    code: 'CO', name: 'Colorado', slug: 'colorado', salesTax: true, status: 'conditional', notes: [5, 6],
    limit: 'Cannot be used to buy a taxable service for resale. Colorado also points sellers at its own documentation rule before relying on it.',
    authority: 'Colorado Department of Revenue', authorityUrl: 'https://cdor.colorado.gov/',
  },
  {
    code: 'CT', name: 'Connecticut', slug: 'connecticut', salesTax: true, status: 'resale-only', notes: [7],
    limit: 'Not valid as an exemption certificate. Resale only.',
    authority: 'Connecticut Department of Revenue Services', authorityUrl: 'https://portal.ct.gov/drs',
  },
  {
    code: 'DE', name: 'Delaware', slug: 'delaware', salesTax: false, status: 'absent',
    limit: 'No general sales tax, so no resale certificate to give.',
    authority: 'Delaware Division of Revenue', authorityUrl: 'https://revenue.delaware.gov/',
  },
  {
    code: 'DC', name: 'District of Columbia', slug: 'district-of-columbia', salesTax: true, status: 'absent',
    limit: 'Has a sales tax but is not printed on the certificate.',
    authority: 'DC Office of Tax and Revenue', authorityUrl: 'https://otr.cfo.dc.gov/',
  },
  {
    code: 'FL', name: 'Florida', slug: 'florida', salesTax: true, status: 'conditional', notes: [8],
    limit: 'The form alone does not carry the exemption. Florida also looks for a resale authorisation number, which the selling dealer obtains from the Department of Revenue against the buyer’s Florida annual resale certificate.',
    authority: 'Florida Department of Revenue', authorityUrl: 'https://floridarevenue.com/',
  },
  {
    code: 'GA', name: 'Georgia', slug: 'georgia', salesTax: true, status: 'accepted', notes: [9],
    limit: 'An out-of-state buyer’s own registration number is accepted in place of a Georgia one on a drop shipment to a Georgia customer.',
    authority: 'Georgia Department of Revenue', authorityUrl: 'https://dor.georgia.gov/',
  },
  {
    code: 'HI', name: 'Hawaii', slug: 'hawaii', salesTax: true, status: 'conditional', notes: [5, 10],
    limit: 'Works the other way round: the seller uses it to claim a lower general excise rate, rather than the buyer claiming an exemption. Not available for a taxable service bought for resale.',
    authority: 'Hawaii Department of Taxation', authorityUrl: 'https://tax.hawaii.gov/',
  },
  {
    code: 'ID', name: 'Idaho', slug: 'idaho', salesTax: true, status: 'conditional', notes: [11],
    limit: 'Only for tangible personal property bought for resale in the ordinary course of business.',
    authority: 'Idaho State Tax Commission', authorityUrl: 'https://tax.idaho.gov/',
  },
  {
    code: 'IL', name: 'Illinois', slug: 'illinois', salesTax: true, status: 'conditional', notes: [5, 12],
    limit: 'Cannot be used to buy a taxable service for resale, and its use is governed by the Illinois seller’s-responsibility rule.',
    authority: 'Illinois Department of Revenue', authorityUrl: 'https://tax.illinois.gov/',
  },
  {
    code: 'IN', name: 'Indiana', slug: 'indiana', salesTax: true, status: 'absent',
    limit: 'Has a sales tax but is not printed on the certificate.',
    authority: 'Indiana Department of Revenue', authorityUrl: 'https://www.in.gov/dor/',
  },
  {
    code: 'IA', name: 'Iowa', slug: 'iowa', salesTax: true, status: 'accepted',
    authority: 'Iowa Department of Revenue', authorityUrl: 'https://tax.iowa.gov/',
  },
  {
    code: 'KS', name: 'Kansas', slug: 'kansas', salesTax: true, status: 'conditional', notes: [13],
    limit: 'Kansas looks for a Kansas registration number issued by its own Department of Revenue. Another state’s number does not satisfy it.',
    authority: 'Kansas Department of Revenue', authorityUrl: 'https://www.ksrevenue.org/',
  },
  {
    code: 'KY', name: 'Kentucky', slug: 'kentucky', salesTax: true, status: 'resale-only', notes: [14],
    limit: 'Not valid as an exemption certificate, and cannot cover the purchase of admissions. Using it creates a blanket certificate.',
    authority: 'Kentucky Department of Revenue', authorityUrl: 'https://revenue.ky.gov/',
  },
  {
    code: 'LA', name: 'Louisiana', slug: 'louisiana', salesTax: true, status: 'absent',
    limit: 'Has a sales tax but is not printed on the certificate.',
    authority: 'Louisiana Department of Revenue', authorityUrl: 'https://revenue.louisiana.gov/',
  },
  {
    code: 'ME', name: 'Maine', slug: 'maine', salesTax: true, status: 'conditional', notes: [15],
    limit: 'Maine has no exemption for property bought to lease or rent on, so the certificate is not valid for that.',
    authority: 'Maine Revenue Services', authorityUrl: 'https://www.maine.gov/revenue/',
  },
  {
    code: 'MD', name: 'Maryland', slug: 'maryland', salesTax: true, status: 'resale-only', notes: [16],
    limit: 'Not valid as an exemption certificate. Resale only.',
    authority: 'Comptroller of Maryland', authorityUrl: 'https://www.marylandtaxes.gov/',
  },
  {
    code: 'MA', name: 'Massachusetts', slug: 'massachusetts', salesTax: true, status: 'absent',
    limit: 'Has a sales tax but is not printed on the certificate.',
    authority: 'Massachusetts Department of Revenue', authorityUrl: 'https://www.mass.gov/orgs/massachusetts-department-of-revenue',
  },
  {
    code: 'MI', name: 'Michigan', slug: 'michigan', salesTax: true, status: 'accepted', notes: [17],
    limit: 'Treated as a blanket certificate good for four years unless the parties agree a shorter period.',
    authority: 'Michigan Department of Treasury', authorityUrl: 'https://www.michigan.gov/treasury',
  },
  {
    code: 'MN', name: 'Minnesota', slug: 'minnesota', salesTax: true, status: 'conditional', notes: [18],
    limit: 'Minnesota looks for the buyer’s Minnesota tax identification number in the Minnesota row.',
    authority: 'Minnesota Department of Revenue', authorityUrl: 'https://www.revenue.state.mn.us/',
  },
  {
    code: 'MS', name: 'Mississippi', slug: 'mississippi', salesTax: true, status: 'absent',
    limit: 'Has a sales tax but is not printed on the certificate.',
    authority: 'Mississippi Department of Revenue', authorityUrl: 'https://www.dor.ms.gov/',
  },
  {
    code: 'MO', name: 'Missouri', slug: 'missouri', salesTax: true, status: 'accepted', notes: [19],
    limit: 'A buyer who uses it improperly can be pursued for the tax directly.',
    authority: 'Missouri Department of Revenue', authorityUrl: 'https://dor.mo.gov/',
  },
  {
    code: 'MT', name: 'Montana', slug: 'montana', salesTax: false, status: 'absent',
    limit: 'No general sales tax, so no resale certificate to give.',
    authority: 'Montana Department of Revenue', authorityUrl: 'https://mtrevenue.gov/',
  },
  {
    code: 'NE', name: 'Nebraska', slug: 'nebraska', salesTax: true, status: 'accepted',
    authority: 'Nebraska Department of Revenue', authorityUrl: 'https://revenue.nebraska.gov/',
  },
  {
    code: 'NV', name: 'Nevada', slug: 'nevada', salesTax: true, status: 'resale-only', notes: [20],
    limit: 'Not valid as an exemption certificate. Resale only, and the buyer certifies the property is for resale in the regular course of business.',
    authority: 'Nevada Department of Taxation', authorityUrl: 'https://tax.nv.gov/',
  },
  {
    code: 'NH', name: 'New Hampshire', slug: 'new-hampshire', salesTax: false, status: 'absent',
    limit: 'No general sales tax, so no resale certificate to give.',
    authority: 'New Hampshire Department of Revenue Administration', authorityUrl: 'https://www.revenue.nh.gov/',
  },
  {
    code: 'NJ', name: 'New Jersey', slug: 'new-jersey', salesTax: true, status: 'accepted',
    authority: 'New Jersey Division of Taxation', authorityUrl: 'https://www.state.nj.us/treasury/taxation/',
  },
  {
    code: 'NM', name: 'New Mexico', slug: 'new-mexico', salesTax: true, status: 'conditional', notes: [5, 21],
    limit: 'Accepted in place of a New Mexico nontaxable transaction certificate, but not for a taxable service bought for resale.',
    authority: 'New Mexico Taxation and Revenue Department', authorityUrl: 'https://www.tax.newmexico.gov/',
  },
  {
    code: 'NY', name: 'New York', slug: 'new-york', salesTax: true, status: 'absent',
    limit: 'Has a sales tax but is not printed on the certificate.',
    authority: 'New York State Department of Taxation and Finance', authorityUrl: 'https://www.tax.ny.gov/',
  },
  {
    code: 'NC', name: 'North Carolina', slug: 'north-carolina', salesTax: true, status: 'conditional', notes: [22],
    limit: 'Not valid as an exemption certificate when signed by someone such as a contractor who is not buying for resale.',
    authority: 'North Carolina Department of Revenue', authorityUrl: 'https://www.ncdor.gov/',
  },
  {
    code: 'ND', name: 'North Dakota', slug: 'north-dakota', salesTax: true, status: 'accepted',
    authority: 'North Dakota Office of State Tax Commissioner', authorityUrl: 'https://www.tax.nd.gov/',
  },
  {
    code: 'OH', name: 'Ohio', slug: 'ohio', salesTax: true, status: 'conditional', notes: [23],
    limit: 'Ohio looks for the reason for exemption on the form itself. Left unstated, the certificate is disallowed on audit.',
    authority: 'Ohio Department of Taxation', authorityUrl: 'https://tax.ohio.gov/',
  },
  {
    code: 'OK', name: 'Oklahoma', slug: 'oklahoma', salesTax: true, status: 'conditional', notes: [24],
    limit: 'Accepted in place of a copy of the buyer’s sales tax permit, but only on strict compliance — short of that, Oklahoma holds the seller liable for the tax.',
    authority: 'Oklahoma Tax Commission', authorityUrl: 'https://oklahoma.gov/tax.html',
  },
  {
    code: 'OR', name: 'Oregon', slug: 'oregon', salesTax: false, status: 'absent',
    limit: 'No general sales tax, so no resale certificate to give.',
    authority: 'Oregon Department of Revenue', authorityUrl: 'https://www.oregon.gov/DOR/',
  },
  {
    code: 'PA', name: 'Pennsylvania', slug: 'pennsylvania', salesTax: true, status: 'resale-only', notes: [25],
    limit: 'Not valid as an exemption certificate. Resale only.',
    authority: 'Pennsylvania Department of Revenue', authorityUrl: 'https://www.revenue.pa.gov/',
  },
  {
    code: 'RI', name: 'Rhode Island', slug: 'rhode-island', salesTax: true, status: 'resale-only', notes: [26],
    limit: 'Resale only, and only where the item is resold in the same form. No other exemption.',
    authority: 'Rhode Island Division of Taxation', authorityUrl: 'https://tax.ri.gov/',
  },
  {
    code: 'SC', name: 'South Carolina', slug: 'south-carolina', salesTax: true, status: 'accepted',
    authority: 'South Carolina Department of Revenue', authorityUrl: 'https://dor.sc.gov/',
  },
  {
    code: 'SD', name: 'South Dakota', slug: 'south-dakota', salesTax: true, status: 'conditional', notes: [27],
    limit: 'A carve-out applies to services a provider buys and delivers on to a current customer.',
    authority: 'South Dakota Department of Revenue', authorityUrl: 'https://dor.sd.gov/',
  },
  {
    code: 'TN', name: 'Tennessee', slug: 'tennessee', salesTax: true, status: 'resale-only', notes: [28],
    limit: 'Resale only — goods, taxable services, amusements, digital products or a component part for resale. No other exemption.',
    authority: 'Tennessee Department of Revenue', authorityUrl: 'https://www.tn.gov/revenue/',
  },
  {
    code: 'TX', name: 'Texas', slug: 'texas', salesTax: true, status: 'conditional', notes: [29],
    limit: 'Texas confines the resale to the United States, its territories and possessions.',
    authority: 'Texas Comptroller of Public Accounts', authorityUrl: 'https://comptroller.texas.gov/',
  },
  {
    code: 'UT', name: 'Utah', slug: 'utah', salesTax: true, status: 'accepted',
    authority: 'Utah State Tax Commission', authorityUrl: 'https://tax.utah.gov/',
  },
  {
    code: 'VT', name: 'Vermont', slug: 'vermont', salesTax: true, status: 'conditional', notes: [30],
    limit: 'Vermont limits it to resellers registered to collect Vermont sales tax, and to goods — not component parts of a service, and not contractors.',
    authority: 'Vermont Department of Taxes', authorityUrl: 'https://tax.vermont.gov/',
  },
  {
    code: 'VA', name: 'Virginia', slug: 'virginia', salesTax: true, status: 'absent',
    limit: 'Has a sales tax but is not printed on the certificate.',
    authority: 'Virginia Department of Taxation', authorityUrl: 'https://www.tax.virginia.gov/',
  },
  {
    code: 'WA', name: 'Washington', slug: 'washington', salesTax: true, status: 'accepted', notes: [31],
    limit: 'Misuse exposes the buyer to interest and penalties on top of the tax.',
    authority: 'Washington Department of Revenue', authorityUrl: 'https://dor.wa.gov/',
  },
  {
    code: 'WV', name: 'West Virginia', slug: 'west-virginia', salesTax: true, status: 'absent',
    limit: 'Has a sales tax but is not printed on the certificate.',
    authority: 'West Virginia Tax Division', authorityUrl: 'https://tax.wv.gov/',
  },
  {
    code: 'WI', name: 'Wisconsin', slug: 'wisconsin', salesTax: true, status: 'resale-only', notes: [32],
    limit: 'Resale only. It does not carry any other exemption.',
    authority: 'Wisconsin Department of Revenue', authorityUrl: 'https://www.revenue.wi.gov/',
  },
  {
    code: 'WY', name: 'Wyoming', slug: 'wyoming', salesTax: true, status: 'absent',
    limit: 'Has a sales tax but is not printed on the certificate.',
    authority: 'Wyoming Department of Revenue', authorityUrl: 'https://revenue.wyo.gov/',
  },
];

// ── Derived ──────────────────────────────────────────────────────────────────
// Counts are derived, never typed. A matrix whose headline number disagrees
// with its own rows is the failure mode this rule exists to prevent.

export const STATUS_ORDER: MtcStatus[] = ['accepted', 'conditional', 'resale-only', 'absent'];

export const STATUS_LABEL: Record<MtcStatus, string> = {
  accepted: 'Accepted',
  conditional: 'Accepted, with a condition',
  'resale-only': 'Resale only — not an exemption certificate',
  absent: 'Not on the certificate',
};

/** One-line explanation of each verdict, for the legend. */
export const STATUS_BLURB: Record<MtcStatus, string> = {
  accepted: 'Listed on the certificate with nothing to qualify it, or only a note telling you how it behaves.',
  conditional: 'Listed, but the certificate alone is not enough, or a class of purchase is carved out. Read the row.',
  'resale-only': 'Listed, and the notes say in terms that it is not valid as an exemption certificate. Taking it for any other exemption is the mistake.',
  // ⚠ This said "the rest publish their own" until ship 2 read the sources
  // and found that two of them do not. It also hand-typed "Five", which
  // the page derives three lines further down. Both gone: the blurb now
  // describes the bucket and leaves the counts and the routes to the data.
  absent: 'Not printed on the certificate, which is not the same as refused. Some of these have no general sales tax at all. What the rest do instead is on the row.',
};

export const byStatus = (s: MtcStatus): Jurisdiction[] => JURISDICTIONS.filter((j) => j.status === s);

export const jurisdiction = (slug: string): Jurisdiction | undefined =>
  JURISDICTIONS.find((j) => j.slug === slug);

/** Jurisdictions printed on the certificate, however qualified. */
export const ACCEPTING = JURISDICTIONS.filter((j) => j.status !== 'absent');

/** Sales-tax jurisdictions that are NOT on it — the ones needing their own form. */
export const NEEDS_OWN_FORM = JURISDICTIONS.filter((j) => j.status === 'absent' && j.salesTax);

/** No general state sales tax: the answer is "nobody needs a certificate". */
export const NO_SALES_TAX = JURISDICTIONS.filter((j) => !j.salesTax);

export const JURISDICTION_COUNT = JURISDICTIONS.length;

// ── SEO copy ─────────────────────────────────────────────────────────────────
// Here rather than in the page so the budgets are testable. Both are built
// from derived counts: a title or description that hard-codes 38 goes wrong
// the first time the certificate is revised, on the one surface where nobody
// would notice.

/** ≤60 characters, or Google truncates it mid-claim. */
export const SEO_TITLE = 'Resale Certificates by State — Which Accept the MTC Form';

/** ≤155 characters. */
export const SEO_DESCRIPTION =
  `Which of the ${JURISDICTIONS.filter((j) => j.status !== 'absent').length} US jurisdictions accept the MTC uniform resale certificate, and the condition each attaches — read off the certificate, not a summary.`;

// ═══════════════════════════════════════════════════════════════════════════
// Ship 2 — the second header row, and each jurisdiction's own certificate.
// ═══════════════════════════════════════════════════════════════════════════
//
// ── ⭐⭐ There is a SECOND multistate certificate, and ship 1 did not know it ──
// The Streamlined Sales Tax Governing Board publishes Form F0003, accepted by
// all 24 Streamlined member states. It matters structurally, not as trivia:
// three of the nine taxing jurisdictions the MTC certificate omits — Indiana,
// West Virginia and Wyoming — are Streamlined members, so a seller who had no
// answer from the MTC grid has one here. Two header rows, not one.
//
// ── ⚠ Half of the remainder are not documents you fill in ────────────────────
// Exactly the lesson the India forms taught with `howFiled`. A column of
// "download the form" links would be wrong about the main thing it describes:
//   • Louisiana ISSUES its certificate through LaTAP and it expires annually;
//     there is no blank to download.
//   • Mississippi has no certificate at all. Its Department of Revenue states
//     it does not accept or use blanket certificates; a buyer shows a permit
//     or letter the department issued.
//   • Florida's is issued too, which is what note 8 on the MTC form is about.
// So `OwnCert` is a discriminated union and `kind` carries the honest answer.
//
// ── ⚠ Where a source would not open, we say so ───────────────────────────────
// The District of Columbia's Office of Tax and Revenue returns 403 on every
// page below its root, to the browser and to an in-page request alike. That is
// recorded as `unverified` rather than filled from memory. A page with no
// claim asserts nothing; a page with an invented citation loses the only
// readers who check.
//
// ── ⚠ Every measurement here was nearly wrong ────────────────────────────────
// The first verification harness reported 0 fillable fields for all twelve
// documents. pdf.js DETACHES the ArrayBuffer it is given, so pdf-lib received
// an empty buffer and threw, and the catch wrote 0. Distinguishing "measured
// zero" from "swallowed error" is the only reason that was caught — and
// Georgia's ST-5 really is zero, because it is a flat print-and-sign form.
//
// ── The url / pdfUrl split, same as lib/us-forms.ts ──────────────────────────
// `officialUrl` is the department's human page and a test forbids it from
// pointing at a PDF. `pdfUrl` is the department's own PDF, fetched live when
// someone asks for the blank. We store neither.

/** Streamlined Sales Tax membership, read from streamlinedsalestax.org. */
export type SstTier = 'full' | 'associate';

export const SST = {
  number: 'SSTGB Form F0003',
  name: 'Streamlined Sales Tax Certificate of Exemption',
  authority: 'Streamlined Sales Tax Governing Board',
  revision: 'Revised 12/21/2021',
  officialUrl: 'https://www.streamlinedsalestax.org/for-businesses/exemptions',
  pages: 2,
  fields: 97,
} as const;

/** The 24 member states, which accept F0003. Tennessee is the lone associate. */
export const SST_MEMBERS: Record<string, SstTier> = {
  AR: 'full', GA: 'full', IN: 'full', IA: 'full', KS: 'full', KY: 'full',
  MI: 'full', MN: 'full', NE: 'full', NV: 'full', NJ: 'full', NC: 'full',
  ND: 'full', OH: 'full', OK: 'full', RI: 'full', SD: 'full', UT: 'full',
  VT: 'full', WA: 'full', WV: 'full', WI: 'full', WY: 'full',
  TN: 'associate',
};

export const isSstMember = (code: string): boolean => code in SST_MEMBERS;

/** What a jurisdiction publishes of its own.
 *
 *  `form`       — a blank PDF anyone can download and fill. Measured.
 *  `issued`     — the department issues it; there is no blank to download.
 *  `none`       — no certificate exists in this jurisdiction.
 *  `unverified` — we could not open the source, and will not guess. */
export type OwnCert =
  | {
      kind: 'form';
      number: string;
      name: string;
      /** The agency's own revision marker, exactly as printed. Omitted where
       *  the document prints none — CDTFA-230 and Indiana's ST-105 do not. */
      revision?: string;
      /** The department's human page. Never a direct PDF; a test enforces it. */
      officialUrl: string;
      /** The department's own PDF, fetched live. We keep no copy. */
      pdfUrl: string;
      pages: number;
      /** Measured with pdf-lib. 0 means a flat form, and is a measurement. */
      fields: number;
    }
  | { kind: 'issued'; how: string; officialUrl: string }
  | { kind: 'none'; why: string; officialUrl: string }
  | { kind: 'unverified'; why: string };

export const OWN_CERTS: Record<string, OwnCert> = {
  AZ: {
    kind: 'form',
    number: 'Form 5000A',
    name: 'Arizona Resale Certificate',
    revision: 'ADOR 10316 (8/25)',
    officialUrl: 'https://azdor.gov/forms/tpt-forms/arizona-resale-certificate',
    pdfUrl: 'https://azdor.gov/sites/default/files/2023-03/FORMS_TPT_5000A_10316_0.pdf',
    pages: 1,
    fields: 26,
  },
  CA: {
    kind: 'form',
    number: 'CDTFA-230',
    name: 'General Resale Certificate',
    officialUrl: 'https://www.cdtfa.ca.gov/formspubs/forms.htm',
    pdfUrl: 'https://www.cdtfa.ca.gov/formspubs/cdtfa230.pdf',
    pages: 1,
    fields: 13,
  },
  GA: {
    kind: 'form',
    number: 'ST-5',
    name: 'Sales Tax Certificate of Exemption',
    revision: 'Rev. 07/11/22',
    officialUrl: 'https://dor.georgia.gov/documents/st-5-certificate-exemption',
    pdfUrl: 'https://dor.georgia.gov/document/form/st-5-sales-tax-certificate-exemption/download',
    // Measured zero: ST-5 is a flat form, printed and written on by hand.
    pages: 1,
    fields: 0,
  },
  ID: {
    kind: 'form',
    number: 'ST-101',
    name: 'Sales Tax Resale or Exemption Certificate',
    revision: 'EFO00149 02-27-2025',
    officialUrl: 'https://tax.idaho.gov/taxes/sales-use/forms/',
    pdfUrl: 'https://tax.idaho.gov/wp-content/uploads/forms/EFO00149/EFO00149_02-27-2025.pdf',
    pages: 4,
    fields: 69,
  },
  IL: {
    kind: 'form',
    number: 'CRT-61',
    name: 'Certificate of Resale',
    revision: 'R-04/25',
    officialUrl: 'https://tax.illinois.gov/research/taxinformation/sales/rot.html',
    pdfUrl: 'https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/sales/documents/sales/crt-61.pdf',
    pages: 1,
    fields: 27,
  },
  IN: {
    kind: 'form',
    number: 'ST-105',
    name: 'General Sales Tax Exemption Certificate',
    officialUrl: 'https://www.in.gov/dor/tax-forms/business/sales-tax-forms/',
    pdfUrl: 'https://forms.in.gov/Download.aspx?id=2717',
    pages: 2,
    fields: 23,
  },
  MA: {
    kind: 'form',
    number: 'ST-4',
    name: 'Sales Tax Resale Certificate',
    revision: 'Rev. 8/16',
    officialUrl: 'https://www.mass.gov/info-details/sales-and-use-tax',
    pdfUrl: 'https://www.mass.gov/doc/form-st-4-sales-tax-resale-certificate/download',
    pages: 1,
    fields: 17,
  },
  NY: {
    kind: 'form',
    number: 'ST-120',
    name: 'Resale Certificate',
    revision: '1/26',
    officialUrl: 'https://www.tax.ny.gov/forms/sales_cur_forms.htm',
    pdfUrl: 'https://www.tax.ny.gov/pdf/current_forms/st/st120_fill_in.pdf',
    pages: 2,
    fields: 25,
  },
  PA: {
    kind: 'form',
    number: 'REV-1220',
    name: 'Pennsylvania Exemption Certificate',
    revision: '07-23',
    officialUrl: 'https://www.revenue.pa.gov/',
    pdfUrl:
      'https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforbusinesses/sut/documents/rev-1220.pdf',
    pages: 2,
    fields: 48,
  },
  TX: {
    kind: 'form',
    number: '01-339',
    name: 'Texas Sales and Use Tax Resale Certificate',
    revision: 'Rev. 4-13/8',
    officialUrl: 'https://comptroller.texas.gov/taxes/sales/forms/',
    pdfUrl: 'https://comptroller.texas.gov/forms/01-339.pdf',
    pages: 2,
    fields: 27,
  },
  VA: {
    kind: 'form',
    number: 'ST-10',
    name: 'Sales and Use Tax Certificate of Exemption',
    revision: 'Rev. 05/26',
    officialUrl: 'https://www.tax.virginia.gov/sales-tax-exemptions',
    pdfUrl:
      'https://www.tax.virginia.gov/sites/default/files/taxforms/exemption-certificates/any/st-10-any.pdf',
    pages: 1,
    fields: 11,
  },
  LA: {
    kind: 'issued',
    how: 'Applied for and renewed through LaTAP, the department’s own portal. A certificate runs for one year from approval, and a seller can check a buyer’s status online rather than hold a piece of paper.',
    officialUrl: 'https://revenue.louisiana.gov/businesses/general-resources/resale-certificate/',
  },
  FL: {
    kind: 'issued',
    how: 'An annual resale certificate issued by the Department of Revenue. A selling dealer also takes a resale authorisation number against it, which is what note 8 on the MTC form is pointing at.',
    officialUrl: 'https://floridarevenue.com/taxes/certificates',
  },
  MS: {
    kind: 'none',
    why: 'There is no certificate. The Department of Revenue states it does not accept or use blanket certificates; a buyer shows something the department issued — a sales tax or seller’s use tax permit, a material purchase certificate, a direct pay permit or a letter ruling.',
    officialUrl: 'https://www.dor.ms.gov/business/business-tax-frequently-asked-questions',
  },
  DC: {
    kind: 'unverified',
    why: 'The Office of Tax and Revenue returns 403 on every page below its root, to a browser and to an in-page request alike, so we could not read the District’s certificate at source and will not describe one from memory.',
  },
};

export const ownCert = (code: string): OwnCert | undefined => OWN_CERTS[code];

/** Jurisdictions with a downloadable blank, and the fields across them. */
export const OWN_FORMS = Object.entries(OWN_CERTS).filter(
  (e): e is [string, Extract<OwnCert, { kind: 'form' }>] => e[1].kind === 'form',
);

export const OWN_FORM_COUNT = OWN_FORMS.length;
export const OWN_FORM_FIELDS = OWN_FORMS.reduce((n, [, f]) => n + f.fields, 0);

/** Taxing jurisdictions absent from the MTC certificate that now have an
 *  answer — from Streamlined membership, their own form, or a documented
 *  reason there is no form. What is left is what a ship 3 would chase. */
export const STILL_UNANSWERED = NEEDS_OWN_FORM.filter(
  (j) => !isSstMember(j.code) && (ownCert(j.code)?.kind ?? 'unverified') === 'unverified',
);
