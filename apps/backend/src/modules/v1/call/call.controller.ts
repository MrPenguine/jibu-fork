import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../core/auth/guards/organization.guard';
import { CallService } from './call.service';

@ApiTags('Calls')
@ApiBearerAuth()
@Controller('v1/calls')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class CallController {
  constructor(private readonly calls: CallService) {}

  @Get()
  @ApiOperation({ summary: 'List call history for a workspace (paginated, filterable)' })
  list(
    @Query('workspaceId') workspaceId: string,
    @Query('status') status?: string,
    @Query('direction') direction?: string,
    @Query('agentId') agentId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    return this.calls.list({
      workspaceId,
      status,
      direction,
      agentId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Aggregate call stats for a workspace (avg duration, transferred, failed)' })
  summary(@Query('workspaceId') workspaceId: string) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    return this.calls.summary(workspaceId);
  }
}
