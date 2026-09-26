import { Body, Controller, Get, Param, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../../core/auth/guards/admin.guard';
import { PhoneNumberService } from '../../v1/phone-number/phone-number.service';
import { ManualAddPhoneNumberDto } from '../../v1/phone-number/dto/phone-number.dto';

/**
 * Platform-wide phone number inventory — not workspace-scoped, so this uses
 * AdminGuard (the flat "is this user a platform admin" check), not
 * OrganizationRoleGuard (which is workspace-scoped and would be the wrong
 * tool for a platform-wide resource). Matches AdminProviderCredentialsController's
 * exact guard pattern.
 */
@ApiTags('Admin Phone Numbers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/phone-numbers')
export class AdminPhoneNumbersController {
  constructor(private readonly phoneNumbers: PhoneNumberService) {}

  @Get()
  @ApiOperation({ summary: 'Full inventory — owned and unowned — for oversight' })
  list() {
    return this.phoneNumbers.adminList();
  }

  @Get('search')
  @ApiOperation({ summary: 'Live Twilio available-number search, using platform credentials' })
  search(@Query('country') country: string, @Query('areaCode') areaCode?: string) {
    if (!country) throw new BadRequestException('country is required');
    return this.phoneNumbers.searchTwilio(country, areaCode);
  }

  @Post('manual-add')
  @ApiOperation({ summary: 'Register an already-acquired manual-carrier number (Africa\'s Talking/Safaricom/Airtel) into the pool' })
  manualAdd(@Body() dto: ManualAddPhoneNumberDto) {
    return this.phoneNumbers.adminManualAdd(dto);
  }

  @Post('sync-twilio')
  @ApiOperation({ summary: 'Pull the platform Twilio account\'s real number list and add any missing ones to the pool — also runs automatically every 10 minutes' })
  syncTwilio() {
    return this.phoneNumbers.syncTwilioNumbers();
  }

  @Post(':id/force-release')
  @ApiOperation({ summary: 'Reclaim a number from whichever workspace owns it (billing/abuse)' })
  forceRelease(@Param('id') id: string) {
    return this.phoneNumbers.forceRelease(id);
  }

  @Post(':id/retry-provisioning')
  @ApiOperation({ summary: 'Retry LiveKit trunk provisioning for a number stuck in provisioning_partial' })
  retryProvisioning(@Param('id') id: string) {
    return this.phoneNumbers.retryProvisioning(id);
  }
}
