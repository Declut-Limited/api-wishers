import { IsString, Matches } from 'class-validator';

export class RecordViewDto {
  // The pay page's random per-browser ID (a UUID today).
  @IsString()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  visitorId: string;
}
