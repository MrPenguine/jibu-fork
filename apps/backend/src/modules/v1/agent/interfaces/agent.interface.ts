import { Agent as PrismaAgent } from '@prisma/client';

/**
 * Extended Agent interface that includes all fields from the Prisma Agent model
 * plus additional properties used in the application
 */
export interface ExtendedAgent extends PrismaAgent {
  // Additional properties not in the Prisma model
  nodes?: any;
  edges?: any;
  startNodeId?: string;
  isPublished?: boolean;
  workflows?: any[];
  
  // Ensure all Prisma fields are properly typed
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string | null;
  metadata: any | null;
  workspaceId: string;
  n8nWorkflowId: string | null;
  folderId: string | null;
}
