import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContributorsService } from './contributors.service';
import { ContributorDetailsDto } from './dto/contributor-details.dto';

// Unauthenticated — the pay.wishers.app step after paying, where a giver adds their name, photo and
// message. The payment reference is the key; tight limits since it's guessable surface.
@Controller('public/contributions')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class PublicContributionsController {
  constructor(private readonly contributorsService: ContributorsService) {}

  @Get(':reference/upload-signature')
  uploadSignature(@Param('reference') reference: string) {
    return this.contributorsService.detailsUploadSignature(reference);
  }

  @Patch(':reference')
  addDetails(
    @Param('reference') reference: string,
    @Body() dto: ContributorDetailsDto,
  ) {
    return this.contributorsService.addDetails(reference, dto);
  }
}
