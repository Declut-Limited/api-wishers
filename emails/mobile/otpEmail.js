const { greeting, subtitle, paragraph, otpCode, notice, layout } = require('../layout');

const COPY = {
  verify: {
    subject: 'Your Wishers verification code',
    subtitle: 'Enter this 6-digit code to verify your email address.',
    intro: 'To finish setting up your account, enter the 6-digit code below in the Wishers app.',
  },
  reset: {
    subject: 'Your Wishers password reset code',
    subtitle: 'Enter this 6-digit code to reset your password.',
    intro: "To reset your password, enter the 6-digit code below in the Wishers app. If you didn't ask for a reset, you can safely ignore this email.",
  },
};

/**
 * One-time code email (sign-up verification or password reset).
 * @param {{ name: string, otp: string, expiryMinutes: number, purpose?: 'verify' | 'reset' }} params
 * @returns {{ subject: string, html: string }}
 */
function otpEmail({ name, otp, expiryMinutes, purpose = 'verify' }) {
  const copy = COPY[purpose] || COPY.verify;
  const body = `
            ${greeting(name)}
            ${subtitle(copy.subtitle)}
            ${paragraph(copy.intro)}
            ${otpCode(otp)}
            ${notice(`This code expires in ${expiryMinutes} minutes. Never share it with anyone, not even Wishers.`)}`;

  return {
    subject: copy.subject,
    html: layout({
      title: copy.subject,
      preheader: `Your Wishers code expires in ${expiryMinutes} minutes. Don't share it with anyone.`,
      body,
    }),
  };
}

module.exports = { otpEmail };
