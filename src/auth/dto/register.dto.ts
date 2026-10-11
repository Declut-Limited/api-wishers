import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  // Optional — the current app's signup doesn't collect a phone number.
  @IsOptional()
  @IsString()
  @Matches(/^(?:\+234[789]\d{9}|0[789]\d{9})$/, {
    message:
      'phone must be a valid Nigerian phone number, e.g. 08012345678 or +2348012345678',
  })
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password: string;

  // Another user's inviteCode; an unknown code is ignored, never blocks signup.
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;

  // No pushToken here: the app asks for notification permission after sign-in and sends the
  // token to POST /notifications/register-token.
}
