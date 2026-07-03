// Builders for the standard QR content-type payloads (Wi-Fi, vCard, mailto,
// SMS, tel). Pure string functions — shared by the QR tool UI and testable in
// Node. Escaping follows the de-facto standards every phone camera implements:
// WIFI: (backslash-escape \ ; , : ") and vCard 3.0 (escape \ , ; + newlines).

export type QrType = 'link' | 'text' | 'wifi' | 'email' | 'phone' | 'sms' | 'vcard';

export type WifiFields = { ssid: string; password: string; security: 'WPA' | 'WEP' | 'nopass'; hidden: boolean };
export type EmailFields = { to: string; subject: string; body: string };
export type SmsFields = { number: string; message: string };
export type VcardFields = { firstName: string; lastName: string; phone: string; email: string; org: string; title: string; url: string };

export type QrFields = {
  link: string;
  text: string;
  wifi: WifiFields;
  email: EmailFields;
  phone: string;
  sms: SmsFields;
  vcard: VcardFields;
};

export const EMPTY_FIELDS: QrFields = {
  link: 'https://dailydesk.app',
  text: '',
  wifi: { ssid: '', password: '', security: 'WPA', hidden: false },
  email: { to: '', subject: '', body: '' },
  phone: '',
  sms: { number: '', message: '' },
  vcard: { firstName: '', lastName: '', phone: '', email: '', org: '', title: '', url: '' },
};

const wifiEsc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
const vcardEsc = (s: string) => s.replace(/([\\,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

export function buildPayload(type: QrType, f: QrFields): string {
  switch (type) {
    case 'link': return f.link.trim();
    case 'text': return f.text;
    case 'wifi': {
      const w = f.wifi;
      if (!w.ssid.trim()) return '';
      let s = `WIFI:T:${w.security};S:${wifiEsc(w.ssid)};`;
      if (w.security !== 'nopass' && w.password) s += `P:${wifiEsc(w.password)};`;
      if (w.hidden) s += 'H:true;';
      return s + ';';
    }
    case 'email': {
      const e = f.email;
      if (!e.to.trim()) return '';
      const params: string[] = [];
      if (e.subject) params.push(`subject=${encodeURIComponent(e.subject)}`);
      if (e.body) params.push(`body=${encodeURIComponent(e.body)}`);
      return `mailto:${e.to.trim()}${params.length ? '?' + params.join('&') : ''}`;
    }
    case 'phone': return f.phone.trim() ? `tel:${f.phone.replace(/[^\d+]/g, '')}` : '';
    case 'sms': {
      const s = f.sms;
      if (!s.number.trim()) return '';
      return `SMSTO:${s.number.replace(/[^\d+]/g, '')}:${s.message}`;
    }
    case 'vcard': {
      const v = f.vcard;
      if (!v.firstName.trim() && !v.lastName.trim()) return '';
      const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      lines.push(`N:${vcardEsc(v.lastName)};${vcardEsc(v.firstName)};;;`);
      lines.push(`FN:${vcardEsc([v.firstName, v.lastName].filter(Boolean).join(' '))}`);
      if (v.org) lines.push(`ORG:${vcardEsc(v.org)}`);
      if (v.title) lines.push(`TITLE:${vcardEsc(v.title)}`);
      if (v.phone) lines.push(`TEL;TYPE=CELL:${vcardEsc(v.phone)}`);
      if (v.email) lines.push(`EMAIL:${vcardEsc(v.email)}`);
      if (v.url) lines.push(`URL:${vcardEsc(v.url)}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }
  }
}

// A short human label for download filenames.
export function payloadLabel(type: QrType, f: QrFields): string {
  switch (type) {
    case 'link': return f.link;
    case 'text': return f.text || 'text';
    case 'wifi': return f.wifi.ssid ? `wifi-${f.wifi.ssid}` : 'wifi';
    case 'email': return f.email.to ? `email-${f.email.to}` : 'email';
    case 'phone': return f.phone ? `call-${f.phone}` : 'phone';
    case 'sms': return f.sms.number ? `sms-${f.sms.number}` : 'sms';
    case 'vcard': return [f.vcard.firstName, f.vcard.lastName].filter(Boolean).join('-') || 'contact';
  }
}

// Friendly hint shown while required fields are empty.
export function missingHint(type: QrType): string | null {
  switch (type) {
    case 'wifi': return 'Enter the network name (SSID) to generate the code.';
    case 'email': return 'Enter a recipient email address to generate the code.';
    case 'phone': return 'Enter a phone number to generate the code.';
    case 'sms': return 'Enter a phone number to generate the code.';
    case 'vcard': return 'Enter at least a first or last name to generate the code.';
    default: return null;
  }
}
