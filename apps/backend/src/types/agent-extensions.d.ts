import { Agent as PrismaAgent, Prisma } from '@prisma/client';
import { AgentNodeType, FlowNode, FlowEdge } from '../../../../../../libs/src';

/**
 * Extended Agent type with workflow-related fields
 */
declare global {
  // Extend the Agent type from Prisma
  namespace PrismaNamespace {
    interface AgentWhereInput {
      id?: string | Prisma.StringFilter;
      organizationId?: string | Prisma.StringFilter;
      [key: string]: any;
    }
  }
}

// Augment the Agent type from @prisma/client
declare module '@prisma/client' {
  // Add workflow fields to Agent type
  interface Agent {
    nodes?: any; // Stored as JSON in the database, representing FlowNode[]
    edges?: any; // Stored as JSON in the database, representing FlowEdge[]
    startNodeId?: string;
    workflowType?: string;
    masterWorkflowId?: string;
    workflows?: any[];
  }

  // Extend Prisma's generated types as well
  namespace Prisma {
    interface AgentWhereInput {
      nodes?: any;
      edges?: any;
      startNodeId?: string | StringFilter;
      workflowType?: string | StringFilter;
      masterWorkflowId?: string | StringFilter;
    }
  }
}

// Extend the PrismaService to include Agent operations with our extended types
declare module '../../../../core/database/prisma.service' {
  import { Agent } from '@prisma/client';
  
  export interface PrismaService {
    agent: {
      findFirst: (args: any) => Promise<Agent>;
      findMany: (args: any) => Promise<Agent[]>;
      findUnique: (args: any) => Promise<Agent | null>;
      create: (args: any) => Promise<Agent>;
      update: (args: any) => Promise<Agent>;
      delete: (args: any) => Promise<Agent>;
      upsert: (args: any) => Promise<Agent>;
      count: (args: any) => Promise<number>;
    };
  }
}

export {};
