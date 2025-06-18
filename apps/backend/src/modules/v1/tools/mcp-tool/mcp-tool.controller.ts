import { Body, Controller, Get, Post, Query, Headers, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { McpToolService } from './mcp-tool.service';

@ApiTags('mcp-tool')
@Controller('/v1/tools/mcp-tool')
export class McpToolController {
  constructor(private readonly mcpToolService: McpToolService) {}

  @Post('/execute')
  @ApiOperation({ summary: 'Execute an MCP tool' })
  @ApiResponse({ status: 200, description: 'The MCP tool has been executed successfully.' })
  @ApiBody({ description: 'The parameters to pass to the MCP server' })
  async executeMcpTool(
    @Body() params: any,
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.mcpToolService.executeMcpTool(params, organizationId, userId);
  }

  @Get('/status')
  @ApiOperation({ summary: 'Get the status of the MCP tool' })
  @ApiResponse({ status: 200, description: 'The status of the MCP tool.' })
  async getMcpToolStatus(
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.mcpToolService.getMcpToolStatus(organizationId);
  }

  @Post('/configure')
  @ApiOperation({ summary: 'Configure the MCP tool' })
  @ApiResponse({ status: 200, description: 'The MCP tool has been configured successfully.' })
  @ApiBody({ description: 'The MCP tool configuration' })
  async configureMcpTool(
    @Body() config: any,
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.mcpToolService.configureMcpTool(config, organizationId, userId);
  }

  @Get('/resources')
  @ApiOperation({ summary: 'List resources from an MCP server' })
  @ApiResponse({ status: 200, description: 'List of resources from the MCP server.' })
  async listMcpResources(
    @Query('serverUrl') serverUrl: string,
    @Query('serverToken') serverToken?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.mcpToolService.listMcpResources(serverUrl, serverToken, cursor);
  }

  @Get('/resource')
  @ApiOperation({ summary: 'Read a resource from an MCP server' })
  @ApiResponse({ status: 200, description: 'The resource content.' })
  async readMcpResource(
    @Query('serverUrl') serverUrl: string,
    @Query('resourceUri') resourceUri: string,
    @Query('serverToken') serverToken?: string,
  ) {
    return this.mcpToolService.readMcpResource(serverUrl, resourceUri, serverToken);
  }

  @Post('/test')
  @ApiOperation({ summary: 'Test endpoint for the MCP tool' })
  @ApiResponse({ status: 200, description: 'Test response from the MCP tool.' })
  @SetMetadata('isPublic', true)
  async testMcpTool(
    @Body() params: any,
  ) {
    // This is a test endpoint that doesn't require authentication
    // It's useful for testing the MCP tool without having to set up a full organization
    return {
      success: true,
      message: 'MCP tool test endpoint',
      receivedParams: params,
    };
  }

  @Get('/tools')
  @ApiOperation({ summary: 'Discover available tools from the MCP server' })
  @ApiResponse({ status: 200, description: 'List of available tools from the MCP server.' })
  async discoverTools(
    @Query('serverUrl') serverUrl: string,
    @Query('serverToken') serverToken?: string,
  ) {
    return this.mcpToolService.discoverTools(serverUrl, serverToken);
  }
}
