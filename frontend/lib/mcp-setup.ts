// What the "Connect Claude" card copies.
//
// Kept out of the component because this IS the deliverable: if either string
// is malformed, someone pastes a broken command into a terminal or a broken
// config into a JSON file and gets an error with no obvious cause — the exact
// experience the card exists to end. Plain functions here can be tested; JSX
// cannot, under this project's vitest setup.

/** Claude Code: a single line that registers the server for every project. */
export const cliCommand = (token: string) =>
  `claude mcp add --scope user diemdesk -e DIEMDESK_TOKEN=${token} -- npx -y diemdesk-mcp`;

/** Claude Desktop: the block that goes in claude_desktop_config.json. */
export const desktopConfig = (token: string) => `{
  "mcpServers": {
    "diemdesk": {
      "command": "npx",
      "args": ["-y", "diemdesk-mcp"],
      "env": { "DIEMDESK_TOKEN": "${token}" }
    }
  }
}`;
