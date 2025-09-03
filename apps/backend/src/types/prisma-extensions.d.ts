/**
 * Temporary type definitions to fix Prisma client type errors
 */

// Define the WorkflowType enum as it is in the schema
export enum WorkflowType {
  MASTER = 'MASTER',
  SECONDARY = 'SECONDARY'
}

// Define a basic workflow model type
interface Workflow {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description?: string;
  workflowJson: any; // consolidated JSON of workflow (nodes, edges, startNodeId, etc.)
  version: number;
  isPublished: boolean;
  publishedAt?: Date;
  workflowType: WorkflowType;
  masterWorkflowId?: string;
  agentId: string;
  agent?: any;
  organizationId: string;
  organization?: any;
  masterWorkflow?: Workflow;
  secondaryWorkflows?: Workflow[];
}

// Extend PrismaClient to include missing models
declare namespace PrismaNamespace {
  interface PrismaClient {
    user: any;
    organization: any;
    organizationMembership: any;
    file: any;
    invitation: any;
    workflow: {
      findMany: (args: any) => Promise<Workflow[]>;
      findUnique: (args: any) => Promise<Workflow | null>;
      findFirst: (args: any) => Promise<Workflow | null>;
      create: (args: any) => Promise<Workflow>;
      update: (args: any) => Promise<Workflow>;
      delete: (args: any) => Promise<Workflow>;
      upsert: (args: any) => Promise<Workflow>;
      count: (args: any) => Promise<number>;
    };
    agent: any;
    tool: any;
    toolExecution: any;
    $transaction: <T>(fn: (prisma: PrismaClient) => Promise<T>) => Promise<T>;
  }
}

// For the PrismaService in your app
declare module '../../../../core/database/prisma.service' {
  import { PrismaClient } from '@prisma/client';
  
  export class PrismaService extends PrismaClient {
    user: any;
    organization: any;
    organizationMembership: any;
    file: any;
    invitation: any;
    workflow: PrismaNamespace.PrismaClient['workflow'];
    agent: any;
    tool: any;
    toolExecution: any;
    $transaction: PrismaNamespace.PrismaClient['$transaction'];
  }
}

// Extend the global namespace
declare global {
  namespace NodeJS {
    interface Global {
      prisma: PrismaNamespace.PrismaClient;
    }
  }
}

export {};
