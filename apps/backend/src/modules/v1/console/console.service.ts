import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../core/redis/redis.service';
import { PrismaService } from '../../../core/database/prisma.service';

export interface ConsoleEntry {
  id: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  timestamp: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ConsoleService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Log a message to the console for an assistant
   */
  async logMessage(
    assistantId: string, 
    sessionId: string,
    message: string, 
    level: 'info' | 'warning' | 'error' | 'debug' = 'info',
    metadata?: Record<string, any>
  ): Promise<ConsoleEntry> {
    const entry: ConsoleEntry = {
      id: this.generateId(),
      message,
      level,
      timestamp: new Date().toISOString(),
      metadata
    };

    try {
      const redisKey = `console:${assistantId}:${sessionId}`;
      
      // Get existing console entries
      const existingEntries = await this.getConsoleEntries(assistantId, sessionId);
      
      // Add new entry
      existingEntries.push(entry);
      
      // Save back to Redis
      await this.redis.set(redisKey, JSON.stringify(existingEntries));
      
      return entry;
    } catch (error) {
      console.error('Failed to log console message:', error);
      throw error;
    }
  }

  /**
   * Get all console entries for an assistant session
   */
  async getConsoleEntries(
    assistantId: string, 
    sessionId: string
  ): Promise<ConsoleEntry[]> {
    try {
      const redisKey = `console:${assistantId}:${sessionId}`;
      
      // Get existing chat history from Redis
      const existingEntries = await this.redis.get(redisKey);
      
      if (!existingEntries) {
        // If no entries exist, initialize with empty array
        await this.redis.set(redisKey, JSON.stringify([]));
        return [];
      }
      
      return JSON.parse(existingEntries);
    } catch (error) {
      console.error('Failed to get console entries:', error);
      return [];
    }
  }

  /**
   * Clear console entries for an assistant session
   */
  async clearConsole(
    assistantId: string, 
    sessionId: string
  ): Promise<boolean> {
    try {
      const redisKey = `console:${assistantId}:${sessionId}`;
      
      // Set an empty array in Redis
      await this.redis.set(redisKey, JSON.stringify([]));
      
      return true;
    } catch (error) {
      console.error('Failed to clear console:', error);
      return false;
    }
  }

  /**
   * Verify if the assistant exists in the organization
   */
  async verifyAssistant(assistantId: string, organizationId: string): Promise<boolean> {
    const assistant = await this.prisma.assistant.findFirst({
      where: {
        id: assistantId,
        organizationId
      }
    });

    return !!assistant;
  }

  /**
   * Generate a unique ID for a console entry
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
} 