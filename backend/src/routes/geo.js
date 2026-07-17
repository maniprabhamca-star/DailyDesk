// Tiny geo hint for pricing — tells the frontend which currency to show. The signal
// is Cloudflare's CF-IPCountry header (already used for analytics), so there's no
// third-party geo-IP lookup and nothing about the visitor is stored or logged.
//
// This ONLY drives display. It is not identity and not access control — a user can
// always be shown the other currency, and checkout re-derives the price server-side.
const express = require('express');

const router = express.Router();

// Countries billed in INR. Kept explicit (just India for now) so we never guess a
// currency for a market we haven't set up prices + tax for.
const INR_COUNTRIES = new Set(['IN']);

router.get('/', (req, res) => {
  const cc = String(req.headers['cf-ipcountry'] || '').toUpperCase();
  const country = /^[A-Z]{2}$/.test(cc) && cc !== 'XX' && cc !== 'T1' ? cc : null;
  const currency = country && INR_COUNTRIES.has(country) ? 'INR' : 'USD';
  // Cache at the edge per-country; it's not user-specific.
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ country, currency });
});

module.exports = router;
