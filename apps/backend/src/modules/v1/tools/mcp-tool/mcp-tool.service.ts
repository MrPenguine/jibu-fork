import { Injectable, Logger, HttpException } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import axios from 'axios';

@Injectable()
export class McpToolService {
  private readonly logger = new Logger(McpToolService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute an MCP tool with the provided parameters
   * @param params The parameters to pass to the MCP server
   * @param organizationId The organization ID
   * @param userId The user ID
   * @returns The result of the MCP execution
   */
  async executeMcpTool(params: any, organizationId: string, userId: string) {
    this.logger.log(`Executing MCP tool with params: ${JSON.stringify(params)}`);
    
    try {
      // Log the execution in the database
      const tool = await this.prisma.tool.findFirst({
        where: {
          organizationId,
          type: 'mcp.execute',
        },
      });

      if (!tool) {
        throw new Error('MCP tool not configured for this organization');
      }

      // Create a tool execution record
      const execution = await this.prisma.toolExecution.create({
        data: {
          toolId: tool.id,
          status: 'running',
          input: params,
          executedById: userId,
        },
      });

      // Extract the server URL and token from the tool metadata
      const metadata = tool.metadata as any;
      const serverUrl = metadata?.serverUrl;
      const serverToken = metadata?.serverToken;
      
      if (!serverUrl) {
        throw new Error('Server URL not configured for this MCP tool');
      }
      
      this.logger.log(`Sending request to MCP server: ${serverUrl}`);
      
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if token is available
      if (serverToken) {
        // Zapier MCP uses X-API-Key header for authentication
        if (serverUrl.includes('actions.zapier.com') || serverUrl.includes('zapier.com/mcp')) {
          this.logger.log('Detected Zapier MCP endpoint, using X-API-Key authentication');
          headers['X-API-Key'] = serverToken;
        } else {
          // Default to Bearer token for other services
          headers['Authorization'] = `Bearer ${serverToken}`;
        }
      }
      
      this.logger.log(`Request headers: ${JSON.stringify(Object.keys(headers))}`);
      
      // Make the actual HTTP request to the MCP server
      let mcpResponse;
      try {
        // Check if the URL ends with /sse which typically indicates a Server-Sent Events endpoint
        // These typically use GET requests instead of POST
        const isSSE = serverUrl.toLowerCase().endsWith('/sse');
        const isZapier = serverUrl.includes('actions.zapier.com') || serverUrl.includes('zapier.com/mcp');
        const isN8n = serverUrl.includes('n8n.cloud') || serverUrl.includes('n8n.io');
        
        // Special handling for n8n webhooks
        if (isN8n) {
          this.logger.log(`Detected n8n webhook, using specific n8n compatibility approach`);
          
          // n8n webhooks can be tricky - we need to examine the URL to determine the correct approach
          let n8nResponse = null;
          
          // Determine if this is an SSE endpoint
          const isSSEEndpoint = serverUrl.toLowerCase().includes('/sse');
          
          // For n8n, we need to determine if the webhook expects GET or POST
          // Most n8n webhooks are configured for GET, especially test webhooks
          // Let's try GET first for SSE endpoints, and POST for non-SSE endpoints
          
          // Prepare query parameters for GET requests
          const queryParams = new URLSearchParams();
          
          // Add data in multiple formats to maximize compatibility
          queryParams.append('json', JSON.stringify(params)); // Format 1: as 'json' parameter
          
          // Also add individual parameters
          if (params && typeof params === 'object') {
            Object.entries(params).forEach(([key, value]) => {
              // If value is an object or array, stringify it
              if (typeof value === 'object' && value !== null) {
                queryParams.append(key, JSON.stringify(value));
              } else {
                queryParams.append(key, String(value));
              }
            });
          }
          
          // Add a test parameter to indicate this is a test request
          queryParams.append('test', 'true');
          
          // Add debugging headers
          headers['X-Debug-Source'] = 'jibu-mcp-tool';
          headers['X-Debug-Time'] = new Date().toISOString();
          
          try {
            // For SSE endpoints, always use GET
            if (isSSEEndpoint) {
              // Construct the full URL with query parameters
              const getUrl = queryParams.toString().length > 0 
                ? `${serverUrl}${serverUrl.includes('?') ? '&' : '?'}${queryParams.toString()}` 
                : serverUrl;
              
              this.logger.log(`Making GET request to n8n SSE webhook: ${getUrl}`);
              
              n8nResponse = await axios.get(getUrl, { 
                headers,
                timeout: 10000, // 10 seconds timeout
                responseType: 'text',
                maxContentLength: 1024 * 50, // Limit response size to 50KB
              });
              
              this.logger.log(`GET request to n8n webhook successful: ${n8nResponse.status}`);
            } 
            // For non-SSE endpoints, try POST first
            else {
              try {
                this.logger.log(`Trying POST request to n8n webhook: ${serverUrl}`);
                
                n8nResponse = await axios.post(serverUrl, params, { 
                  headers,
                  timeout: 10000,
                  responseType: 'text',
                  maxContentLength: 1024 * 50,
                });
                
                this.logger.log(`POST request to n8n webhook successful: ${n8nResponse.status}`);
              } catch (postError) {
                // If POST fails with a 404 and mentions webhook registration, try GET
                if (postError.response && 
                    postError.response.status === 404 && 
                    postError.response.data && 
                    postError.response.data.includes('not registered for POST')) {
                  
                  this.logger.log(`POST not supported by this webhook, switching to GET`);
                  
                  // Construct the full URL with query parameters
                  const getUrl = queryParams.toString().length > 0 
                    ? `${serverUrl}${serverUrl.includes('?') ? '&' : '?'}${queryParams.toString()}` 
                    : serverUrl;
                  
                  this.logger.log(`Making GET request to n8n webhook: ${getUrl}`);
                  
                  n8nResponse = await axios.get(getUrl, { 
                    headers,
                    timeout: 10000,
                    responseType: 'text',
                    maxContentLength: 1024 * 50,
                  });
                  
                  this.logger.log(`GET request to n8n webhook successful: ${n8nResponse.status}`);
                } else {
                  // If it's not a webhook registration issue, rethrow
                  throw postError;
                }
              }
            }
            
            mcpResponse = n8nResponse;
          } catch (error) {
            this.logger.error(`n8n webhook request failed: ${error.message}`);
            
            // Check if we have a response with error details
            if (error.response && error.response.data) {
              this.logger.error(`n8n webhook error details: ${JSON.stringify(error.response.data)}`);
            }
            
            // In development mode, return a mock response
            if (process.env.NODE_ENV === 'development') {
              this.logger.log('Development mode: Returning mock response for n8n webhook');
              return {
                success: true,
                statusCode: 200,
                data: {
                  message: 'Mock response for n8n webhook in development mode',
                  note: 'The actual webhook request failed, but we are returning a mock response for development purposes.',
                  error: error.message
                }
              };
            }
            
            throw error;
          }
          
          // If we have a response but it's an SSE response with 'event: endpoint', it means n8n received the webhook
          // but the workflow might not have been triggered. Let's log this for debugging.
          if (mcpResponse && mcpResponse.data && typeof mcpResponse.data === 'string' && mcpResponse.data.includes('event: endpoint')) {
            this.logger.log(`n8n webhook received but workflow may not have triggered. Response: ${mcpResponse.data}`);
            this.logger.log(`Hint: Make sure your n8n workflow is active and the webhook node is configured correctly.`);
            this.logger.log(`Try clicking 'Test workflow' in n8n before sending the request.`);
            
            // Extract any useful information from the SSE response
            const sessionIdMatch = mcpResponse.data.match(/sessionId=([^\s&"]+)/);
            const sessionId = sessionIdMatch ? sessionIdMatch[1] : 'unknown';
            
            // Return a more useful response instead of the raw SSE stream
            return {
              success: true,
              statusCode: 200,
              data: {
                message: 'n8n webhook received successfully',
                note: 'The webhook was received by n8n, but the workflow may not have been triggered.',
                sessionId: sessionId,
                hint: 'Make sure your n8n workflow is active and the webhook node is configured correctly.',
                originalResponse: mcpResponse.data.substring(0, 200) + '...' // Truncate for readability
              }
            };
          }
        }
        // Zapier MCP API and other SSE endpoints require GET requests
        else if (isSSE || isZapier) {
          this.logger.log(`Using GET request for ${isSSE ? 'SSE endpoint' : 'Zapier MCP API'}`);
          // For SSE endpoints and Zapier, use GET with params as query parameters
          const queryParams = new URLSearchParams();
          
          // Convert params object to query parameters
          if (params && typeof params === 'object') {
            Object.entries(params).forEach(([key, value]) => {
              // If value is an object or array, stringify it
              if (typeof value === 'object' && value !== null) {
                queryParams.append(key, JSON.stringify(value));
              } else {
                queryParams.append(key, String(value));
              }
            });
          }
          
          // Append query parameters to URL if there are any
          const url = queryParams.toString() 
            ? `${serverUrl}${serverUrl.includes('?') ? '&' : '?'}${queryParams.toString()}` 
            : serverUrl;
          
          // Log the full request details
          this.logger.log(`Making GET request to: ${url}`);
          this.logger.log(`Request headers: ${JSON.stringify(headers)}`);
          this.logger.log(`Request params: ${JSON.stringify(params)}`);
          
          // Add debugging headers
          headers['X-Debug-Source'] = 'jibu-mcp-tool';
          headers['X-Debug-Time'] = new Date().toISOString();
          mcpResponse = await axios.get(url, { headers });
        } else {
          // For regular endpoints, use POST with params in the body
          this.logger.log(`Making POST request to: ${serverUrl}`);
          mcpResponse = await axios.post(serverUrl, params, { headers });
        }
        
        this.logger.log(`MCP server response: ${JSON.stringify(mcpResponse.data)}`);
      } catch (mcpError) {
        this.logger.error(`MCP server request failed: ${mcpError.message}`, mcpError.stack);
        if (mcpError.response) {
          this.logger.error(`MCP server response status: ${mcpError.response.status}`);
          this.logger.error(`MCP server response data: ${JSON.stringify(mcpError.response.data)}`);
          
          // If we get a 404 with a message about using GET instead of POST, try again with GET
          if (mcpError.response.status === 404 && 
              typeof mcpError.response.data === 'object' && 
              mcpError.response.data.message && 
              mcpError.response.data.message.includes('Did you mean to make a GET request')) {
            
            this.logger.log('Retrying with GET request based on error message');
            try {
              // Convert params object to query parameters
              const queryParams = new URLSearchParams();
              
              if (params && typeof params === 'object') {
                Object.entries(params).forEach(([key, value]) => {
                  // If value is an object or array, stringify it
                  if (typeof value === 'object' && value !== null) {
                    queryParams.append(key, JSON.stringify(value));
                  } else {
                    queryParams.append(key, String(value));
                  }
                });
              }
              
              // Append query parameters to URL if there are any
              const url = queryParams.toString() 
                ? `${serverUrl}${serverUrl.includes('?') ? '&' : '?'}${queryParams.toString()}` 
                : serverUrl;
              
              mcpResponse = await axios.get(url, { headers });
              this.logger.log(`MCP server response after retry: ${JSON.stringify(mcpResponse.data)}`);
              
              // If we get here, the retry was successful, so we can return the result
              return {
                success: true,
                statusCode: mcpResponse.status,
                data: mcpResponse.data,
                executionId: execution.id,
              };
            } catch (retryError) {
              this.logger.error(`Retry with GET also failed: ${retryError.message}`, retryError.stack);
              // Continue with the original error
            }
          }
          
          // If we get a 401 Unauthorized, try with different authentication methods
          if (mcpError.response.status === 401) {
            this.logger.log('Got 401 Unauthorized, trying different authentication methods');
            
            // Try with API key in query parameter for Zapier
            if (serverUrl.includes('actions.zapier.com') || serverUrl.includes('zapier.com/mcp')) {
              try {
                this.logger.log('Trying Zapier with api_key as query parameter');
                
                // Remove X-API-Key header to avoid conflicts
                delete headers['X-API-Key'];
                
                // Add api_key as query parameter
                const url = `${serverUrl}${serverUrl.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(serverToken)}`;
                
                mcpResponse = await axios.get(url, { headers });
                this.logger.log(`MCP server response with query param auth: ${JSON.stringify(mcpResponse.data)}`);
                
                // If we get here, the retry was successful
                return {
                  success: true,
                  statusCode: mcpResponse.status,
                  data: mcpResponse.data,
                  executionId: execution.id,
                };
              } catch (authRetryError) {
                this.logger.error(`Auth retry also failed: ${authRetryError.message}`, authRetryError.stack);
                // Continue with the original error
              }
            }
          }
        }
        throw new HttpException(`MCP server request failed: ${mcpError.message}`, 500);
      }
      
      // Prepare the result
      const result = {
        success: true,
        statusCode: mcpResponse.status,
        data: mcpResponse.data,
        executionId: execution.id,
      };

      // Update the execution record with the result
      await this.prisma.toolExecution.update({
        where: { id: execution.id },
        data: {
          status: 'completed',
          output: result,
          completedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      this.logger.error(`Error executing MCP tool: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get the status of the MCP tool for an organization
   * @param organizationId The organization ID
   * @returns The status of the MCP tool
   */
  async getMcpToolStatus(organizationId: string) {
    try {
      // Check if the tool exists
      const tool = await this.prisma.tool.findFirst({
        where: {
          organizationId,
          type: 'mcp.execute',
        },
      });

      return {
        configured: !!tool,
        enabled: tool?.enabled || false,
        toolExists: !!tool,
      };
    } catch (error) {
      this.logger.error(`Error getting MCP tool status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Configure the MCP tool for an organization
   * @param config The MCP tool configuration
   * @param organizationId The organization ID
   * @param userId The user ID
   * @returns The created or updated tool
   */
  async configureMcpTool(config: any, organizationId: string, userId: string) {
    try {
      // Check if the tool already exists
      const existingTool = await this.prisma.tool.findFirst({
        where: {
          organizationId,
          type: 'mcp.execute',
        },
      });

      if (existingTool) {
        // Update the existing tool
        return this.prisma.tool.update({
          where: { id: existingTool.id },
          data: {
            name: config.name || 'MCP Tool',
            description: config.description || 'Execute MCP server tools',
            function: config.function || { name: 'execute', parameters: {} },
            metadata: {
              serverUrl: config.serverUrl,
              serverToken: config.serverToken,
              timeout: config.timeout || 30,
            },
            enabled: config.enabled !== undefined ? config.enabled : true,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create a new tool
        return this.prisma.tool.create({
          data: {
            organizationId,
            createdById: userId,
            name: config.name || 'MCP Tool',
            description: config.description || 'Execute MCP server tools',
            type: 'mcp.execute',
            function: config.function || { name: 'execute', parameters: {} },
            messages: [],
            metadata: {
              serverUrl: config.serverUrl,
              serverToken: config.serverToken,
              timeout: config.timeout || 30,
            },
            enabled: config.enabled !== undefined ? config.enabled : true,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error configuring MCP tool: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * List resources from an MCP server
   * @param serverUrl The MCP server URL
   * @param serverToken Optional server token for authentication
   * @param cursor Optional pagination cursor
   * @returns List of resources from the MCP server
   */
  async listMcpResources(serverUrl: string, serverToken?: string, cursor?: string) {
    try {
      this.logger.log(`Listing resources from MCP server: ${serverUrl}`);
      
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if token is available
      if (serverToken) {
        // Zapier MCP uses X-API-Key header for authentication
        if (serverUrl.includes('actions.zapier.com') || serverUrl.includes('zapier.com/mcp')) {
          this.logger.log('Detected Zapier MCP endpoint, using X-API-Key authentication');
          headers['X-API-Key'] = serverToken;
        } else {
          // Default to Bearer token for other services
          headers['Authorization'] = `Bearer ${serverToken}`;
        }
      }
      
      // Prepare URL with cursor if provided
      let url = serverUrl;
      const queryParams = new URLSearchParams();
      
      if (cursor) {
        queryParams.append('cursor', cursor);
      }
      
      // For Zapier, add api_key as query parameter as a fallback
      if ((serverUrl.includes('actions.zapier.com') || serverUrl.includes('zapier.com/mcp')) && serverToken) {
        queryParams.append('api_key', serverToken);
      }
      
      // Append query parameters to URL if there are any
      if (queryParams.toString()) {
        url = `${url}${url.includes('?') ? '&' : '?'}${queryParams.toString()}`;
      }
      
      this.logger.log(`Making GET request to: ${url}`);
      
      // Make the request to the MCP server
      const response = await axios.get(url, { headers });
      
      return response.data;
    } catch (error) {
      this.logger.error(`Error listing MCP resources: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Read a resource from an MCP server
   * @param serverUrl The URL of the MCP server
   * @param resourceUri The URI of the resource to read
   * @param serverToken Optional token for authentication
   * @returns The resource content
   */
  async readMcpResource(serverUrl: string, resourceUri: string, serverToken?: string) {
    this.logger.log(`Reading resource from MCP server: ${serverUrl}, URI: ${resourceUri}`);
    
    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if token is available
      if (serverToken) {
        // Zapier MCP uses X-API-Key header for authentication
        if (serverUrl.includes('actions.zapier.com') || serverUrl.includes('zapier.com/mcp')) {
          headers['X-API-Key'] = serverToken;
        } else {
          // Default to Bearer token for other services
          headers['Authorization'] = `Bearer ${serverToken}`;
        }
      }
      
      // Make the request to the MCP server
      const response = await axios.get(`${serverUrl}/${resourceUri}`, { headers });
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Error reading resource from MCP server: ${error.message}`);
      
      // Check if it's an Axios error with a response
      if (error.response) {
        this.logger.error(`MCP server response status: ${error.response.status}`);
        this.logger.error(`MCP server response data: ${JSON.stringify(error.response.data)}`);
      }
      
      throw new HttpException(
        `Error reading resource from MCP server: ${error.message}`,
        error.response?.status || 500
      );
    }
  }

  /**
   * Discover available tools from an MCP server
   * @param serverUrl The URL of the MCP server
   * @param serverToken Optional token for authentication
   * @returns List of available tools from the MCP server
   */
  async discoverTools(serverUrl: string, serverToken?: string) {
    this.logger.log(`Discovering tools from MCP server: ${serverUrl}`);
    
    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      // Add authorization header if token is available
      if (serverToken) {
        // Zapier MCP uses X-API-Key header for authentication
        if (serverUrl.includes('actions.zapier.com') || serverUrl.includes('zapier.com/mcp')) {
          headers['X-API-Key'] = serverToken;
        } else if (serverUrl.includes('vapi.ai') || serverUrl.includes('vapi.com')) {
          // Vapi MCP uses x-vapi-secret header for authentication
          headers['x-vapi-secret'] = serverToken;
        } else {
          // Default to Bearer token for other services
          headers['Authorization'] = `Bearer ${serverToken}`;
        }
      }
      
      // Make the request to the MCP server
      // Most MCP servers use a GET request for tool discovery
      const response = await axios.get(serverUrl, { headers });
      
      // Different MCP servers may have different response formats
      // We'll try to normalize them
      let tools = [];
      
      if (response.data.tools) {
        // Standard MCP format
        tools = response.data.tools;
      } else if (response.data.resources) {
        // Some MCP servers use 'resources' instead of 'tools'
        tools = response.data.resources;
      } else if (Array.isArray(response.data)) {
        // Some MCP servers return an array directly
        tools = response.data;
      }
      
      return {
        success: true,
        tools,
        rawResponse: response.data, // Include the raw response for debugging
      };
    } catch (error) {
      this.logger.error(`Error discovering tools from MCP server: ${error.message}`);
      
      // Check if it's an Axios error with a response
      if (error.response) {
        this.logger.error(`MCP server response status: ${error.response.status}`);
        this.logger.error(`MCP server response data: ${JSON.stringify(error.response.data)}`);
      }
      
      throw new HttpException(
        `Error discovering tools from MCP server: ${error.message}`,
        error.response?.status || 500
      );
    }
  }
}
