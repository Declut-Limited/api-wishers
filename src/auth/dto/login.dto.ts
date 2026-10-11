import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Email or phone number.
  @IsString()
  @MinLength(3)
  identifier: string;

  @IsString()
  password: string;

  // No pushToken here: the app asks for notification permission after sign-in and sends the
  // token to POST /notifications/register-token.
}
