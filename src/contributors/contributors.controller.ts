import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/interfaces/jwt-payload.interface';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { ContributorsService } from './contributors.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ContributorsController {
  constructor(private readonly contributorsService: ContributorsService) {}

  // Latest gifts across all of the caller's wishes (home screen).
  @Get('contributors')
  listMine(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: PaginationDto,
  ) {
    return this.contributorsService.listMine(user.sub, query.page, query.limit);
  }

  @Get('contributors/:id')
  getOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.contributorsService.getMine(user.sub, id);
  }

  @Get('wish-items/:id/contributors')
  listForWishItem(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.contributorsService.listForWishItem(
      user.sub,
      id,
      query.page,
      query.limit,
    );
  }
}
