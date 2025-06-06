# Workflow Saving and Retrieval Implementation Plan

This document outlines the plan for implementing workflow saving and retrieval functionality in the Jibu Console application.

## 1. Backend API Integration

### 1.1 Existing Workflow API Controller
The backend implementation is already in place with:
- Controller: `apps/backend/src/modules/v1/workflow/controllers/workflow.controller.ts`
- Service: `apps/backend/src/modules/v1/workflow/services/workflow.service.ts`
- DTOs: `apps/backend/src/modules/v1/workflow/dto/` directory

Available endpoints:
- `GET /v1/workflows/:id` - Get workflow by ID
- `GET /v1/workflows/agent/:agentId/workflows` - List workflows for an agent
- `POST /v1/workflows/agent/:agentId` - Create a master workflow
- `POST /v1/workflows/:masterWorkflowId/secondary` - Create a secondary workflow
- `PUT /v1/workflows/:id` - Update an existing workflow
- `PUT /v1/workflows/:id/publish` - Publish a workflow
- `PUT /v1/workflows/:id/unpublish` - Unpublish a workflow
- `DELETE /v1/workflows/:id` - Delete a workflow

### 1.2 Understanding Data Models
- `CreateWorkflowDto` - For creating master workflows
- `CreateSecondaryWorkflowDto` - For creating secondary workflows  
- `UpdateWorkflowDto` - For updating existing workflows
- All DTOs support nodes and edges as JSON structures

### 1.3 Workflow Types
The backend supports two workflow types:
- `MASTER` - Main workflow for an agent
- `SECONDARY` - Alternative workflows that inherit from a master workflow

## 2. Frontend Implementation

### 2.1 Update AgentDesigner Component
- Modify the `saveWorkspace` function to:
  - Call the existing `/v1/workflows/:id` PUT endpoint instead of localStorage
  - Convert the current autosave logic to work with API calls
  - Implement proper error handling and loading states
  - Keep debouncing for autosave to prevent excessive API calls

### 2.2 Integrate with Workflow API Client
- Create a utility function to format node and edge data for the API
- Create helper methods to handle workflow retrieval and updates
- Support both master and secondary workflow operations
- Add proper error handling for API failures

### 2.3 Connection Preservation
- Ensure KnowledgeBase node connections to Assistant nodes are maintained when saving
- Track and preserve node relationship metadata during save/load
- Implement validation to enforce required connections on load

## 3. User Experience Enhancements

### 3.1 Autosave Functionality
- Keep the existing visual indicators for save status (saving/saved/error)
- Maintain the debounced autosave (5 seconds after changes)
- Continue showing last saved timestamp
- Add a new workflow loading state indicator

### 3.2 Error Handling
- Add toast notifications for API errors using the existing UI components
- Implement recovery mechanisms for failed API calls
- Keep manual save button as fallback for API failures
- Add connection validation feedback for required connections

## 4. Testing Strategy

### 4.1 API Integration Testing
- Test integration with the existing workflow API endpoints
- Verify correct request/response handling for various workflow operations
- Test edge cases (large workflows, special characters, etc.)

### 4.2 Frontend Testing
- Test workflow saving and loading via the API
- Test connection preservation between nodes, especially Assistant-KnowledgeBase connections
- Test autosave behavior with backend integration
- Test error handling and recovery

## Implementation Rules

1. **Data Integrity**:
   - Always validate workflow data structure before saving
   - Use transactions for database operations to prevent partial updates
   - Implement proper error handling and rollbacks

2. **Performance**:
   - Use pagination for listing workflows
   - Implement caching for frequently accessed workflows
   - Optimize JSON serialization for large workflows

3. **Security**:
   - Validate user permissions before workflow operations
   - Sanitize all input data
   - Implement proper authentication checks

4. **Backwards Compatibility**:
   - Ensure existing workflows continue to work
   - Handle migration of older workflow formats if needed

5. **User Experience**:
   - Provide immediate feedback on save operations
   - Implement loading indicators for all async operations
   - Show meaningful error messages

## Completed Tasks

The following tasks have already been completed:

- ✅ Implemented modal-based editing for KnowledgeBaseSearchNode
- ✅ Enhanced the node block settings to show a cleaner UI with Edit Configuration button
- ✅ Added connection enforcement for KnowledgeBase nodes
- ✅ Established connection detection and validation between Assistant and KnowledgeBase nodes
- ✅ Implemented UI feedback for connection status in the node settings
