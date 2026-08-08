# @diemdesk/pdf

PDF operations that run in your users' browser. The file never reaches a server — not ours, not yours.

```bash
npm i @diemdesk/pdf pdf-lib
```

```ts
import { merge, extractPages, info } from '@diemdesk/pdf';

const file = await input.files[0].arrayBuffer();

const { pages } = await info(file);          // 12
const firstThree = await extractPages(file, '1-3');
const combined  = await merge([fileA, fileB]);

// It's a Uint8Array. Hand it back to the user however you like.
const url = URL.createObjectURL(new Blob([combined], { type: 'application/pdf' }));
```

## Why this instead of a PDF API

Every other PDF service in this space is a REST endpoint. Your user's document travels to a third party, is processed, and comes back. That's a perfectly good design right up until the document is a medical record, a client's bank statement or an unsigned contract — at which point "we delete it after an hour" is a promise about someone's conduct, not a limit on their access, and your compliance review has to reason about a vendor your user never chose.

There is no endpoint here. No API key, no upload, no per-call bill.

|  | REST PDF APIs | `@diemdesk/pdf` |
|---|---|---|
| Where the file goes | their servers | nowhere |
| Your DPA / BAA burden | a subprocessor to declare | none to declare |
| Cost per operation | metered | zero — it's your user's CPU |
| Works offline | no | yes |
| Max file size | their plan limit | your user's memory |

## What it does

| Function | |
|---|---|
| `info(bytes)` | page count, page sizes, title/author/producer |
| `merge(files[])` | join documents in order |
| `extractPages(bytes, sel)` | keep only what you select |
| `deletePages(bytes, sel)` | drop what you select |
| `rotate(bytes, {pages, degrees})` | turn pages, relative to current rotation |
| `removeMetadata(bytes)` | clear title, author, producer, timestamps |
| `splitEvery(bytes, n)` | cut into fixed-size chunks |
| `parsePageSelection(spec, count)` | `"1-3, 7, 12-"` → zero-based indices |

Page selections take either a string a person would type (`'1-3, 7'`, `'12-'`, `'all'`) or explicit one-based numbers (`[1, 5]`). One-based going in because that's what's printed on the page; zero-based internally because that's what the PDF wants. That boundary lives in one tested function rather than being re-derived at each call site.

## What it does not do, on purpose

- **Bookmarks and form fields are not carried through `merge`.** pdf-lib copies pages, not the document-level structures that point at them, and a half-copied outline is worse than none.
- **`removeMetadata` does not touch page content.** It clears the information dictionary. Text visible on the page stays visible — removing *that* is redaction, which is a far more careful operation.
- **No encryption or password removal.** Not supported here; don't fake it.
- **No OCR, no rasterisation, no conversion to Office formats.** Those need heavy WASM or a server, and shipping them silently would betray the point of the package.

## The honest trade

Browser memory is not infinite, and this is synchronous work on the main thread unless you move it into a Worker. For files in the tens of megabytes that's a non-issue. For a 500MB scan it isn't — put it in a Worker and tell your user what's happening.

```ts
// worker.ts
import { merge } from '@diemdesk/pdf';
self.onmessage = async (e) => self.postMessage(await merge(e.data), [/* transfer */]);
```

## Errors

Everything throws `PdfError` with a `code` you can branch on: `bad-input`, `bad-selection`, `encrypted`, `empty-result`. The messages are written to be shown to a person as-is.

```ts
import { PdfError } from '@diemdesk/pdf';

try { await extractPages(file, '99'); }
catch (e) {
  if (e instanceof PdfError && e.code === 'bad-selection') showToast(e.message);
  else throw e;
}
```

## Requirements

`pdf-lib` is a peer dependency — you likely already have it, and if you don't, you should own the version. Works in any browser with ES2020. No DOM APIs beyond `Uint8Array`, so it runs in a Worker or in Node 18+ too.

## Licence

See [LICENSE](./LICENSE). Free for evaluation and non-commercial use; commercial use needs a licence key from [diemdesk.com/developers](https://diemdesk.com/developers).

---

Built by [DiemDesk](https://diemdesk.com), where the same engines power 67 tools that never upload your files.
