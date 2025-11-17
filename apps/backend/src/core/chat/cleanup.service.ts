import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatService } from './chat.service';
import { CHAT_TTL_CONFIG } from './chat.interfaces';

/**
 * ChatCleanupService - Automated cleanup of inactive conversations
 * Phase 4: Cron-based session cleanup
 * 
 * Features:
 * - Runs every 30 minutes
 * - Removes conversations inactive for more than 1 hour
 * - Cleans up user sessions mapping
 * - Maintains active sessions set
 */
@Injectable()
export class ChatCleanupService {
  private readonly logger = new Logger(ChatCleanupService.name);
  private isRunning = false;

  constructor(private readonly chatService: ChatService) {}

  /**
   * Cleanup inactive conversations
   * Runs every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async cleanupInactiveSessions(): Promise<void> {
    // Prevent concurrent cleanup runs
    if (this.isRunning) {
      this.logger.warn('Cleanup already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting conversation cleanup...');

      // Get all active sessions
      const activeSessions = await this.chatService.getActiveSessions();
      
      if (activeSessions.length === 0) {
        this.logger.log('No active sessions to cleanup');
        return;
      }

      this.logger.log(`Found ${activeSessions.length} active sessions`);

      let cleanedCount = 0;
      let errorCount = 0;
      const now = Date.now();
      const inactiveThreshold = now - CHAT_TTL_CONFIG.INACTIVE_TIMEOUT;

      // Check each session for inactivity
      for (const sessionId of activeSessions) {
        try {
          const conversation = await this.chatService.getConversation(sessionId);

          if (!conversation) {
            // Conversation doesn't exist, remove from active sessions
            await this.chatService.removeFromActiveSessions(sessionId);
            cleanedCount++;
            this.logger.debug(
              `Removed non-existent session ${sessionId} from active sessions`,
            );
            continue;
          }

          // Check if conversation is inactive
          if (conversation.lastActivity < inactiveThreshold) {
            // Delete inactive conversation
            await this.chatService.deleteConversation(sessionId);
            cleanedCount++;
            this.logger.debug(
              `Cleaned up inactive conversation ${sessionId} (last activity: ${new Date(conversation.lastActivity).toISOString()})`,
            );
          }
        } catch (error) {
          const err = error as Error;
          errorCount++;
          this.logger.error(
            `Error cleaning up session ${sessionId}: ${err.message}`,
            err.stack,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Cleanup completed in ${duration}ms: ${cleanedCount} sessions cleaned, ${errorCount} errors`,
      );

      // Log metrics
      this.logCleanupMetrics(activeSessions.length, cleanedCount, errorCount, duration);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Cleanup job failed: ${err.message}`,
        err.stack,
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual cleanup trigger (for testing or maintenance)
   */
  async triggerCleanup(): Promise<{
    success: boolean;
    cleaned: number;
    errors: number;
    duration: number;
  }> {
    const startTime = Date.now();

    try {
      const activeSessions = await this.chatService.getActiveSessions();
      let cleanedCount = 0;
      let errorCount = 0;
      const now = Date.now();
      const inactiveThreshold = now - CHAT_TTL_CONFIG.INACTIVE_TIMEOUT;

      for (const sessionId of activeSessions) {
        try {
          const conversation = await this.chatService.getConversation(sessionId);

          if (!conversation) {
            await this.chatService.removeFromActiveSessions(sessionId);
            cleanedCount++;
            continue;
          }

          if (conversation.lastActivity < inactiveThreshold) {
            await this.chatService.deleteConversation(sessionId);
            cleanedCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        cleaned: cleanedCount,
        errors: errorCount,
        duration,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Manual cleanup failed: ${err.message}`,
        err.stack,
      );
      
      return {
        success: false,
        cleaned: 0,
        errors: 1,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    activeSessions: number;
    inactiveSessions: number;
    oldestActivity: number | null;
    newestActivity: number | null;
  }> {
    try {
      const activeSessions = await this.chatService.getActiveSessions();
      let inactiveCount = 0;
      let oldestActivity: number | null = null;
      let newestActivity: number | null = null;
      const now = Date.now();
      const inactiveThreshold = now - CHAT_TTL_CONFIG.INACTIVE_TIMEOUT;

      for (const sessionId of activeSessions) {
        const conversation = await this.chatService.getConversation(sessionId);

        if (!conversation) {
          inactiveCount++;
          continue;
        }

        if (conversation.lastActivity < inactiveThreshold) {
          inactiveCount++;
        }

        // Track oldest and newest activity
        if (oldestActivity === null || conversation.lastActivity < oldestActivity) {
          oldestActivity = conversation.lastActivity;
        }
        if (newestActivity === null || conversation.lastActivity > newestActivity) {
          newestActivity = conversation.lastActivity;
        }
      }

      return {
        activeSessions: activeSessions.length - inactiveCount,
        inactiveSessions: inactiveCount,
        oldestActivity,
        newestActivity,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get cleanup stats: ${err.message}`,
        err.stack,
      );
      
      return {
        activeSessions: 0,
        inactiveSessions: 0,
        oldestActivity: null,
        newestActivity: null,
      };
    }
  }

  /**
   * Log cleanup metrics
   */
  private logCleanupMetrics(
    totalSessions: number,
    cleanedCount: number,
    errorCount: number,
    duration: number,
  ): void {
    const metrics = {
      totalSessions,
      cleanedCount,
      errorCount,
      duration,
      cleanupRate: totalSessions > 0 ? (cleanedCount / totalSessions) * 100 : 0,
    };

    this.logger.log(
      `Cleanup metrics: ${JSON.stringify(metrics)}`,
    );

    // Warn if cleanup took too long
    if (duration > 30000) {
      this.logger.warn(
        `Cleanup took longer than expected: ${duration}ms (threshold: 30000ms)`,
      );
    }

    // Warn if error rate is high
    if (errorCount > 0 && totalSessions > 0) {
      const errorRate = (errorCount / totalSessions) * 100;
      if (errorRate > 10) {
        this.logger.warn(
          `High error rate during cleanup: ${errorRate.toFixed(2)}%`,
        );
      }
    }
  }
}
