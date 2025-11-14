import { Injectable, Logger } from '@nestjs/common';
import { WebhookCacheService } from '@jibu/cache-utils';
import { ConnectionContext } from '@jibu/queue-definitions';

/**
 * Service for managing active voice call connections
 * Uses Redis for state management with 5-minute TTL
 */
@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);
  private readonly HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
  private readonly CONNECTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly cacheService: WebhookCacheService) {}

  /**
   * Create a new connection context for a voice call
   * @param workflowId - The workflow ID
   * @param sessionId - The session ID
   * @param callSid - Optional Twilio call SID
   * @param metadata - Optional metadata
   */
  async createConnection(
    workflowId: string,
    sessionId: string,
    callSid?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const connectionId = this.generateConnectionId(workflowId, sessionId);
    const now = Date.now();

    const context: ConnectionContext = {
      workflowId,
      sessionId,
      callSid,
      startTime: now,
      lastHeartbeat: now,
      isActive: true,
      metadata,
    };

    await this.cacheService.setConnectionContext(connectionId, context);

    this.logger.log(
      `Connection created: ${connectionId} for workflow ${workflowId}, session ${sessionId}`
    );

    return connectionId;
  }

  /**
   * Get connection context by connection ID
   * @param connectionId - The connection ID
   */
  async getConnection(connectionId: string): Promise<ConnectionContext | null> {
    return this.cacheService.getConnectionContext(connectionId);
  }

  /**
   * Get connection context by workflow ID and session ID
   * @param workflowId - The workflow ID
   * @param sessionId - The session ID
   */
  async getConnectionBySession(
    workflowId: string,
    sessionId: string
  ): Promise<ConnectionContext | null> {
    return this.cacheService.getConnectionContextBySession(workflowId, sessionId);
  }

  /**
   * Update connection heartbeat
   * Should be called every 15 seconds during active calls
   * @param connectionId - The connection ID
   */
  async updateHeartbeat(connectionId: string): Promise<void> {
    await this.cacheService.updateConnectionHeartbeat(connectionId);
    this.logger.debug(`Heartbeat updated for connection ${connectionId}`);
  }

  /**
   * Update connection metadata
   * @param connectionId - The connection ID
   * @param metadata - Metadata to merge
   */
  async updateMetadata(
    connectionId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    const context = await this.getConnection(connectionId);

    if (!context) {
      this.logger.warn(`Cannot update metadata: connection ${connectionId} not found`);
      return;
    }

    context.metadata = { ...context.metadata, ...metadata };
    await this.cacheService.setConnectionContext(connectionId, context);

    this.logger.debug(`Metadata updated for connection ${connectionId}`);
  }

  /**
   * Mark connection as inactive (call ended gracefully)
   * @param connectionId - The connection ID
   */
  async endConnection(connectionId: string): Promise<void> {
    const context = await this.getConnection(connectionId);

    if (!context) {
      this.logger.warn(`Cannot end connection: ${connectionId} not found`);
      return;
    }

    context.isActive = false;
    await this.cacheService.setConnectionContext(connectionId, context);

    // Remove after a short delay to allow final cleanup
    setTimeout(async () => {
      await this.cacheService.removeConnectionContext(connectionId);
    }, 5000);

    this.logger.log(`Connection ended: ${connectionId}`);
  }

  /**
   * Remove connection context immediately (call failed or terminated)
   * @param connectionId - The connection ID
   */
  async removeConnection(connectionId: string): Promise<void> {
    await this.cacheService.removeConnectionContext(connectionId);
    this.logger.log(`Connection removed: ${connectionId}`);
  }

  /**
   * Check if a connection is still active
   * @param connectionId - The connection ID
   * @param maxIdleMs - Maximum idle time (default 30 seconds)
   */
  async isConnectionActive(
    connectionId: string,
    maxIdleMs: number = 30000
  ): Promise<boolean> {
    return this.cacheService.isConnectionActive(connectionId, maxIdleMs);
  }

  /**
   * Get all active connections for a workflow
   * Note: This requires scanning Redis keys, use sparingly
   * @param workflowId - The workflow ID
   */
  async getActiveConnectionsForWorkflow(workflowId: string): Promise<ConnectionContext[]> {
    // This would require Redis SCAN operation
    // For now, we'll log a warning that this is not implemented
    this.logger.warn(
      `getActiveConnectionsForWorkflow not fully implemented - requires Redis SCAN`
    );
    return [];
  }

  /**
   * Cleanup stale connections (connections that haven't sent heartbeat)
   * Should be called periodically by a cron job
   */
  async cleanupStaleConnections(): Promise<number> {
    this.logger.log('Starting cleanup of stale connections...');
    // This would require Redis SCAN operation
    // For now, we rely on Redis TTL for automatic cleanup
    this.logger.log('Stale connection cleanup relies on Redis TTL (5 minutes)');
    return 0;
  }

  /**
   * Generate a unique connection ID
   * @param workflowId - The workflow ID
   * @param sessionId - The session ID
   */
  private generateConnectionId(workflowId: string, sessionId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `conn_${workflowId}_${sessionId}_${timestamp}_${random}`;
  }

  /**
   * Get heartbeat interval in milliseconds
   */
  getHeartbeatInterval(): number {
    return this.HEARTBEAT_INTERVAL_MS;
  }

  /**
   * Get connection timeout in milliseconds
   */
  getConnectionTimeout(): number {
    return this.CONNECTION_TIMEOUT_MS;
  }
}
