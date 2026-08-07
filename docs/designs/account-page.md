# The account page — design note

**Status:** approved direction, shipped 2026-08-07.
**Problem:** the page held a name, a plan badge and a billing button. Three cards
of nothing. It also had two real holes that turned out to be legal, not cosmetic.

## The thesis

Every SaaS account page is the same stack of settings, and for most products
that's fine — the account page is plumbing. It shouldn't be for us.

We sell the claim that your files stay on your device. The account page is the
one screen where that claim is either evidenced or quietly undermined, because
it's where someone goes to ask *"hang on — what do you actually have on me?"*
Answering that fully, in plain words, with a button to take it all and a button
to destroy it, is worth more than any privacy badge we could draw.

So the page is a **transparency ledger**, not a settings menu. The organising
question is not "what can I configure" but "what do they hold, and can I leave".

That also means the honest thing is to show the *empty* rows. A ledger that only
lists what exists reads like marketing; one that says "Notes — none" and
"Vault — nothing stored" is doing the same job the zero-byte upload counter does
on the tool pages.

## What research changed

Two findings moved this from a content task to a compliance one.

**We had no data export.** GDPR Article 20 gives people the right to receive
their personal data in a structured, machine-readable format. The ICO is explicit
that this is a request we must be able to satisfy. We couldn't.

**We had no way to delete an account.** Erasure (Art. 17) is a separate right
from portability — exporting doesn't discharge it. There was no path at all,
in the product or by email.

The guidance is blunt that a SaaS which cannot find, export or delete a specific
user's data is not compliant. We're incorporated in Georgia but serve the UK and
EU, and the EU Data Act (fully applicable since September 2025) tightens the
switching obligations further. This isn't a nice-to-have for the roadmap.

The third finding was a UI one: sensitive, irreversible actions belong in a
visually distinct **danger zone** with explicit password re-verification. We
follow that — deletion asks for the password and for the word DELETE, and it
happens immediately rather than "within 30 days", because a promise to delete
later is not the same as deleting.

## Layout

A single column, ordered by how often someone needs each thing — not a sidebar.
A sidebar implies dozens of settings; we have five sections, and pretending
otherwise is the kind of scaffolding that makes a product feel bigger and worse.

```
Your account
  ├── You            name (edit in place), email, member since, how you sign in
  ├── Your plan      plan + what it includes · subscription manager · upgrade
  ├── What we hold   THE LEDGER — every row of yours on our server, counted,
  │                  including the empty ones, with "on your device" stated
  │                  for everything that never reaches us
  ├── Your data      Download everything (JSON) · what the file contains
  └── Danger zone    Change password · Sign out · Delete account for good
```

**Why "What we hold" sits above "Your data":** you have to see the inventory
before the export button means anything. Reversed, the download is just a button.

**Why the ledger names the empty rows:** see the thesis. "Nothing stored" is the
product working, and it should be legible.

## Copy

Plain, and specific about the awkward parts. "Deleting your account removes
everything in the list above. It cannot be undone, and we cannot get it back for
you." Not "this action is permanent."

Where the owner account shows Pro without a Stripe subscription, the page says
so rather than showing a contradiction — the old page managed to display
"Active" and "No paid subscription on this account" in the same card.

## Not built (deliberately)

- **Sessions list / sign out everywhere.** Needs server-side token tracking; our
  JWTs are stateless. Worth doing when there's a reason beyond completeness.
- **2FA.** Real work, and a bigger promise than we can currently keep.
- **Email preferences.** We don't send marketing email. A toggle for a thing that
  doesn't happen is furniture.
