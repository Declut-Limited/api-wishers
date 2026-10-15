const { LINKS, escapeHtml, greeting, subtitle, paragraph, detailsTable, notice, button, formatNaira, layout } = require('../layout');

// "0123456789" -> "******6789"
const maskAccount = (n) => (n ? `${'*'.repeat(Math.max(String(n).length - 4, 0))}${String(n).slice(-4)}` : '');

/**
 * Sent when a wallet withdrawal to the user's bank succeeds or fails.
 * Failed withdrawals are returned to the wallet.
 * @param {{ name: string, amount: number, status: 'successful' | 'failed', charges?: number, bankName?: string, accountNumber?: string, accountName?: string, reference?: string, reason?: string, supportUrl?: string }} params
 *   amounts are in naira.
 * @returns {{ subject: string, html: string }}
 */
function withdrawalEmail({ name, amount, status, charges, bankName, accountNumber, accountName, reference, reason, supportUrl = LINKS.support }) {
  const ok = status !== 'failed';
  const subject = ok ? `${formatNaira(amount)} is on its way to your bank` : 'Your Wishers withdrawal didn\'t go through';

  const rows = [['Amount', formatNaira(amount)]];
  if (charges) rows.push(['Charges', formatNaira(charges)]);
  if (bankName) rows.push(['Bank', bankName]);
  if (accountNumber) rows.push(['Account', maskAccount(accountNumber)]);
  if (accountName) rows.push(['Account Name', accountName]);
  if (reference) rows.push(['Reference', reference]);

  const body = ok
    ? `
            ${greeting(name)}
            ${subtitle('Your withdrawal has been sent.')}
            ${paragraph(`We've sent ${formatNaira(amount)} from your Wishers wallet to your bank account. Most transfers arrive within minutes, but some banks can take a little longer.`)}
            ${detailsTable(rows, 'Withdrawal details')}`
    : `
            ${greeting(name)}
            ${subtitle("Your withdrawal didn't go through.")}
            ${paragraph(`We couldn't send ${formatNaira(amount)} to your bank account, so the money is back in your Wishers wallet. Check your bank details in the app and try again.`)}
            ${reason ? notice(`Reason: ${escapeHtml(reason)}`) : ''}
            ${detailsTable(rows, 'Withdrawal details')}
            ${button('Contact Support', supportUrl)}`;

  return {
    subject,
    html: layout({
      title: subject,
      preheader: ok ? 'Most transfers arrive within minutes.' : 'The money is back in your Wishers wallet.',
      body,
    }),
  };
}

module.exports = { withdrawalEmail };
