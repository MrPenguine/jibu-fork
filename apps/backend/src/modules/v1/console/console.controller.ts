import { 
  Body, 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Query, 
  UseGuards,
  Req,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { ConsoleService } from './console.service';
import { LogEntryDto } from './dto/log-entry.dto';
import { OrganizationGuard } from '../../../core/auth/guards/organization.guard';
import { OrganizationRoleGuard } from '../../../core/auth/guards/organization-role.guard';
import { Request } from 'express';

@ApiTags('console')
@Controller('v1/console')
@UseGuards(JwtAuthGuard, OrganizationGuard, OrganizationRoleGuard())
@ApiBearerAuth()
export class ConsoleController {
  constructor(private readonly consoleService: ConsoleService) {}

  @Post('log')
  @ApiOperation({ summary: 'Log a message to the console' })
  @ApiQuery({ name: 'assistantId', required: true })
  @ApiQuery({ name: 'sessionId', required: true })
  async logMessage(
    @Body() logEntryDto: LogEntryDto,
    @Query('assistantId') assistantId: string,
    @Query('sessionId') sessionId: string,
    @Req() req: Request
  ) {
    const workspaceId = (req as Request & { user?: { workspaceId?: string } }).user?.workspaceId;
    
    // Verify assistant exists in this workspace
    const isValid = await this.consoleService.verifyAssistant(assistantId, workspaceId);
    if (!isValid) {
      throw new NotFoundException('Assistant not found or not accessible in this workspace');
    }
    
    return this.consoleService.logMessage(
      assistantId, 
      sessionId, 
      logEntryDto.message, 
      logEntryDto.level,
      logEntryDto.metadata
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get console entries' })
  @ApiQuery({ name: 'assistantId', required: true })
  @ApiQuery({ name: 'sessionId', required: true })
  async getConsoleEntries(
    @Query('assistantId') assistantId: string,
    @Query('sessionId') sessionId: string,
    @Req() req: Request
  ) {
    const workspaceId = (req as Request & { user?: { workspaceId?: string } }).user?.workspaceId;
    
    // Verify assistant exists in this workspace
    const isValid = await this.consoleService.verifyAssistant(assistantId, workspaceId);
    if (!isValid) {
      throw new NotFoundException('Assistant not found or not accessible in this workspace');
    }
    
    return this.consoleService.getConsoleEntries(assistantId, sessionId);
  }

  @Delete('clear')
  @ApiOperation({ summary: 'Clear console entries' })
  @ApiQuery({ name: 'assistantId', required: true })
  @ApiQuery({ name: 'sessionId', required: true })
  async clearConsole(
    @Query('assistantId') assistantId: string,
    @Query('sessionId') sessionId: string,
    @Req() req: Request
  ) {
    const workspaceId = (req as Request & { user?: { workspaceId?: string } }).user?.workspaceId;
    
    // Verify assistant exists in this workspace
    const isValid = await this.consoleService.verifyAssistant(assistantId, workspaceId);
    if (!isValid) {
      throw new NotFoundException('Assistant not found or not accessible in this workspace');
    }
    
    const success = await this.consoleService.clearConsole(assistantId, sessionId);
    return { success };
  }
} 