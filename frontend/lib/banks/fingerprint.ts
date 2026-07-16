// Bank fingerprinting for the Statement Converter — decide WHICH bank a statement
// came from, so the right column parser can run. Pure (no imports) → unit-testable
// headlessly, like lib/table-extract.ts.
//
// Signals, strongest first:
//   1. IFSC code      — `SBIN0001234`. The bank's own IFSC is printed in the header
//                       and the 4-letter prefix is issued by RBI, so it's definitive.
//   2. Brand name     — "STATE BANK OF INDIA", "HDFC BANK", …
//   3. Website / CIN  — onlinesbi.sbi, hdfcbank.com, …
//   4. Column headers — "Withdrawal Amt.", "Chq./Ref.No.", … (layout signature)
//
// ⚠ THE FALSE-POSITIVE TRAP: a narration line like "NEFT/HDFC BANK/..." appears in
// OTHER banks' statements all the time. So signals found in the HEADER REGION (the
// top of page 1, where the issuing bank identifies itself) are weighted far higher
// than the same string found anywhere in the body. Never fingerprint on body text
// alone. See the regression test for exactly this case.
//
// ⚠ HEADER SIGNATURES are best-effort until validated against real samples per bank
// (the spec's critical path). IFSC + brand name carry the detection today; the
// header patterns only break ties and add confidence.

export type BankId =
  | 'sbi' | 'hdfc' | 'icici' | 'axis' | 'kotak'
  | 'pnb' | 'bob' | 'canara' | 'union' | 'idfc' | 'yes';

export type BankSpec = {
  id: BankId;
  name: string;
  ifsc: string[];       // RBI-issued IFSC prefixes (first 4 chars)
  names: RegExp[];      // brand-name patterns
  sites?: RegExp[];     // website / CIN strings
  headers?: RegExp[];   // column-header layout signature
};

export type BankMatch = {
  id: BankId;
  name: string;
  confidence: number;   // 0–1
  signals: string[];    // what actually fired (shown in UI + used for debugging)
};

// Weights — an IFSC in the header is near-proof; a brand name in the body is weak.
const W = { ifsc: 6, name: 4, site: 3, header: 2 };
const HEADER_BOOST = 2.0;  // signal found where the bank identifies itself
const BODY_PENALTY = 0.25; // same signal found only in transaction rows
const MIN_SCORE = 5;       // below this we don't claim a bank (fall back to generic)

export const BANKS: BankSpec[] = [
  {
    id: 'sbi', name: 'State Bank of India',
    ifsc: ['SBIN'],
    names: [/STATE\s+BANK\s+OF\s+INDIA/, /\bSBI\b/],
    sites: [/ONLINESBI/, /SBI\.CO\.IN/, /SBI\.BANK\.IN/],
    headers: [/TXN\s*DATE/, /VALUE\s*DATE/, /REF\s*NO\.?\s*\/?\s*CHEQUE\s*NO/],
  },
  {
    id: 'hdfc', name: 'HDFC Bank',
    ifsc: ['HDFC'],
    names: [/HDFC\s+BANK/],
    sites: [/HDFCBANK\.COM/],
    headers: [/NARRATION/, /CHQ\.?\s*\/?\s*REF\.?\s*NO/, /WITHDRAWAL\s+AMT/, /DEPOSIT\s+AMT/, /CLOSING\s+BALANCE/],
  },
  {
    id: 'icici', name: 'ICICI Bank',
    ifsc: ['ICIC'],
    names: [/ICICI\s+BANK/],
    sites: [/ICICIBANK\.COM/],
    headers: [/TRANSACTION\s+REMARKS/, /WITHDRAWAL\s+AMOUNT/, /DEPOSIT\s+AMOUNT/, /CHEQUE\s+NUMBER/],
  },
  {
    id: 'axis', name: 'Axis Bank',
    ifsc: ['UTIB'],
    names: [/AXIS\s+BANK/],
    sites: [/AXISBANK\.COM/],
    headers: [/TRAN\s+DATE/, /PARTICULARS/, /CHQNO/, /\bINIT\.?\s*BR\b/],
  },
  {
    id: 'kotak', name: 'Kotak Mahindra Bank',
    ifsc: ['KKBK'],
    names: [/KOTAK\s+MAHINDRA\s+BANK/, /\bKOTAK\b/],
    sites: [/KOTAK\.COM/],
    headers: [/WITHDRAWAL\s*\(\s*DR\s*\)/, /DEPOSIT\s*\(\s*CR\s*\)/, /CHQ\s*\/\s*REF\s*NO/],
  },
  {
    id: 'pnb', name: 'Punjab National Bank',
    ifsc: ['PUNB'],
    names: [/PUNJAB\s+NATIONAL\s+BANK/],
    sites: [/PNBINDIA\.IN/, /NETPNB\.COM/],
    headers: [/INSTRUMENT\s*(NO|ID)/, /\bDEBIT\b.*\bCREDIT\b.*\bBALANCE\b/],
  },
  {
    id: 'bob', name: 'Bank of Baroda',
    ifsc: ['BARB'],
    names: [/BANK\s+OF\s+BARODA/],
    sites: [/BANKOFBARODA/, /BOBIBANKING/],
    headers: [/CHEQUE\s*NO/, /\bWITHDRAWALS?\b/, /\bDEPOSITS?\b/],
  },
  {
    id: 'canara', name: 'Canara Bank',
    ifsc: ['CNRB'],
    names: [/CANARA\s+BANK/],
    sites: [/CANARABANK\.COM/, /CANARABANK\.IN/],
    headers: [/POST\s*DATE/, /VALUE\s*DATE/, /CHEQUE\s*NO/],
  },
  {
    id: 'union', name: 'Union Bank of India',
    ifsc: ['UBIN'],
    names: [/UNION\s+BANK\s+OF\s+INDIA/],
    sites: [/UNIONBANKOFINDIA/, /UNIONBANKONLINE/],
    headers: [/TRANSACTION\s+DATE/, /\bREMARKS?\b/, /\bBALANCE\b/],
  },
  {
    id: 'idfc', name: 'IDFC FIRST Bank',
    ifsc: ['IDFB'],
    names: [/IDFC\s+FIRST\s+BANK/, /\bIDFC\b/],
    sites: [/IDFCFIRSTBANK\.COM/],
    headers: [/PARTICULARS/, /\bDEBIT\b/, /\bCREDIT\b/],
  },
  {
    id: 'yes', name: 'YES Bank',
    ifsc: ['YESB'],
    names: [/YES\s+BANK/],
    sites: [/YESBANK\.IN/],
    headers: [/\bDESCRIPTION\b/, /\bWITHDRAWALS?\b/, /\bDEPOSITS?\b/],
  },
];

const norm = (s: string) => (s || '').toUpperCase().replace(/\s+/g, ' ');

// A real IFSC is 4 letters + '0' + 6 alphanumerics.
const ifscRe = (prefix: string) => new RegExp(`\\b${prefix}0[A-Z0-9]{6}\\b`);

/**
 * Identify the issuing bank.
 * @param fullText  all text from the statement (page 1 is enough)
 * @param headerText  the top-of-page-1 region where the bank identifies itself.
 *   Strongly recommended — without it, body mentions of other banks can mislead.
 *   Defaults to the first 1200 chars of fullText.
 */
export function fingerprintBank(fullText: string, headerText?: string): BankMatch | null {
  const full = norm(fullText);
  const head = norm(headerText ?? fullText.slice(0, 1200));
  if (!full.trim()) return null;

  // Score a signal by WHERE it appears: header = authoritative, body-only = weak.
  const hit = (re: RegExp, weight: number, label: string, out: string[]): number => {
    if (re.test(head)) { out.push(label); return weight * HEADER_BOOST; }
    if (re.test(full)) { out.push(`${label} (body)`); return weight * BODY_PENALTY; }
    return 0;
  };

  const scored = BANKS.map((b) => {
    const signals: string[] = [];
    let score = 0;
    for (const p of b.ifsc) score += hit(ifscRe(p), W.ifsc, `IFSC ${p}`, signals);
    for (const re of b.names) score += hit(re, W.name, 'name', signals);
    for (const re of b.sites || []) score += hit(re, W.site, 'website', signals);
    // Header/column signatures only ever count from the header region — a body match
    // of a generic word like "BALANCE" means nothing.
    for (const re of b.headers || []) if (re.test(head)) { score += W.header; signals.push('layout'); }
    return { b, score, signals: Array.from(new Set(signals)) };
  }).sort((x, y) => y.score - x.score);

  const best = scored[0];
  if (!best || best.score < MIN_SCORE) return null;

  // Confidence reflects both absolute strength and how clearly it beat the runner-up
  // (two banks scoring alike = we're not sure, so don't pretend to be).
  const second = scored[1]?.score ?? 0;
  const margin = best.score > 0 ? (best.score - second) / best.score : 0;
  const confidence = Math.max(0, Math.min(1, (Math.min(best.score / 14, 1) * 0.65) + (margin * 0.35)));

  return { id: best.b.id, name: best.b.name, confidence: Number(confidence.toFixed(2)), signals: best.signals };
}

/** Mask an account number for display/logs — never show it in full. */
export function maskAccount(acc: string): string {
  const d = (acc || '').replace(/\s/g, '');
  if (d.length < 5) return d ? '••••' : '';
  return `••••${d.slice(-4)}`;
}

export const getBank = (id: BankId): BankSpec | undefined => BANKS.find((b) => b.id === id);
