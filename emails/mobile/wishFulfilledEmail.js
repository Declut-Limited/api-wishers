const { ASSETS, escapeHtml, icon, heading, subtitle, paragraph, detailsTable, button, formatNaira, layout } = require('../layout');

/**
 * Sent to the wishlist owner when a wish reaches its target amount.
 * @param {{ name: string, wishTitle: string, targetAmount: number, raisedAmount?: number, giversCount?: number, ctaUrl?: string }} params
 *   amounts are in naira.
 * @returns {{ subject: string, html: string }}
 */
function wishFulfilledEmail({ name, wishTitle, targetAmount, raisedAmount = targetAmount, giversCount, ctaUrl }) {
  const subject = `Your wish came true — ${wishTitle}`;
  const rows = [
    ['Wish', wishTitle],
    ['Target', formatNaira(targetAmount)],
    ['Raised', formatNaira(raisedAmount)],
  ];
  if (giversCount) rows.push(['Givers', String(giversCount)]);

  const thanks = giversCount
    ? `${giversCount} ${giversCount === 1 ? 'person' : 'people'} came together to make it happen.`
    : 'The people who love you came together to make it happen.';

  const body = `
            ${icon(ASSETS.confetti)}
            ${heading(`Your wish came true, ${escapeHtml(name || 'there')}!`)}
            ${subtitle(`<strong>${escapeHtml(wishTitle)}</strong> has reached its target.`)}
            ${paragraph(thanks)}
            ${paragraph("The money is in your Wishers wallet, ready to withdraw to your bank whenever you're ready. Don't forget to say thank you!")}
            ${detailsTable(rows, 'Wish summary')}
            ${ctaUrl ? button('Withdraw Funds', ctaUrl) : ''}`;

  return {
    subject,
    html: layout({
      title: subject,
      preheader: `${wishTitle} reached its ${formatNaira(targetAmount)} target.`,
      body,
    }),
  };
}

module.exports = { wishFulfilledEmail };
