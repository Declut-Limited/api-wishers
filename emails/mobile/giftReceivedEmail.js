const { ASSETS, escapeHtml, icon, heading, subtitle, paragraph, detailsTable, messageBox, button, formatNaira, layout } = require('../layout');

/**
 * Sent to the wishlist owner when someone gifts towards one of their wishes.
 * Anonymous gifts never show the giver's name.
 * @param {{ name: string, wishTitle: string, amount: number, giverName?: string, isAnonymous?: boolean, message?: string, ctaUrl?: string }} params
 *   amount is in naira (what the wallet was credited).
 * @returns {{ subject: string, html: string }}
 */
function giftReceivedEmail({ name, wishTitle, amount, giverName, isAnonymous = false, message, ctaUrl }) {
  const from = !isAnonymous && giverName ? giverName : 'Someone special';
  const subject = `${from} sent you ${formatNaira(amount)} towards ${wishTitle}`;
  const body = `
            ${icon(ASSETS.confetti)}
            ${heading(`You got a gift, ${escapeHtml(name || 'there')}!`)}
            ${subtitle(`${escapeHtml(from)} just gifted towards your wish.`)}
            ${paragraph(`${formatNaira(amount)} has been added to your Wishers wallet. Keep sharing your wishlist — every gift brings your wish closer.`)}
            ${detailsTable([
              ['From', isAnonymous ? 'Anonymous' : from],
              ['Wish', wishTitle],
              ['Amount', formatNaira(amount)],
            ], 'Gift details')}
            ${!isAnonymous && message ? messageBox(message, from) : ''}
            ${ctaUrl ? button('View Your Wish', ctaUrl) : ''}`;

  return {
    subject,
    html: layout({
      title: subject,
      preheader: `${formatNaira(amount)} has been added to your Wishers wallet.`,
      body,
    }),
  };
}

module.exports = { giftReceivedEmail };
