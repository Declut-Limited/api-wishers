const { LINKS, greeting, subtitle, paragraph, detailsTable, button, layout } = require('../layout');

// "14 Sep 2026" and "09:41 GMT", built by hand because Intl's en-GB short month
// is "Sept" on newer Node versions.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const formatDate = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const formatTime = (d) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} GMT`;

/**
 * Security notice sent after a user's password is changed or reset.
 * @param {{ name: string, changedAt?: Date | string | number, supportUrl?: string }} params
 * @returns {{ subject: string, html: string }}
 */
function passwordChangedEmail({ name, changedAt = new Date(), supportUrl = LINKS.support }) {
  const when = new Date(changedAt);
  const date = formatDate(when);
  const time = formatTime(when);
  const subject = 'Your Wishers password was changed';
  const body = `
            ${greeting(name)}
            ${subtitle('Your Wishers password was successfully updated.')}
            ${paragraph(`Your password was changed on ${date} at ${time}.`)}
            ${paragraph("If this was you, there's nothing else to do. If it wasn't, contact our support team right away so we can secure your account and your wallet.")}
            ${detailsTable([
              ['Date', date],
              ['Time', time],
            ])}
            ${button('Contact Support', supportUrl)}`;

  return {
    subject,
    html: layout({
      title: subject,
      preheader: `Your password was changed on ${date} at ${time}. Not you? Contact support right away.`,
      body,
    }),
  };
}

module.exports = { passwordChangedEmail };
