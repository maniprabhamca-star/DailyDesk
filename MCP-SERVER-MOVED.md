# The MCP server moved out of this repo

It lives at **https://github.com/maniprabhamca-star/diemdesk-mcp** and ships as
[`diemdesk-mcp`](https://www.npmjs.com/package/diemdesk-mcp) on npm.

It was split out because this repository is the product and is not open source,
while the MCP server is MIT and meant to be read and forked. Directories grade
the repository a server points at: sitting here it scored **license F** — "MCP
servers without a LICENSE cannot be installed" — and inherited a failing CI
signal from an end-to-end suite that has nothing to do with it. In its own
repository it scores **A**.

Adding an MIT LICENSE here would have fixed that grade by granting anyone the
right to copy DiemDesk, which is the wrong trade.

The copy that used to be at `mcp/` is deleted rather than left in place: two
copies of the same three files is an invitation to edit the one nobody
publishes.

Setup guide: **https://diemdesk.com/mcp-server**
