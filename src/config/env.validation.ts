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

  // Base of the public contribution links, e.g. {PAY_APP_URL}/w/{slug}.
  PAY_APP_URL: Joi.string().uri().default('https://pay.wishers.app'),

  // Optional — only needed if Expo push security is switched on for the project.
  EXPO_ACCESS_TOKEN: Joi.string().allow('').optional(),

  MAILTRAP_API_KEY: Joi.string().allow('').optional(),
  EMAIL_FROM: Joi.string().allow('').optional(),
  EMAIL_FROM_NAME: Joi.string().default('Wishers'),

  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').optional(),
  CLOUDINARY_API_KEY: Joi.string().allow('').optional(),
  CLOUDINARY_API_SECRET: Joi.string().allow('').optional(),
});
