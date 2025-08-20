import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
  Put,
  Delete,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  InviteMembersDto,
  RespondToInvitationDto,
  UpdateMemberRoleDto,
  TransferOwnershipDto,
} from './dto/workspace.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  async getUserWorkspaces(@Request() req: any) {
    return this.workspaceService.getUserWorkspaces(req.user.id);
  }

  @Get('invitations')
  async getUserInvitations(@Request() req: any) {
    return this.workspaceService.getUserInvitations(req.user.email);
  }

    @Post('invitations/:id/revoke')
  async revokeInvitation(@Request() req: any, @Param('id') id: string) {
    return this.workspaceService.revokeInvitation(id, req.user.id);
  }

  @Post('invitations/:id/resend')
  async resendInvitation(@Request() req: any, @Param('id') id: string) {
    return this.workspaceService.resendInvitation(id, req.user.id);
  }

  @Post('invitations/:id/respond')
  async respondToInvitation(
    @Request() req: any,
    @Param('id') id: string,
    @Body() respondDto: RespondToInvitationDto,
  ) {
    return this.workspaceService.respondToInvitation(
      req.user.id,
      id,
      respondDto.action,
    );
  }

  @Get(':id')
  async getWorkspace(@Request() req: any, @Param('id') id: string) {
    return this.workspaceService.getWorkspace(req.user.id, id);
  }

  @Post()
  async createWorkspace(
    @Request() req: any,
    @Body() createWorkspaceDto: CreateWorkspaceDto,
  ) {
    return this.workspaceService.createWorkspace(
      req.user.id,
      createWorkspaceDto.name,
    );
  }

  @Put(':id')
  async updateWorkspace(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.updateWorkspace(
      req.user.id,
      id,
      updateWorkspaceDto,
    );
  }

  @Delete(':id')
  async deleteWorkspace(@Request() req: any, @Param('id') id: string) {
    return this.workspaceService.deleteWorkspace(req.user.id, id);
  }

  @Post(':id/invitations')
  async inviteMembers(
    @Request() req: any,
    @Param('id') id: string,
    @Body() inviteDto: InviteMembersDto,
  ) {
    return this.workspaceService.inviteMembers(req.user.id, id, inviteDto);
  }

  @Get(':id/members')
  async getWorkspaceMembers(@Request() req: any, @Param('id') id: string) {
    return this.workspaceService.getWorkspaceMembers(req.user.id, id);
  }

  @Put(':id/members/:memberId/role')
  async updateMemberRole(
    @Request() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() updateRoleDto: UpdateMemberRoleDto,
  ) {
    return this.workspaceService.updateMemberRole(
      req.user.id,
      id,
      memberId,
      updateRoleDto.role,
    );
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Request() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.workspaceService.removeMember(req.user.id, id, memberId);
  }

  @Post(':id/transfer-ownership')
  async transferOwnership(
    @Request() req: any,
    @Param('id') id: string,
    @Body() transferDto: TransferOwnershipDto,
  ) {
    return this.workspaceService.transferOwnership(
      req.user.id,
      id,
      transferDto.newOwnerId,
    );
  }

  @Get(':id/validate-email')
  async validateEmail(
    @Request() req: any,
    @Param('id') id: string,
    @Query('email') email: string,
  ) {
    if (!email) {
      throw new HttpException('Email query parameter is required', HttpStatus.BAD_REQUEST);
    }
    return this.workspaceService.validateEmail(req.user.id, id, email);
  }
}
