import { Controller, Post, Body, Get, Headers, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FunctionToolService } from './function-tool.service';

@ApiTags('Function Tool')
@Controller('v1/tools/function-tool')
export class FunctionToolController {
  private readonly logger = new Logger(FunctionToolController.name);
  
  constructor(private readonly functionToolService: FunctionToolService) {}

  @Post('execute')
  @ApiOperation({ summary: 'Execute a function with parameters' })
  @ApiResponse({ status: 200, description: 'Function executed successfully' })
  async executeFunction(
    @Body() body: any,
    @Headers('x-organization-id') organizationId?: string,
    @Headers('organization-id') altOrgId?: string,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    this.logger.log('Executing function');
    
    // Use the provided organization ID or a default one
    const effectiveOrgId = organizationId || altOrgId || 'default-org-id';
    this.logger.log(`Using organization ID: ${effectiveOrgId}`);
    
    // Use provided user ID or default
    const userId = headerUserId || 'default-user-id';
    
    return this.functionToolService.executeFunction(body, effectiveOrgId, userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get the status of the function tool' })
  @ApiResponse({ status: 200, description: 'Returns the function tool status' })
  async getFunctionToolStatus(
    @Headers('x-organization-id') organizationId?: string,
    @Headers('organization-id') altOrgId?: string,
  ) {
    // Use the provided organization ID or a default one
    const effectiveOrgId = organizationId || altOrgId || 'default-org-id';
    this.logger.log(`Getting function tool status for organization: ${effectiveOrgId}`);
    
    return this.functionToolService.getFunctionToolStatus(effectiveOrgId);
  }

  @Post('configure')
  @ApiOperation({ summary: 'Configure the function tool' })
  @ApiResponse({ status: 200, description: 'Function tool configured successfully' })
  async configureFunctionTool(
    @Body() body: any,
    @Headers('x-organization-id') organizationId?: string,
    @Headers('organization-id') altOrgId?: string,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    this.logger.log('Configuring function tool');
    
    // Use the provided organization ID or a default one
    const effectiveOrgId = organizationId || altOrgId || 'default-org-id';
    this.logger.log(`Using organization ID: ${effectiveOrgId}`);
    
    // Use provided user ID or default
    const userId = headerUserId || 'default-user-id';
    
    return this.functionToolService.configureFunctionTool(body, effectiveOrgId, userId);
  }
}
