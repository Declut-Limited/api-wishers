import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Email or phone number.
  @IsString()
  @MinLength(3)
  identifier: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  pushToken?: string;
}
