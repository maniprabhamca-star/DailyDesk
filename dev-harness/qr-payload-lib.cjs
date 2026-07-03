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

// frontend/lib/qr-payload.ts
var qr_payload_exports = {};
__export(qr_payload_exports, {
  EMPTY_FIELDS: () => EMPTY_FIELDS,
  buildPayload: () => buildPayload,
  missingHint: () => missingHint,
  payloadLabel: () => payloadLabel
});
module.exports = __toCommonJS(qr_payload_exports);
var EMPTY_FIELDS = {
  link: "https://dailydesk.app",
  text: "",
  wifi: { ssid: "", password: "", security: "WPA", hidden: false },
  email: { to: "", subject: "", body: "" },
  phone: "",
  sms: { number: "", message: "" },
  vcard: { firstName: "", lastName: "", phone: "", email: "", org: "", title: "", url: "" }
};
var wifiEsc = (s) => s.replace(/([\\;,:"])/g, "\\$1");
var vcardEsc = (s) => s.replace(/([\\,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
function buildPayload(type, f) {
  switch (type) {
    case "link":
      return f.link.trim();
    case "text":
      return f.text;
    case "wifi": {
      const w = f.wifi;
      if (!w.ssid.trim()) return "";
      let s = `WIFI:T:${w.security};S:${wifiEsc(w.ssid)};`;
      if (w.security !== "nopass" && w.password) s += `P:${wifiEsc(w.password)};`;
      if (w.hidden) s += "H:true;";
      return s + ";";
    }
    case "email": {
      const e = f.email;
      if (!e.to.trim()) return "";
      const params = [];
      if (e.subject) params.push(`subject=${encodeURIComponent(e.subject)}`);
      if (e.body) params.push(`body=${encodeURIComponent(e.body)}`);
      return `mailto:${e.to.trim()}${params.length ? "?" + params.join("&") : ""}`;
    }
    case "phone":
      return f.phone.trim() ? `tel:${f.phone.replace(/[^\d+]/g, "")}` : "";
    case "sms": {
      const s = f.sms;
      if (!s.number.trim()) return "";
      return `SMSTO:${s.number.replace(/[^\d+]/g, "")}:${s.message}`;
    }
    case "vcard": {
      const v = f.vcard;
      if (!v.firstName.trim() && !v.lastName.trim()) return "";
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      lines.push(`N:${vcardEsc(v.lastName)};${vcardEsc(v.firstName)};;;`);
      lines.push(`FN:${vcardEsc([v.firstName, v.lastName].filter(Boolean).join(" "))}`);
      if (v.org) lines.push(`ORG:${vcardEsc(v.org)}`);
      if (v.title) lines.push(`TITLE:${vcardEsc(v.title)}`);
      if (v.phone) lines.push(`TEL;TYPE=CELL:${vcardEsc(v.phone)}`);
      if (v.email) lines.push(`EMAIL:${vcardEsc(v.email)}`);
      if (v.url) lines.push(`URL:${vcardEsc(v.url)}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
  }
}
function payloadLabel(type, f) {
  switch (type) {
    case "link":
      return f.link;
    case "text":
      return f.text || "text";
    case "wifi":
      return f.wifi.ssid ? `wifi-${f.wifi.ssid}` : "wifi";
    case "email":
      return f.email.to ? `email-${f.email.to}` : "email";
    case "phone":
      return f.phone ? `call-${f.phone}` : "phone";
    case "sms":
      return f.sms.number ? `sms-${f.sms.number}` : "sms";
    case "vcard":
      return [f.vcard.firstName, f.vcard.lastName].filter(Boolean).join("-") || "contact";
  }
}
function missingHint(type) {
  switch (type) {
    case "wifi":
      return "Enter the network name (SSID) to generate the code.";
    case "email":
      return "Enter a recipient email address to generate the code.";
    case "phone":
      return "Enter a phone number to generate the code.";
    case "sms":
      return "Enter a phone number to generate the code.";
    case "vcard":
      return "Enter at least a first or last name to generate the code.";
    default:
      return null;
  }
}
