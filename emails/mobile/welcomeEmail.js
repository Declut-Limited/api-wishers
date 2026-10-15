const { LINKS, greeting, subtitle, paragraph, button, layout } = require('../layout');

/**
 * Sent once a new user has verified their email.
 * @param {{ name: string, ctaUrl?: string }} params
 * @returns {{ subject: string, html: string }}
 */
function welcomeEmail({ name, ctaUrl = LINKS.site }) {
  const subject = 'Welcome to Wishers — make your first wish';
  const body = `
            ${greeting(name)}
            ${subtitle("Your account is ready. Let's make some wishes come true.")}
            ${paragraph('Create a wishlist for your birthday, wedding, graduation or any moment that matters, then share the link with the people who love you.')}
            ${paragraph('Friends and family can gift towards any wish in a few taps, no app needed on their side. Every gift lands safely in your Wishers wallet, ready to withdraw to your bank.')}
            ${button('Create a Wishlist', ctaUrl)}`;

  return {
    subject,
    html: layout({
      title: subject,
      preheader: 'Your Wishers account is ready. Create a wishlist and share it with the people who love you.',
      body,
    }),
  };
}

module.exports = { welcomeEmail };
