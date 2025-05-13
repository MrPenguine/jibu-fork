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
import { AuthGuard } from '@nestjs/passport';
import { ConsoleService } from './console.service';
import { LogEntryDto } from './dto/log-entry.dto';
import { OrgRoleGuard } from '../../../core/auth/guards/org-role.guard';
import { Request } from 'express';

@ApiTags('console')
@Controller('v1/console')
@UseGuards(AuthGuard('jwt'), OrgRoleGuard)
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
    const organizationId = req.headers['x-organization-id'] as string;
    
    // Verify assistant exists in this organization
    const isValid = await this.consoleService.verifyAssistant(assistantId, organizationId);
    if (!isValid) {
      throw new NotFoundException('Assistant not found or not accessible in this organization');
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
    const organizationId = req.headers['x-organization-id'] as string;
    
    // Verify assistant exists in this organization
    const isValid = await this.consoleService.verifyAssistant(assistantId, organizationId);
    if (!isValid) {
      throw new NotFoundException('Assistant not found or not accessible in this organization');
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
    const organizationId = req.headers['x-organization-id'] as string;
    
    // Verify assistant exists in this organization
    const isValid = await this.consoleService.verifyAssistant(assistantId, organizationId);
    if (!isValid) {
      throw new NotFoundException('Assistant not found or not accessible in this organization');
    }
    
    const success = await this.consoleService.clearConsole(assistantId, sessionId);
    return { success };
  }
} 