import { Controller, Get, Post, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../core/auth/guards/organization.guard';
import { OrganizationRoleGuard } from '../../../core/auth/guards/organization-role.guard';
import { PhoneNumberService } from './phone-number.service';
import { ClaimPhoneNumberDto, AssignAgentDto } from './dto/phone-number.dto';

@ApiTags('Phone Numbers')
@ApiBearerAuth()
@Controller('v1/phone-numbers')
export class PhoneNumberController {
  constructor(private readonly phoneNumbers: PhoneNumberService) {}

  // ── Browsing — any authenticated user, not scoped to one workspace ────
  // (deliberately not behind OrganizationGuard: browsing the shared pool
  // isn't "about" any single workspace's resources, so there's no one
  // workspace to resolve/verify membership against.)

  @Get('providers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Carrier catalog: which are connected (platform credentials configured) and which support live search' })
  getProviders() {
    return this.phoneNumbers.getProviderCatalogWithStatus();
  }

  @Get('pool')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Browse unowned numbers already in the pool (manually-added carriers)' })
  browsePool(@Query('country') country?: string, @Query('provider') provider?: string) {
    return this.phoneNumbers.browsePool(country, provider);
  }

  @Get('search-twilio')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Live search of numbers not yet purchased, via the platform Twilio account' })
  searchTwilio(@Query('country') country: string, @Query('areaCode') areaCode?: string) {
    if (!country) throw new BadRequestException('country is required');
    return this.phoneNumbers.searchTwilio(country, areaCode);
  }

  // ── Owned numbers + mutations — workspace-scoped ──────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @ApiOperation({ summary: 'List numbers owned by a workspace' })
  listOwned(@Query('workspaceId') workspaceId: string) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    return this.phoneNumbers.listOwned(workspaceId);
  }

  @Post('claim')
  @UseGuards(JwtAuthGuard, OrganizationGuard, OrganizationRoleGuard('ADMIN', 'OWNER'))
  @ApiOperation({ summary: 'Claim a number into a workspace — from the existing pool, or by live-purchasing a Twilio search result' })
  claim(@Body() dto: ClaimPhoneNumberDto) {
    return this.phoneNumbers.claim({
      workspaceId: dto.workspaceId,
      twilioNumber: dto.twilioNumber,
      twilioCountry: dto.twilioCountry,
      agentId: dto.agentId,
    });
  }

  @Post(':id/release')
  @UseGuards(JwtAuthGuard, OrganizationGuard, OrganizationRoleGuard('ADMIN', 'OWNER'))
  @ApiOperation({ summary: 'Release a claimed number back to the pool' })
  release(@Query('workspaceId') workspaceId: string, @Param('id') id: string) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    return this.phoneNumbers.release(workspaceId, id);
  }

  @Post(':id/assign-agent')
  @UseGuards(JwtAuthGuard, OrganizationGuard, OrganizationRoleGuard('ADMIN', 'OWNER'))
  @ApiOperation({ summary: 'Connect (or disconnect) an owned number to an agent' })
  assignAgent(@Query('workspaceId') workspaceId: string, @Param('id') id: string, @Body() dto: AssignAgentDto) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    return this.phoneNumbers.assignAgent(workspaceId, id, dto.agentId ?? null);
  }
}
