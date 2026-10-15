/**
 * Shared Wishers email frame (header, body, footer), built with tables + inline
 * styles so it renders in Gmail, Outlook and Apple Mail. Every template in this
 * folder renders its own body and passes it through `layout()`.
 *
 * Email clients can't load local files or SVGs, so every image below is a public
 * PNG URL.
 */

const BRAND = '#2D6339';
const BRAND_BUTTON = '#308041';
const BRAND_TINT = '#F4FDE6';
const LIME = '#CCF88E';
const HEADING = '#1A1A1A';
const TEXT = '#404040';
const MUTED = '#737373';
const CARD = '#F8FFEF';
const BORDER = '#E5E7E1';
const FONT = "'Urbanist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// Hosted on Cloudinary (folder wishers/email), from app-wishers/assets/images.
// Re-uploading with the same public_id replaces the image everywhere.
const CDN = 'https://res.cloudinary.com/du8iw1efa/image/upload/wishers/email';
const ASSETS = {
  logo: `${CDN}/logo.png`,
  gift: `${CDN}/gift.png`,
  confetti: `${CDN}/confetti.png`,
};

const LINKS = {
  site: 'https://wishers.app',
  privacy: 'https://wishers.app/privacy-policy',
  terms: 'https://wishers.app/terms-of-use',
  support: 'mailto:support@wishers.app',
};

// Anything user-supplied (names, wish titles, messages) goes through this before
// it's interpolated into HTML.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "₦50,000" — amounts are whole naira throughout the API. Plain text (not an
// HTML entity) so it survives detailsTable's escaping.
function formatNaira(amount) {
  return `₦${Number(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

// ---------- Building blocks for template bodies ----------

// Big opening line. `text` is HTML — escape anything user-supplied first.
function heading(text) {
  return `<h1 style="margin:0 0 10px;font-family:${FONT};font-size:28px;line-height:34px;font-weight:700;color:${HEADING};">${text}</h1>`;
}

function greeting(name) {
  return heading(`Hi ${escapeHtml(name || 'there')},`);
}

function subtitle(text) {
  return `<p style="margin:0 0 28px;font-family:${FONT};font-size:15px;line-height:22px;color:${TEXT};">${text}</p>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 20px;font-family:${FONT};font-size:16px;line-height:26px;color:${MUTED};">${text}</p>`;
}

// Free text typed by a person: escaped, blank lines start a new paragraph.
function richText(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => paragraph(escapeHtml(block).replace(/\n/g, '<br />')))
    .join('');
}

// Someone else's words quoted in a soft card (e.g. a giver's message).
function messageBox(text, from) {
  const by = from ? `<br /><span style="font-size:14px;color:${MUTED};">— ${escapeHtml(from)}</span>` : '';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
  <tr>
    <td style="background:${CARD};border-left:4px solid ${BRAND_BUTTON};border-radius:12px;padding:20px 22px;font-family:${FONT};font-size:16px;line-height:26px;color:${TEXT};">${escapeHtml(text).replace(/\n/g, '<br />')}${by}</td>
  </tr>
</table>`;
}

// Small illustration above a heading (gift, confetti).
function icon(src, size = 64) {
  return `<img src="${src}" width="${size}" height="${size}" alt="" style="display:block;border:0;width:${size}px;height:${size}px;margin:0 0 20px;" />`;
}

// Bulletproof button: a table cell carries the background so Outlook still shows it.
function button(label, url) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 8px;">
  <tr>
    <td align="center" bgcolor="${BRAND_BUTTON}" style="border-radius:30px;background:${BRAND_BUTTON};">
      <a href="${url}" target="_blank" class="btn" style="display:inline-block;padding:16px 34px;font-family:${FONT};font-size:17px;line-height:22px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:30px;">${escapeHtml(label)}&nbsp;&nbsp;&rarr;</a>
    </td>
  </tr>
</table>`;
}

// Large centred one-time code, split into two halves ("427 005").
function otpCode(code) {
  const value = String(code ?? '');
  const half = value.length % 2 === 0 && value.length >= 4 ? value.length / 2 : 0;
  const parts = half ? [value.slice(0, half), value.slice(half)] : [value];
  const cell = (part, i) => `
    <td class="otp-cell" style="${i ? 'padding-left:10px;' : ''}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="otp-digits" style="background:${CARD};border-radius:18px;padding:12px 22px;font-family:${FONT};font-size:56px;line-height:72px;font-weight:600;letter-spacing:8px;color:${BRAND};">${escapeHtml(part)}</td>
      </tr></table>
    </td>`;
  return `
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:4px auto 24px;">
  <tr>${parts.map(cell).join('')}
  </tr>
</table>`;
}

// Full-width amber strip for warnings ("This code expires in 10 minutes...").
function notice(text) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
  <tr>
    <td align="center" style="background:#FFFBEB;border-radius:10px;padding:16px 20px;font-family:${FONT};font-size:15px;line-height:22px;color:#D97706;">${text}</td>
  </tr>
</table>`;
}

// Bordered card of label/value rows under a tinted header (receipts, gift details).
function detailsTable(rows, title = 'Details') {
  const body = rows
    .map(
      ([label, value], i) => `
  <tr>
    <td style="padding:18px 20px;${i ? `border-top:1px solid ${BORDER};` : ''}font-family:${FONT};font-size:16px;line-height:22px;color:${MUTED};">${escapeHtml(label)}</td>
    <td align="right" style="padding:18px 20px;${i ? `border-top:1px solid ${BORDER};` : ''}font-family:${FONT};font-size:16px;line-height:22px;font-weight:600;color:${HEADING};">${escapeHtml(value)}</td>
  </tr>`,
    )
    .join('');
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;border:1px solid ${BORDER};border-collapse:separate;border-radius:14px;overflow:hidden;">
  <tr>
    <td colspan="2" style="padding:14px 20px;background:${CARD};border-bottom:1px solid ${BORDER};border-radius:14px 14px 0 0;font-family:${FONT};font-size:15px;line-height:20px;color:#9CA3AF;">${escapeHtml(title)}</td>
  </tr>${body}
</table>`;
}

function logoLockup(size) {
  const textSize = Math.round(size * 0.55);
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding-right:12px;"><img src="${ASSETS.logo}" width="${size}" height="${size}" alt="Wishers" style="display:block;border:0;width:${size}px;height:${size}px;" /></td>
    <td style="font-family:${FONT};font-size:${textSize}px;line-height:${size}px;font-weight:800;color:${BRAND};letter-spacing:-0.5px;">Wishers</td>
  </tr>
</table>`;
}

/**
 * Wraps a template body in the full Wishers frame.
 * @param {object} opts
 * @param {string} opts.title      <title> and fallback subject.
 * @param {string} opts.preheader  Hidden preview line shown in the inbox list.
 * @param {string} opts.body       HTML built from the helpers above.
 */
function layout({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light only" />
<title>${escapeHtml(title)}</title>
<style>
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; }
  img { border:0; outline:none; text-decoration:none; }
  table { border-collapse:collapse; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .px { padding-left:20px !important; padding-right:20px !important; }
    .header-logo { padding:28px 20px !important; }
    .header-art { padding-right:20px !important; }
    .header-art img { width:64px !important; height:64px !important; }
    .btn { display:block !important; text-align:center !important; }
    .otp-digits { font-size:40px !important; line-height:52px !important; letter-spacing:5px !important; padding:10px 14px !important; }
    .otp-cell { padding-left:6px !important; }
    .otp-cell:first-child { padding-left:0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader || '')}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;">
  <tr>
    <td align="center" style="padding:0;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" class="container" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND_TINT};border-bottom:4px solid ${LIME};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="header-logo" valign="middle" style="padding:36px 34px;">${logoLockup(52)}</td>
                <td class="header-art" align="right" valign="middle" style="padding:0 34px 0 0;">
                  <img src="${ASSETS.gift}" width="84" height="84" alt="" style="display:inline-block;border:0;width:84px;height:84px;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="px" style="padding:44px 40px 20px;">${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid ${BORDER};"></td>
        </tr>
        <tr>
          <td class="px" style="padding:32px 40px 36px;">
            ${logoLockup(30)}
            <p style="margin:20px 0 0;font-family:${FONT};font-size:13px;line-height:22px;color:${MUTED};">
              Make a wish. Share it. Let the people who love you make it happen.<br />
              <a href="${LINKS.privacy}" style="color:${BRAND_BUTTON};text-decoration:none;">Privacy Policy</a> &middot;
              <a href="${LINKS.terms}" style="color:${BRAND_BUTTON};text-decoration:none;">Terms of Use</a> &middot;
              <a href="${LINKS.support}" style="color:${BRAND_BUTTON};text-decoration:none;">Support</a>
            </p>
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

module.exports = {
  BRAND,
  ASSETS,
  LINKS,
  escapeHtml,
  formatNaira,
  heading,
  greeting,
  subtitle,
  paragraph,
  richText,
  messageBox,
  icon,
  button,
  otpCode,
  notice,
  detailsTable,
  layout,
};
