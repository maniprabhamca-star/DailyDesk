// Reusable branded HTML email shell + specific templates. Email HTML must be
// table-based with inline styles (clients strip <style>, and flex/grid don't
// work). No external images — a CSS "D" tile renders the brand reliably even
// when images are blocked and while the site is behind basic-auth. Swap in the
// real logo PNG once the site is public if desired.
const BRAND = '#4F46E5';

/** Bulletproof-ish CTA button (table wrapper so it renders in Outlook too). */
function button(url, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr>` +
    `<td style="border-radius:8px;background:${BRAND}">` +
    `<a href="${url}" style="display:inline-block;padding:12px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${label}</a>` +
    `</td></tr></table>`;
}

/** Wrap body HTML in the DiemDesk shell (header tile + wordmark, footer). */
function brandedEmail({ preheader = '', heading, bodyHtml, footerLine = '' }) {
  const year = new Date().getFullYear();
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;margin:0;padding:28px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px">
      <tr><td style="padding:26px 30px 4px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px"><div style="width:36px;height:36px;background:${BRAND};border-radius:10px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:20px;line-height:36px;text-align:center">D</div></td>
          <td style="padding-left:11px;font-size:19px;font-weight:700;color:#0f172a;letter-spacing:-0.02em">DiemDesk</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:8px 30px 6px">
        <h1 style="margin:14px 0 10px;font-size:20px;font-weight:700;color:#0f172a">${heading}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:18px 30px 26px;border-top:1px solid #f1f5f9">
        <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8">
          ${footerLine ? footerLine + '<br>' : ''}Questions? <a href="mailto:support@diemdesk.com" style="color:${BRAND};text-decoration:none">support@diemdesk.com</a><br>
          © ${year} JPNM Rapid Universe LLC · DiemDesk — private, on-device document tools
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

/** Password-reset email → { subject, html, text }. */
function passwordResetEmail({ name, link }) {
  const hi = name ? `Hi ${name},` : 'Hi there,';
  const bodyHtml =
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">${hi}</p>` +
    `<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#334155">We got a request to reset your DiemDesk password. Choose a new one with the button below — this link works for <strong>1 hour</strong> and can be used once.</p>` +
    button(link, 'Reset my password') +
    `<p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#64748b">Or paste this into your browser:<br><a href="${link}" style="color:${BRAND};word-break:break-all">${link}</a></p>` +
    `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#64748b">If you didn't request this, you can safely ignore this email — your password won't change. Never share this link with anyone.</p>`;
  const text = `${hi}\n\nWe got a request to reset your DiemDesk password. Open this link to choose a new one (works for 1 hour, one use):\n\n${link}\n\nIf you didn't request this, ignore this email — your password won't change. Never share this link.\n\n— DiemDesk · support@diemdesk.com`;
  return {
    subject: 'Reset your DiemDesk password',
    html: brandedEmail({ preheader: 'Reset your DiemDesk password — link valid for 1 hour.', heading: 'Reset your password', bodyHtml }),
    text,
  };
}

module.exports = { brandedEmail, button, passwordResetEmail };
