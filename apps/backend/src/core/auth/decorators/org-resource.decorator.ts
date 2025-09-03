import { SetMetadata } from '@nestjs/common';
import { ORG_RESOURCE_KEY } from '../guards/org-resource.guard';

/**
 * Decorator to mark a route as requiring workspace-scoped resource validation
 * Backward-compat: name and metadata key remain org-prefixed, but checks use workspaceId.
 * @param model The Prisma model name to check (e.g., 'folder', 'agent')
 * @param paramName The parameter name in the request that contains the resource ID (default: 'id')
 */
export const OrgResource = (model: string, paramName: string = 'id') => 
  SetMetadata(ORG_RESOURCE_KEY, { model, paramName });
