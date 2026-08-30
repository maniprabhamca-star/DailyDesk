import { describe, it, expect } from 'vitest';
import { cliCommand, desktopConfig } from '@/lib/mcp-setup';

// What the button copies IS the product here. If either string is malformed the
// user pastes something broken into a terminal or a config file and gets an
// error with no obvious cause — the exact experience this card exists to end.
const TOKEN = 'ddm_9fK2wQxr7Lm4TbVn8ZaHcDyEuJgPsRoW1i5N3kF6Q0';

describe('what the Connect card copies', () => {
  it('gives Claude Code a command that runs as-is', () => {
    const c = cliCommand(TOKEN);
    expect(c).toContain('claude mcp add');
    // Without --scope user it is registered for one folder only, which is not
    // what anyone means by "connect my account".
    expect(c).toContain('--scope user');
    expect(c).toContain(`-e DIEMDESK_TOKEN=${TOKEN}`);
    // The -- separator must precede the command, or npx's flags are eaten by
    // `claude mcp add` itself.
    expect(c.indexOf('--scope')).toBeLessThan(c.indexOf(' -- '));
    expect(c.trimEnd().endsWith('npx -y diemdesk-mcp')).toBe(true);
    expect(c).not.toContain('\n');
  });

  it('gives Claude Desktop valid JSON with the token already in it', () => {
    const parsed = JSON.parse(desktopConfig(TOKEN));
    expect(parsed.mcpServers.diemdesk.command).toBe('npx');
    expect(parsed.mcpServers.diemdesk.args).toEqual(['-y', 'diemdesk-mcp']);
    expect(parsed.mcpServers.diemdesk.env.DIEMDESK_TOKEN).toBe(TOKEN);
  });

  it('leaves no placeholder for the user to fill in', () => {
    for (const s of [cliCommand(TOKEN), desktopConfig(TOKEN)]) {
      expect(s).not.toMatch(/paste[- ]your|your-token|<token>|xxx/i);
      expect(s).toContain(TOKEN);
    }
  });

  it('survives a token containing base64url characters', () => {
    // base64url uses - and _, which a naive shell or JSON build could mangle.
    const awkward = 'ddm_a-b_c-d_EFG123';
    expect(cliCommand(awkward)).toContain(`DIEMDESK_TOKEN=${awkward}`);
    expect(JSON.parse(desktopConfig(awkward)).mcpServers.diemdesk.env.DIEMDESK_TOKEN).toBe(awkward);
  });
});
