const { ASSETS, LINKS, escapeHtml, icon, heading, subtitle, paragraph, detailsTable, button, formatNaira, layout } = require('../layout');

/**
 * Thank-you receipt for the giver, after paying on pay.wishers.app.
 * Givers don't need an account, so this is often their first Wishers email.
 * @param {{ name?: string, ownerName: string, wishTitle: string, amount: number, reference?: string, paidAt?: Date | string | number, ctaUrl?: string }} params
 *   amount is what the giver paid, in naira.
 * @returns {{ subject: string, html: string }}
 */
function giftReceiptEmail({ name, ownerName, wishTitle, amount, reference, paidAt, ctaUrl = LINKS.site }) {
  const subject = `Thank you for your gift to ${ownerName}`;
  const rows = [
    ['For', ownerName],
    ['Wish', wishTitle],
    ['Amount', formatNaira(amount)],
  ];
  if (reference) rows.push(['Reference', reference]);
  if (paidAt) {
    const d = new Date(paidAt);
    rows.push(['Date', `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`]);
  }

  const body = `
            ${icon(ASSETS.gift)}
            ${heading(`Thank you${name ? `, ${escapeHtml(name)}` : ''}!`)}
            ${subtitle(`Your gift to ${escapeHtml(ownerName)} was received.`)}
            ${paragraph(`Your ${formatNaira(amount)} gift towards <strong>${escapeHtml(wishTitle)}</strong> has gone straight to ${escapeHtml(ownerName)}'s Wishers wallet. You've just brought their wish one step closer.`)}
            ${detailsTable(rows, 'Your receipt')}
            ${paragraph('Want your own wishlist? Create one on Wishers and share it with the people who love you.')}
            ${button('Make Your Own Wish', ctaUrl)}`;

  return {
    subject,
    html: layout({
      title: subject,
      preheader: `Your ${formatNaira(amount)} gift towards ${wishTitle} was received.`,
      body,
    }),
  };
}

module.exports = { giftReceiptEmail };
