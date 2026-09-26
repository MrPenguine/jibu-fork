import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../core/auth/guards/organization.guard';
import { ContactsService } from './contacts.service';
import type { ContactChannel } from '../../../core/contact/contact.service';

function resolveWorkspaceId(req: any): string | undefined {
  return req.user?.lastWorkspaceId || req.user?.workspaceId || (req.headers['x-workspace-id'] as string);
}

/**
 * Any workspace member, not admin/owner-only — reversed from the original
 * design (which used OrganizationRoleGuard('ADMIN','OWNER')) per direct
 * product feedback: test personas need to be listable/creatable by whoever
 * is testing their own agent, same audience FloatingAgentTester already
 * serves unrestricted. Matches how Members/Billing are already visible to
 * every workspace member in this dashboard — the backend guard isn't the
 * place this dashboard enforces that distinction.
 */
@ApiTags('contacts')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('v1/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @ApiOperation({ summary: 'Create or update a persona/contact (e.g. from the floating agent tester)' })
  async create(
    @Req() req,
    @Body() body: { externalId: string; displayName?: string; channel?: ContactChannel },
  ) {
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) throw new BadRequestException('No workspace selected');
    if (!body?.externalId) throw new BadRequestException('externalId is required');

    const contact = await this.contactsService.createOrUpdate(
      workspaceId,
      body.externalId,
      body.channel || 'phone',
      body.displayName,
    );
    if (!contact) throw new BadRequestException('Failed to create contact');
    return contact;
  }

  @Get()
  @ApiOperation({ summary: 'Search/list contacts for the current workspace' })
  async list(
    @Req() req,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) throw new BadRequestException('No workspace selected');

    return this.contactsService.list(workspaceId, {
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Contact detail: info + unified call/chat timeline' })
  async getDetail(@Param('id') id: string, @Req() req) {
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) throw new BadRequestException('No workspace selected');

    const detail = await this.contactsService.getDetail(workspaceId, id);
    if (!detail) throw new BadRequestException('Contact not found');
    return detail;
  }

  @Get(':id/memories')
  @ApiOperation({ summary: "This contact's mem0 memory state" })
  async getMemories(@Param('id') id: string, @Req() req) {
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) throw new BadRequestException('No workspace selected');

    const memories = await this.contactsService.getMemories(workspaceId, id);
    if (memories === null) throw new BadRequestException('Contact not found');
    return memories;
  }
}
