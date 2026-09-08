// Turbopack has no equivalent of webpack's `alias: { canvas: false }` — it needs
// a real module to point at. pdfjs-dist optionally requires "canvas" for
// rendering under Node; in the browser it is never reached, and shipping the
// real package would pull a native dependency into a client bundle for nothing.
module.exports = {};
