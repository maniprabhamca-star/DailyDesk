// Quick-win "wrong format" helper: when a tool is handed a file it can't take,
// suggest the RIGHT DiemDesk tool instead of a dead-end error — the forgiving UX
// Smallpdf gets from server-side auto-convert, but done our way (client-side,
// privacy intact: we route, we don't silently upload).
export type ToolSuggestion = { label: string; href: string; note: string };

const MAP: Array<{ re: RegExp; s: ToolSuggestion }> = [
  { re: /\.(jpe?g|png|webp|gif|bmp)$/i, s: { label: 'Compress Image', href: '/compress-image', note: 'an image' } },
  { re: /\.(heic|heif)$/i, s: { label: 'HEIC to JPG', href: '/heic-to-jpg', note: 'a HEIC photo' } },
  { re: /\.(docx?|rtf|odt)$/i, s: { label: 'Word to PDF', href: '/word-to-pdf', note: 'a Word document' } },
  { re: /\.(xlsx?|csv|ods)$/i, s: { label: 'Excel to PDF', href: '/excel-to-pdf', note: 'a spreadsheet' } },
  { re: /\.(pptx?|odp)$/i, s: { label: 'PowerPoint to PDF', href: '/powerpoint-to-pdf', note: 'a presentation' } },
  { re: /\.(html?|txt)$/i, s: { label: 'HTML to PDF', href: '/html-to-pdf', note: 'an HTML or text file' } },
  { re: /\.(mp4|webm|mov|m4v|avi|mkv|ogg)$/i, s: { label: 'Compress Video', href: '/compress-video', note: 'a video' } },
];

/** The best DiemDesk tool for a file that the current tool can't handle, or null. */
export function suggestToolForFile(name: string): ToolSuggestion | null {
  for (const m of MAP) if (m.re.test(name)) return m.s;
  return null;
}
