# diemdesk-mcp

Document tools for Claude, ChatGPT and any MCP client. Say *"turn this into a
PDF"* and it happens — to a real file on your own disk, without opening a
browser.

```bash
claude mcp add diemdesk -- npx -y diemdesk-mcp
```

Or, for Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "diemdesk": {
      "command": "npx",
      "args": ["-y", "diemdesk-mcp"]
    }
  }
}
```

Restart the app completely — Claude Desktop reads that file once, at startup.

## The nine tools

| Tool | What it does |
| --- | --- |
| `office_to_pdf` | Word, Excel, PowerPoint, OpenDocument, RTF, CSV or HTML → PDF |
| `pdf_to_word` | PDF → editable `.docx` |
| `pdf_to_powerpoint` | PDF → editable `.pptx` |
| `pdf_to_rtf` | PDF → rich text |
| `pdf_to_odt` | PDF → OpenDocument text |
| `pdf_to_pdfa` | PDF → PDF/A, the archival format |
| `ocr_pdf` | Scanned PDF → searchable, plus the recognised text |
| `webpage_to_pdf` | A live URL → PDF |
| `list_local_tools` | Asks what is deliberately *not* here, and why |

## Why nine and not a hundred

DiemDesk has well over a hundred tools, and most of them run **in your browser**
— merging, splitting, compressing, redacting, signing. Those never touch a
server, which is the entire point of them, so there is nothing for an MCP server
to call. Exposing them here would mean uploading your files to run work that
already runs locally, and privately, on your own machine.

What is left is the set that genuinely needs a server: LibreOffice for the Office
conversions, Ghostscript for PDF/A, Tesseract for OCR, headless Chrome for web
capture. That is these nine. `list_local_tools` will tell your assistant about
the rest so it can point you at the right page instead of guessing.

## Privacy

Files are sent to DiemDesk's server, converted, and **deleted immediately** —
nothing is stored, and nothing is used for training. If that is not acceptable
for a given document, use the on-device tools at
[diemdesk.com](https://diemdesk.com) instead; they never leave your machine.

## Pro

Free accounts get a daily allowance on the server-side conversions. To lift it,
put your token in the config:

```json
{
  "mcpServers": {
    "diemdesk": {
      "command": "npx",
      "args": ["-y", "diemdesk-mcp"],
      "env": { "DIEMDESK_TOKEN": "paste-your-token-here" }
    }
  }
}
```

## Requirements

Node 18 or newer. No other dependencies — the server is a single file.

Full setup guide, troubleshooting and worked examples:
**<https://diemdesk.com/mcp-server>**

MIT licensed.
