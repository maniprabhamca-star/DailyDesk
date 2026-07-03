var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// frontend/lib/pdf-flatten.ts
var pdf_flatten_exports = {};
__export(pdf_flatten_exports, {
  scanFlattenables: () => scanFlattenables
});
module.exports = __toCommonJS(pdf_flatten_exports);
var import_pdf_lib = require("pdf-lib");
async function scanFlattenables(bytes) {
  let doc;
  try {
    doc = await import_pdf_lib.PDFDocument.load(bytes);
  } catch (e) {
    if (e instanceof Error && /encrypted/i.test(e.message)) {
      return { pages: 0, fields: 0, annotations: 0, encrypted: true };
    }
    throw e;
  }
  let fields = 0;
  try {
    fields = doc.getForm().getFields().length;
  } catch {
  }
  let annotations = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!(annots instanceof import_pdf_lib.PDFArray)) continue;
    for (let i = 0; i < annots.size(); i++) {
      try {
        const dict = doc.context.lookup(annots.get(i));
        if (!(dict instanceof import_pdf_lib.PDFDict)) continue;
        const subtype = dict.get(import_pdf_lib.PDFName.of("Subtype"));
        if (subtype !== import_pdf_lib.PDFName.of("Widget")) annotations++;
      } catch {
      }
    }
  }
  return { pages: doc.getPageCount(), fields, annotations, encrypted: false };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  scanFlattenables
});
