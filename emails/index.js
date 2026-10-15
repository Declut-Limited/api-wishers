// One import point for every Wishers email template:
//   const { welcomeEmail } = require('../../emails');
//   const { subject, html } = welcomeEmail({ name: user.name });
// mobile/ = app users (wishlist owners), web/ = givers paying on pay.wishers.app.
module.exports = {
  ...require('./mobile/welcomeEmail'),
  ...require('./mobile/otpEmail'),
  ...require('./mobile/passwordChangedEmail'),
  ...require('./mobile/giftReceivedEmail'),
  ...require('./mobile/wishFulfilledEmail'),
  ...require('./mobile/withdrawalEmail'),
  ...require('./web/giftReceiptEmail'),
};
