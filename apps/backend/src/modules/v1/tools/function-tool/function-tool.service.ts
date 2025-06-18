import { Injectable, Logger, HttpException } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import axios from 'axios';

@Injectable()
export class FunctionToolService {
  private readonly logger = new Logger(FunctionToolService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute a function with the provided parameters
   * @param params The parameters to pass to the function
   * @param organizationId The organization ID
   * @param userId The user ID
   * @returns The result of the function execution
   */
  async executeFunction(params: any, organizationId: string, userId: string) {
    this.logger.log(`Executing function with params: ${JSON.stringify(params)}`);
    
    try {
      // Log the execution in the database
      const tool = await this.prisma.tool.findFirst({
        where: {
          organizationId,
          type: 'function.execute',
        },
      });

      if (!tool) {
        throw new Error('Function tool not configured for this organization');
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
        throw new Error('Server URL not configured for this function tool');
      }
      
      this.logger.log(`Sending request to external webhook: ${serverUrl}`);
      
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if token is available
      if (serverToken) {
        headers['Authorization'] = `Bearer ${serverToken}`;
      }
      
      // Make the actual HTTP request to the external webhook
      let webhookResponse;
      try {
        webhookResponse = await axios.post(serverUrl, params, { headers });
        this.logger.log(`Webhook response: ${JSON.stringify(webhookResponse.data)}`);
      } catch (webhookError) {
        this.logger.error(`Webhook request failed: ${webhookError.message}`, webhookError.stack);
        if (webhookError.response) {
          this.logger.error(`Webhook response status: ${webhookError.response.status}`);
          this.logger.error(`Webhook response data: ${JSON.stringify(webhookError.response.data)}`);
        }
        throw new HttpException(`Webhook request failed: ${webhookError.message}`, 500);
      }
      
      // Prepare the result
      const result = {
        success: true,
        statusCode: webhookResponse.status,
        data: webhookResponse.data,
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
      this.logger.error(`Error executing function: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get the status of the function tool for an organization
   * @param organizationId The organization ID
   * @returns The status of the function tool
   */
  async getFunctionToolStatus(organizationId: string) {
    try {
      const tool = await this.prisma.tool.findFirst({
        where: {
          organizationId,
          type: 'function.execute',
        },
      });

      return {
        configured: !!tool,
        enabled: tool?.enabled || false,
        toolExists: !!tool,
      };
    } catch (error) {
      this.logger.error(`Error getting function tool status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Configure the function tool for an organization
   * @param config The function tool configuration
   * @param organizationId The organization ID
   * @param userId The user ID
   * @returns The created or updated tool
   */
  async configureFunctionTool(config: any, organizationId: string, userId: string) {
    try {
      // Check if the tool already exists
      const existingTool = await this.prisma.tool.findFirst({
        where: {
          organizationId,
          type: 'function.execute',
        },
      });

      if (existingTool) {
        // Update the existing tool
        return this.prisma.tool.update({
          where: { id: existingTool.id },
          data: {
            name: config.name || 'Function Tool',
            description: config.description || 'Execute custom functions',
            function: config.function || { name: 'execute', parameters: {} },
            metadata: config.metadata || {},
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
            name: config.name || 'Function Tool',
            description: config.description || 'Execute custom functions',
            type: 'function.execute',
            function: config.function || { name: 'execute', parameters: {} },
            messages: [],
            metadata: config.metadata || {},
            enabled: config.enabled !== undefined ? config.enabled : true,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error configuring function tool: ${error.message}`, error.stack);
      throw error;
    }
  }
}
