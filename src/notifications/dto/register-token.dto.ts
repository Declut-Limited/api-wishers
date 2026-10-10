import { IsString, Matches } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  @Matches(/^Expo(nent)?PushToken\[.+\]$/, {
    message: 'token must be an Expo push token',
  })
  token: string;
}
