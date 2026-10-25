import * as Joi from 'joi';

const EXPIRY = /^[0-9]+(ms|s|m|h|d|w|y)$/;

// Vars for modules not built yet stay optional(); tighten to required() when each module is wired up.
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),

  MONGODB_URI: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRY: Joi.string().pattern(EXPIRY).default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRY: Joi.string().pattern(EXPIRY).default('30d'),
  BCRYPT_SALT_ROUNDS: Joi.number().default(12),

  // Signs the forgot-password and email-verification OTP tokens; separate from the session secrets.
  JWT_PASSWORD_RESET_SECRET: Joi.string().min(32).required(),
  OTP_EXPIRY_MINUTES: Joi.number().default(10),
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: Joi.number().default(15),

  // Admin sessions, signed with their own secrets so a user token can never pass as an admin's.
  // Optional so deploys don't break before they're set; admin routes answer 503 until they are.
  JWT_ADMIN_ACCESS_SECRET: Joi.string().min(32).allow('').optional(),
  JWT_ADMIN_ACCESS_EXPIRY: Joi.string().pattern(EXPIRY).default('15m'),
  JWT_ADMIN_REFRESH_SECRET: Joi.string().min(32).allow('').optional(),
  JWT_ADMIN_REFRESH_EXPIRY: Joi.string().pattern(EXPIRY).default('7d'),

  // Base of the public contribution links, e.g. {PAY_APP_URL}/w/{slug}.
  PAY_APP_URL: Joi.string().uri().default('https://pay.wishers.app'),

  // Optional — only needed if Expo push security is switched on for the project.
  EXPO_ACCESS_TOKEN: Joi.string().allow('').optional(),

  MAILTRAP_API_KEY: Joi.string().allow('').optional(),
  EMAIL_FROM: Joi.string().allow('').optional(),
  EMAIL_FROM_NAME: Joi.string().default('Wishers'),

  // Paystack secret key (sk_test_… in development). Payment routes refuse to run without it.
  PAYSTACK_SECRET_KEY: Joi.string().allow('').optional(),

  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').optional(),
  CLOUDINARY_API_KEY: Joi.string().allow('').optional(),
  CLOUDINARY_API_SECRET: Joi.string().allow('').optional(),
});
