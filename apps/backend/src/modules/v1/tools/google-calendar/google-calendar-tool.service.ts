import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../core/database/prisma.service';
import { CredentialService } from '../../credential/credential.service';

// Type declaration to handle the PrismaService extensions
declare module '../../../../core/database/prisma.service' {
  interface PrismaService {
    Tool: any;
    Credential: any;
  }
}

@Injectable()
export class GoogleCalendarToolService {
  private readonly logger = new Logger(GoogleCalendarToolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: CredentialService,
  ) {}

  /**
   * Store Google Calendar OAuth tokens as a credential
   */
  async storeGoogleCalendarCredential(
    tokens: any,
    organizationId: string,
    userId: string,
    name: string = 'Google Calendar',
  ) {
    try {
      this.logger.log(`Storing Google Calendar credentials for org: ${organizationId}`);
      
      // Create a credential for the tokens
      const credential = await this.credentialService.createCredential(
        {
          type: 'google.calendar',
          name,
          data: tokens,
        },
        organizationId,
        userId,
      );

      this.logger.log(`Created credential with ID: ${credential.id}`);
      
      return credential;
    } catch (error) {
      this.logger.error('Error storing Google Calendar credential:', error);
      throw error;
    }
  }

  /**
   * Create a Google Calendar tool
   */
  async createGoogleCalendarTool(
    organizationId: string,
    userId: string,
    credentialId: string,
    calendarId: string = 'primary',
    timeZone: string = 'UTC',
  ) {
    try {
      this.logger.log(`Creating Google Calendar tool for org: ${organizationId}`);
      
      // Check if a tool with this name already exists
      const existingTool = await this.prisma.Tool.findFirst({
        where: {
          organizationId,
          name: 'google_calendar_check_availability_tool',
        },
      });

      if (existingTool) {
        this.logger.log(`Updating existing Google Calendar tool: ${existingTool.id}`);
        
        // Update the existing tool
        const updatedTool = await this.prisma.tool.update({
          where: { id: existingTool.id },
          data: {
            credentialId,
            metadata: {
              calendarId,
              timeZone,
            },
            updatedAt: new Date(),
          },
        });
        
        return updatedTool;
      }
      
      // Create a new tool
      const tool = await this.prisma.Tool.create({
        data: {
          organizationId,
          name: 'google_calendar_check_availability_tool',
          description: 'Check availability in Google Calendar',
          type: 'google.calendar.availability.check',
          function: {
            name: 'google_calendar_check_availability',
            parameters: {
              type: 'object',
              properties: {
                startTime: {
                  type: 'string',
                  format: 'date-time',
                },
                endTime: {
                  type: 'string',
                  format: 'date-time',
                },
                timeZone: {
                  type: 'string',
                  default: 'UTC',
                },
              },
              required: ['startTime', 'endTime'],
            },
          },
          messages: [
            {
              type: 'request-start',
              content: 'Checking calendar availability...',
              blocking: false,
            },
            {
              type: 'request-complete',
              role: 'assistant',
              content: 'Calendar availability check complete.',
              endCallAfterSpokenEnabled: false,
            },
            {
              type: 'request-failed',
              content: 'Failed to check calendar availability.',
              endCallAfterSpokenEnabled: false,
            },
          ],
          metadata: {
            calendarId,
            timeZone,
          },
          credentialId,
          createdById: userId,
        },
      });
      
      this.logger.log(`Created Google Calendar tool with ID: ${tool.id}`);
      
      return tool;
    } catch (error) {
      this.logger.error('Error creating Google Calendar tool:', error);
      throw error;
    }
  }

  /**
   * Create or update a Google Calendar tool
   */
  async createOrUpdateGoogleCalendarTool(
    organizationId: string,
    userId: string,
    credentialId: string,
    calendarId: string = 'primary',
    timeZone: string = 'UTC',
  ) {
    try {
      this.logger.log(`Creating/updating Google Calendar tool for org: ${organizationId}`);
      
      // Check if a tool already exists
      const existingTool = await this.prisma.Tool.findFirst({
        where: {
          organizationId,
          type: 'google.calendar.availability.check',
        },
      });

      if (existingTool) {
        this.logger.log(`Updating existing Google Calendar tool: ${existingTool.id}`);
        
        // Update the existing tool
        const updatedTool = await this.prisma.tool.update({
          where: { id: existingTool.id },
          data: {
            credentialId,
            metadata: {
              calendarId,
              timeZone,
            },
            updatedAt: new Date(),
          },
        });
        
        return updatedTool;
      } else {
        // Create a new tool
        return this.createGoogleCalendarTool(
          organizationId,
          userId,
          credentialId,
          calendarId,
          timeZone,
        );
      }
    } catch (error) {
      this.logger.error('Error creating/updating Google Calendar tool:', error);
      throw error;
    }
  }

  /**
   * Delete a Google Calendar tool
   */
  async deleteGoogleCalendarTool(organizationId: string) {
    try {
      this.logger.log(`Deleting Google Calendar tool for org: ${organizationId}`);
      
      // Find the tool
      const tool = await this.prisma.Tool.findFirst({
        where: {
          organizationId,
          type: 'google.calendar.availability.check',
        },
      });

      if (!tool) {
        this.logger.log('No Google Calendar tool found to delete');
        return { success: false, message: 'Tool not found' };
      }

      // Delete the tool
      await this.prisma.Tool.delete({
        where: { id: tool.id },
      });

      this.logger.log(`Deleted Google Calendar tool with ID: ${tool.id}`);
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting Google Calendar tool:', error);
      throw error;
    }
  }
}