#!/usr/bin/env node
/**
 * MCP server harness — protocol shape and tool wiring, no network, no client.
 *
 * The failure mode this guards against is quiet: a malformed tools/list or a
 * schema missing its required field does not crash, it just means the model
 * never calls the tool and nobody knows why. Run: node test.mjs
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toolList, CONVERSIONS } from './index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0;
const fails = [];
const check = (name, cond, detail) => {
  if (cond) { pass++; return; }
  fails.push(name + (detail ? ' — ' + detail : ''));
};

// ── 1. every tool is well formed ────────────────────────────────────────────
const tools = toolList();
check('exposes tools', tools.length > 0);
for (const t of tools) {
  check(`${t.name}: snake_case name`, /^[a-z][a-z0-9_]*$/.test(t.name), t.name);
  check(`${t.name}: has a description`, typeof t.description === 'string' && t.description.length > 20);
  check(`${t.name}: has an object schema`, t.inputSchema && t.inputSchema.type === 'object');
  if (t.inputSchema?.required) {
    for (const r of t.inputSchema.required) {
      check(`${t.name}: required "${r}" is declared`, !!t.inputSchema.properties?.[r]);
    }
  }
}

// ── 2. names are unique ─────────────────────────────────────────────────────
{
  const seen = new Set();
  for (const t of tools) {
    check(`${t.name} appears once`, !seen.has(t.name));
    seen.add(t.name);
  }
}

// ── 3. every tool says where the work happens ───────────────────────────────
// The whole reason this server is short is that it only carries server-side
// tools. Each description has to be honest about that, because the model repeats
// it to the user.
for (const t of tools) {
  if (t.name === 'list_local_tools') continue;
  const honest = /server|fetched by DiemDesk/i.test(t.description);
  check(`${t.name}: says where it runs`, honest, t.description);
}

// ── 4. accept patterns actually discriminate ────────────────────────────────
for (const c of CONVERSIONS) {
  const pdfIn = c.accept.test('/tmp/a.pdf');
  const docIn = c.accept.test('/tmp/a.docx');
  check(`${c.name}: accept is not everything`, !(pdfIn && docIn), 'accepts both pdf and docx');
}
check('office_to_pdf takes a docx', CONVERSIONS.find((c) => c.name === 'office_to_pdf').accept.test('x.docx'));
check('office_to_pdf refuses a pdf', !CONVERSIONS.find((c) => c.name === 'office_to_pdf').accept.test('x.pdf'));
check('pdf_to_word takes a pdf', CONVERSIONS.find((c) => c.name === 'pdf_to_word').accept.test('x.pdf'));
check('pdf_to_word refuses a docx', !CONVERSIONS.find((c) => c.name === 'pdf_to_word').accept.test('x.docx'));

// ── 5. the real protocol handshake, over stdio ──────────────────────────────
function rpc(requests) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [join(here, 'index.mjs')], { stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('timed out')); }, 10000);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('close', () => {
      clearTimeout(timer);
      resolvePromise(out.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    });
    for (const r of requests) child.stdin.write(JSON.stringify(r) + '\n');
    child.stdin.end();
  });
}

const replies = await rpc([
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_local_tools', arguments: {} } },
  { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'pdf_to_word', arguments: { path: '/definitely/missing.pdf' } } },
]);

const byId = Object.fromEntries(replies.filter((r) => r.id !== undefined).map((r) => [r.id, r]));

check('initialize replies', !!byId[1]?.result);
check('initialize returns a protocol version', byId[1]?.result?.protocolVersion === '2024-11-05', byId[1]?.result?.protocolVersion);
check('initialize declares tools capability', !!byId[1]?.result?.capabilities?.tools);
check('initialize names the server', byId[1]?.result?.serverInfo?.name === 'diemdesk');
check('tools/list replies with the same set', byId[2]?.result?.tools?.length === tools.length, `${byId[2]?.result?.tools?.length} vs ${tools.length}`);
check('a tool call returns content', Array.isArray(byId[3]?.result?.content) && byId[3].result.content[0].type === 'text');
check('list_local_tools points at the website', /diemdesk\.com/.test(byId[3]?.result?.content?.[0]?.text || ''));
check('unknown tool is an isError result, not a crash', byId[4]?.result?.isError === true, JSON.stringify(byId[4]));
check('a missing file is reported, not thrown', byId[5]?.result?.isError === true, JSON.stringify(byId[5]));
check('the missing-file message names the path', /missing\.pdf/.test(byId[5]?.result?.content?.[0]?.text || ''));
check('a notification gets no reply', !replies.some((r) => r.id === undefined && r.result !== undefined));

console.log(`\ndiemdesk-mcp: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('Handshake, tool list and error handling all behave.\n');
