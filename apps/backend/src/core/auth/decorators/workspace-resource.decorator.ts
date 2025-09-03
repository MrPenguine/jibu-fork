import { SetMetadata } from '@nestjs/common';

export const WORKSPACE_RESOURCE_KEY = 'workspaceResource';

/**
 * Decorator to mark a route as requiring workspace resource validation
 * @param model The Prisma model name to check (e.g., 'folder', 'assistant')
 * @param paramName The parameter name in the request that contains the resource ID (default: 'id')
 */
export const WorkspaceResource = (model: string, paramName: string = 'id') => 
  SetMetadata(WORKSPACE_RESOURCE_KEY, { model, paramName });
