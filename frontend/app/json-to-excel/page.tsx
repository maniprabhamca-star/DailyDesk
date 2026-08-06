import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SheetConvertTool } from '@/components/tools/sheet-convert-tool';

export const metadata: Metadata = {
  title: 'JSON to Excel — Convert JSON to XLSX or CSV | DiemDesk',
  description: 'Turn a JSON array into a spreadsheet — nested fields flattened into columns, nothing uploaded. Runs on your device. Free, no signup.',
  alternates: { canonical: '/json-to-excel' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'JSON to Excel — private, in your browser',
    description: 'Convert a JSON array to .xlsx or CSV on your device — nested fields flattened, nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop a .json file or paste the JSON — an array of records, or an object with the array inside it.',
  'Every field becomes a column. Nested objects flatten to dotted names like address.city, so nothing disappears.',
  'Check the grid, then download .xlsx or CSV — all in your browser, free.',
];

const faqs = [
  { q: 'What shape of JSON does it expect?', a: 'An array of objects — the shape almost every API returns. If your JSON is an object with the array inside it (a data, results or items key), we find the list and use that, so you can usually paste an API response straight in without editing it first.' },
  { q: 'What happens to nested objects?', a: 'They flatten into dotted column names: {"address":{"city":"Chennai"}} becomes a column called address.city. A spreadsheet has no second dimension to nest into, and flattening keeps every value visible instead of dumping raw JSON into one cell.' },
  { q: 'And arrays inside a record?', a: 'A list of plain values joins with semicolons, so ["red","blue"] reads as red; blue. A list of objects is kept as JSON text in the cell — squashing it would lose data, and we would rather it be ugly than wrong.' },
  { q: 'What if records have different fields?', a: 'The columns are the union of every field found, in the order they first appear, and a record missing one just gets an empty cell. Nothing is dropped because the first record didn’t happen to have it.' },
  { q: 'Is my data uploaded?', a: 'No. The JSON is parsed and the spreadsheet is written in this browser tab. That matters — JSON exports tend to be the raw customer records, and most online converters post them to a server.' },
  { q: 'Can I go back the other way?', a: 'Yes — pick .json as the output format here to turn a sheet back into records, or use CSV to JSON at /csv-to-json for text-only work.' },
];

export default function JsonToExcelPage() {
  return (
    <PdfToolPage
      title="JSON to Excel"
      description="Turn a JSON array into a spreadsheet — nested fields flattened into readable columns, ready for .xlsx or CSV. It runs in your browser, so your data is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <SheetConvertTool
        from="json"
        to={['xlsx', 'csv', 'json']}
        dropTitle="Drop a JSON file"
        dropHint="an array of records becomes rows — read on your device, never uploaded"
        pasteHint={'Paste JSON here, e.g.\n[\n  { "name": "Priya", "team": "Design", "address": { "city": "Chennai" } },\n  { "name": "Sam", "team": "Engineering", "address": { "city": "Leeds" } }\n]'}
      />
    </PdfToolPage>
  );
}
