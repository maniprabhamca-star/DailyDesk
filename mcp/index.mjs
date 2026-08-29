#!/usr/bin/env node
/**
 * DiemDesk MCP server — document tools for Claude, ChatGPT and any MCP client.
 *
 * ── Why this exposes 13 tools and not 114 ───────────────────────────────────
 * Almost everything DiemDesk does runs INSIDE the browser: the file is opened
 * and rebuilt on the user's own device and never reaches us. An MCP server
 * cannot reach those, and we are not going to build server copies of them just
 * to have a longer list — that would mean uploading files that currently never
 * move, which is the opposite of the product.
 *
 * So this exposes exactly the tools that already ran on our servers: the Office
 * and PDF conversions, OCR, and webpage capture. Everything else stays where it
 * is. A shorter list that tells the truth about where your file goes is worth
 * more than a longer one that quietly changes the answer.
 *
 * ── Protocol ───────────────────────────────────────────────────────────────
 * Speaks MCP over stdio using JSON-RPC 2.0 with no dependencies, so `npx` can
 * run it without installing a tree. Implements initialize, tools/list and
 * tools/call — the three methods a client needs to use tools.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

const API = (process.env.DIEMDESK_API || 'https://diemdesk.com').replace(/\/+$/, '');
const TOKEN = process.env.DIEMDESK_TOKEN || '';
const PROTOCOL_VERSION = '2024-11-05';
const MAX_BYTES = 100 * 1024 * 1024;

// ── the tools ───────────────────────────────────────────────────────────────
// Each entry maps to an endpoint that already exists. `accept` is what the
// endpoint takes, and is checked here so a wrong file fails locally with a
// useful message rather than after a 100 MB upload.
const CONVERSIONS = [
  { name: 'office_to_pdf', path: '/api/convert/office-to-pdf', out: 'pdf', accept: /\.(docx?|odt|rtf|txt|html?|xlsx?|ods|csv|pptx?|ppsx?|odp|odg)$/i,
    title: 'Office file to PDF', desc: 'Convert Word, Excel, PowerPoint, OpenDocument, RTF, CSV or HTML to PDF.' },
  { name: 'pdf_to_word', path: '/api/convert/pdf-to-word', out: 'docx', accept: /\.pdf$/i,
    title: 'PDF to Word', desc: 'Convert a PDF into an editable .docx, keeping the layout as far as possible.' },
  { name: 'pdf_to_powerpoint', path: '/api/convert/pdf-to-powerpoint', out: 'pptx', accept: /\.pdf$/i,
    title: 'PDF to PowerPoint', desc: 'Convert a PDF into editable .pptx slides.' },
  { name: 'pdf_to_rtf', path: '/api/convert/pdf-to-rtf', out: 'rtf', accept: /\.pdf$/i,
    title: 'PDF to RTF', desc: 'Convert a PDF into rich text any word processor opens.' },
  { name: 'pdf_to_odt', path: '/api/convert/pdf-to-odt', out: 'odt', accept: /\.pdf$/i,
    title: 'PDF to ODT', desc: 'Convert a PDF into an OpenDocument text file.' },
  { name: 'pdf_to_pdfa', path: '/api/convert/pdf-to-pdfa', out: 'pdf', accept: /\.pdf$/i,
    title: 'PDF to PDF/A', desc: 'Convert a PDF to the PDF/A archival format that records offices and courts require.' },
];

/** JSON Schema shared by every file-in / file-out tool. */
const fileSchema = (what) => ({
  type: 'object',
  properties: {
    path: { type: 'string', description: `Absolute path to the ${what} on this machine.` },
    outputPath: { type: 'string', description: 'Where to write the result. Defaults to alongside the input.' },
  },
  required: ['path'],
});

function toolList() {
  const tools = CONVERSIONS.map((c) => ({
    name: c.name,
    description: `${c.desc} Runs on DiemDesk's server; the file is deleted immediately after conversion.`,
    inputSchema: fileSchema(c.name.startsWith('pdf_') ? 'PDF' : 'file'),
  }));

  tools.push({
    name: 'ocr_pdf',
    description: 'Make a scanned PDF searchable by adding a text layer, and return the recognised text. Runs on DiemDesk\'s server; the file is deleted immediately after.',
    inputSchema: fileSchema('scanned PDF'),
  });

  tools.push({
    name: 'webpage_to_pdf',
    description: 'Capture a live web page as a PDF. The page is fetched by DiemDesk\'s server, not by your machine.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The page to capture. http or https only.' },
        outputPath: { type: 'string', description: 'Where to write the PDF. Defaults to the current directory.' },
      },
      required: ['url'],
    },
  });

  tools.push({
    name: 'list_local_tools',
    description: 'List the DiemDesk tools that are NOT available here because they run inside the browser on the user\'s own device and never upload the file. Use this to tell the user where to go for those.',
    inputSchema: { type: 'object', properties: {} },
  });

  return tools;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });

async function readInput(p, accept, label) {
  const abs = resolve(p);
  if (accept && !accept.test(abs)) {
    throw new Error(`${basename(abs)} is not a file this tool accepts. Expected ${label}.`);
  }
  const buf = await readFile(abs).catch(() => { throw new Error(`Could not read ${abs}. Check the path.`); });
  if (buf.length > MAX_BYTES) throw new Error(`${basename(abs)} is ${(buf.length / 1048576).toFixed(1)} MB, over the 100 MB limit.`);
  return { abs, buf };
}

function outPath(given, inputAbs, ext) {
  if (given) return resolve(given);
  const dir = inputAbs ? dirname(inputAbs) : process.cwd();
  const stem = inputAbs ? basename(inputAbs, extname(inputAbs)) : 'output';
  return join(dir, `${stem}.${ext}`);
}

async function post(path, body, headers = {}) {
  const r = await fetch(API + path, {
    method: 'POST',
    body,
    headers: { ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}), ...headers },
  });
  if (!r.ok) {
    let msg = `${r.status}`;
    try {
      const j = await r.json();
      msg = j.message || j.error || msg;
      if (j.error === 'pro-required') msg = 'This tool needs a DiemDesk Pro account. Set DIEMDESK_TOKEN to your API token.';
      if (j.error === 'quota') msg = 'Daily free conversion limit reached. Pro removes the cap.';
    } catch { /* keep the status */ }
    throw new Error(msg);
  }
  return r;
}

// ── the calls ───────────────────────────────────────────────────────────────
async function runConversion(c, args) {
  const label = c.accept.source.includes('pdf$') ? 'a PDF' : 'an Office or text document';
  const { abs, buf } = await readInput(args.path, c.accept, label);
  const form = new FormData();
  form.append('file', new Blob([buf]), basename(abs));
  const r = await post(c.path, form);
  const out = outPath(args.outputPath, abs, c.out);
  await writeFile(out, Buffer.from(await r.arrayBuffer()));
  return ok(`Converted to ${out}`);
}

async function runOcr(args) {
  const { abs, buf } = await readInput(args.path, /\.pdf$/i, 'a PDF');
  const form = new FormData();
  form.append('file', new Blob([buf]), basename(abs));
  const r = await post('/api/ocr', form);
  const type = r.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const j = await r.json();
    return ok(j.text ? `Recognised text:\n\n${String(j.text).slice(0, 20000)}` : 'No text was recognised in that scan.');
  }
  const out = outPath(args.outputPath, abs, 'ocr.pdf');
  await writeFile(out, Buffer.from(await r.arrayBuffer()));
  return ok(`Searchable PDF written to ${out}`);
}

async function runWebpage(args) {
  const url = String(args.url || '');
  if (!/^https?:\/\//i.test(url)) throw new Error('Only http and https URLs can be captured.');
  const r = await post('/api/convert/webpage-to-pdf', JSON.stringify({ url }), { 'content-type': 'application/json' });
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'page'; } })();
  const out = args.outputPath ? resolve(args.outputPath) : join(process.cwd(), `${host}.pdf`);
  await writeFile(out, Buffer.from(await r.arrayBuffer()));
  return ok(`Captured ${url} to ${out}`);
}

function localToolsAnswer() {
  return ok([
    'These DiemDesk tools are NOT available through MCP, on purpose.',
    '',
    'They run inside the browser on the user\'s own machine, so the file never',
    'reaches a server at all. Exposing them here would mean uploading files that',
    'currently never move, which is the opposite of the point of them.',
    '',
    'Among them: merge, split, compress, rotate, crop, redact, sign, watermark,',
    'flatten, edit text, remove metadata, page numbers, Bates numbering, bank',
    'statement to Excel, PDF to Excel, PDF to JPG, image tools, QR tools, and the',
    'developer and data converters.',
    '',
    'Send the user to https://diemdesk.com — the tool runs in their browser and',
    'nothing is uploaded.',
  ].join('\n'));
}

async function callTool(name, args = {}) {
  const conv = CONVERSIONS.find((c) => c.name === name);
  if (conv) return runConversion(conv, args);
  if (name === 'ocr_pdf') return runOcr(args);
  if (name === 'webpage_to_pdf') return runWebpage(args);
  if (name === 'list_local_tools') return localToolsAnswer();
  throw new Error(`Unknown tool: ${name}`);
}

// ── JSON-RPC over stdio ─────────────────────────────────────────────────────
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }

async function handle(req) {
  const { id, method, params } = req;
  // Notifications have no id and take no reply.
  const reply = (result) => (id === undefined ? undefined : send({ jsonrpc: '2.0', id, result }));

  if (method === 'initialize') {
    return reply({
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'diemdesk', version: '0.1.0' },
    });
  }
  if (method === 'tools/list') return reply({ tools: toolList() });
  if (method === 'tools/call') {
    try {
      return reply(await callTool(params?.name, params?.arguments || {}));
    } catch (e) {
      // A failed tool call is a RESULT with isError, not a protocol error — the
      // client shows the message to the model so it can try something else.
      return reply(fail(e instanceof Error ? e.message : String(e)));
    }
  }
  if (method === 'ping') return reply({});
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
}

if (process.argv.includes('--list')) {
  // Handy for the docs and for checking an install without an MCP client.
  console.log(toolList().map((t) => `${t.name}\n  ${t.description}`).join('\n\n'));
} else {
  const rl = createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) return;
    let req;
    try { req = JSON.parse(text); } catch { return; }
    try { await handle(req); } catch (e) {
      if (req.id !== undefined) send({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: String(e && e.message || e) } });
    }
  });
}

export { toolList, callTool, CONVERSIONS };
