# Workflow Canvas Implementation Plan for Jibu Console

## Overview

This document outlines a comprehensive plan for implementing a Voiceflow-inspired workflow canvas in the Jibu Console application. The implementation will enhance the existing workflow functionality with a visual, drag-and-drop interface for creating, editing, and managing conversation flows.

## Current State Analysis

The Jibu Console already has a basic workflow system with:

1. **Backend**:
   - NestJS controllers and services for workflow CRUD operations
   - Prisma schema for workflow data model
   - Workflow execution engine

2. **Frontend**:
   - Basic workflow listing page
   - Simple workflow editing interface
   - API client for workflow operations

3. **Data Model**:
   - Workflows with nodes and edges stored as JSON strings
   - Relationships to assistants and organizations
   - Support for workflow execution sessions

## Implementation Goals

- [ ] Create a fully interactive workflow canvas similar to Voiceflow
- [ ] Implement drag-and-drop functionality for workflow steps/nodes
- [ ] Support various node types (Start, Message, Listen, Choice, etc.)
- [ ] Enable visual connection between nodes with customizable paths
- [ ] Provide a component library for reusable workflow patterns
- [ ] Implement workflow testing and execution directly from the canvas
- [ ] Support workflow versioning and publishing

## Implementation Checklist

### Phase 1: Foundation

#### Backend Enhancements

- [ ] **Update Data Models**:
  - [ ] Enhance the Workflow model to support additional metadata
  - [ ] Create dedicated models for workflow node types and templates
  - [ ] Add support for workflow versioning

```typescript
// Example schema additions
model WorkflowNodeType {
  id          String    @id @default(uuid())
  name        String
  description String?
  icon        String?
  category    String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  nodes       Node[]
}

model WorkflowTemplate {
  id          String    @id @default(uuid())
  name        String
  description String?
  nodes       Json
  edges       Json
  thumbnail   String?
  category    String?
  organizationId String
  organization Organization @relation(fields: [organizationId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

- [ ] **API Endpoints**:
  - [ ] Create endpoints for node types and templates
  - [ ] Add endpoints for workflow versioning and history
  - [ ] Implement endpoints for workflow component management

#### Frontend Core Components

- [ ] **React Flow Integration**:
  - [ ] Set up React Flow as the canvas foundation
  - [ ] Create a basic workflow designer component
  - [ ] Implement pan, zoom, and basic node interaction

- [ ] **Basic Node Types**:
  - [ ] Implement Start node
  - [ ] Implement Message node
  - [ ] Implement Listen node
  - [ ] Implement Choice node

- [ ] **Canvas Controls**:
  - [ ] Implement canvas navigation controls
  - [ ] Add zoom in/out functionality
  - [ ] Create canvas reset and focus controls

### Phase 2: Advanced Features

#### Node Library and Templates

- [ ] **Node Palette**:
  - [ ] Create a draggable node palette component
  - [ ] Organize nodes by categories (Event, AI, Talk, Listen, Logic, Dev)
  - [ ] Implement drag-and-drop from palette to canvas

- [ ] **Node Configuration**:
  - [ ] Build node inspector panel for editing node properties
  - [ ] Implement validation for node configurations
  - [ ] Create specialized editors for different node types

- [ ] **Templates and Components**:
  - [ ] Implement workflow templates system
  - [ ] Create component creation and management
  - [ ] Build template library browser

#### Connection and Path Management

- [ ] **Edge Customization**:
  - [ ] Implement straight and curved path options
  - [ ] Add path coloring and styling
  - [ ] Create path labeling functionality

- [ ] **Connection Logic**:
  - [ ] Implement smart connection validation
  - [ ] Create connection handles based on node type
  - [ ] Add support for conditional paths

### Phase 3: Advanced Workflow Features

#### Workflow Testing and Execution

- [ ] **Workflow Simulator**:
  - [ ] Create a workflow testing interface
  - [ ] Implement step-by-step execution visualization
  - [ ] Add support for variable inspection during simulation

- [ ] **Debugging Tools**:
  - [ ] Implement breakpoints in workflows
  - [ ] Create logging and tracing functionality
  - [ ] Add error handling and visualization

#### Workflow Management

- [ ] **Versioning and History**:
  - [ ] Implement workflow versioning
  - [ ] Create history viewer
  - [ ] Add rollback functionality

- [ ] **Publishing and Deployment**:
  - [ ] Enhance workflow publishing process
  - [ ] Create deployment status indicators
  - [ ] Implement workflow analytics

### Phase 4: Integration and Polish

#### Integration with Existing Systems

- [ ] **Assistant Integration**:
  - [ ] Connect workflows to assistants
  - [ ] Implement assistant-specific workflow settings
  - [ ] Create workflow triggering mechanisms

- [ ] **Organization and User Management**:
  - [ ] Implement workflow sharing and permissions
  - [ ] Create organization-level workflow libraries
  - [ ] Add user assignment and collaboration features

#### UI/UX Polish

- [ ] **Canvas Experience**:
  - [ ] Optimize canvas performance
  - [ ] Add animations and visual feedback
  - [ ] Implement keyboard shortcuts

- [ ] **Documentation and Help**:
  - [ ] Create in-app tutorials
  - [ ] Add contextual help
  - [ ] Implement template examples

## Technical Implementation Details

### Backend Implementation

1. **Update Workflow Service**:

```typescript
// Enhanced workflow service with template support
@Injectable()
export class WorkflowService {
  // Existing methods...
  
  async createTemplate(data: CreateTemplateDto, organizationId: string): Promise<WorkflowTemplate> {
    // Implementation
  }
  
  async getTemplates(organizationId: string): Promise<WorkflowTemplate[]> {
    // Implementation
  }
  
  async createVersion(workflowId: string, organizationId: string): Promise<WorkflowVersion> {
    // Implementation
  }
  
  async getVersions(workflowId: string, organizationId: string): Promise<WorkflowVersion[]> {
    // Implementation
  }
}
```

2. **Workflow Execution Service Enhancements**:

```typescript
// Enhanced execution with debugging support
@Injectable()
export class WorkflowExecutionService {
  // Existing methods...
  
  async executeWithDebug(workflowId: string, data: ExecuteWorkflowRequest): Promise<DebugSessionOutput> {
    // Implementation with step-by-step execution and state tracking
  }
  
  async setBreakpoint(sessionId: string, nodeId: string, enabled: boolean): Promise<void> {
    // Implementation
  }
}
```

### Frontend Implementation

1. **Workflow Designer Component**:

```tsx
// src/components/workflow/WorkflowDesigner.tsx
import React, { useState, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';

import { NodePalette } from './NodePalette';
import { NodeInspector } from './NodeInspector';
import { customNodeTypes } from './nodes';

export function WorkflowDesigner({ initialNodes, initialEdges, onSave }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);
  const [selectedNode, setSelectedNode] = useState(null);
  
  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges]);
  
  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
  }, []);
  
  // Additional implementation...
  
  return (
    <div className="workflow-designer-container">
      <div className="workflow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={customNodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      <div className="workflow-sidebar">
        <NodePalette onDragStart={/* implementation */} />
        {selectedNode && (
          <NodeInspector 
            node={selectedNode} 
            onChange={/* implementation */} 
          />
        )}
      </div>
    </div>
  );
}
```

2. **Custom Node Components**:

```tsx
// src/components/workflow/nodes/MessageNode.tsx
import React from 'react';
import { Handle, Position } from 'reactflow';

export function MessageNode({ data }) {
  return (
    <div className="message-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-content">
        <div className="node-header">
          <span className="node-icon">💬</span>
          <span className="node-title">Message</span>
        </div>
        <div className="node-body">
          <p>{data.message || 'No message set'}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// Similar components for other node types...
```

3. **Node Palette Component**:

```tsx
// src/components/workflow/NodePalette.tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@libs/shadcn-ui/components/ui/tabs';

export function NodePalette({ onDragStart }) {
  const nodeCategories = [
    {
      id: 'event',
      label: 'Event',
      nodes: [
        { type: 'start', label: 'Start', icon: '▶️' },
        { type: 'trigger', label: 'Trigger', icon: '🔔' },
      ]
    },
    {
      id: 'message',
      label: 'Message',
      nodes: [
        { type: 'text', label: 'Text', icon: '💬' },
        { type: 'image', label: 'Image', icon: '🖼️' },
      ]
    },
    // More categories...
  ];
  
  return (
    <div className="node-palette">
      <h3>Add Nodes</h3>
      <Tabs defaultValue="event">
        <TabsList>
          {nodeCategories.map(category => (
            <TabsTrigger key={category.id} value={category.id}>
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {nodeCategories.map(category => (
          <TabsContent key={category.id} value={category.id}>
            <div className="node-grid">
              {category.nodes.map(node => (
                <div
                  key={node.type}
                  className="node-item"
                  draggable
                  onDragStart={(event) => onDragStart(event, node)}
                >
                  <span className="node-icon">{node.icon}</span>
                  <span className="node-label">{node.label}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

## Resource Requirements

1. **Dependencies**:
   - React Flow (for canvas implementation)
   - Shadcn UI (already in use)
   - Prisma (already in use)
   - NestJS (already in use)

2. **Development Resources**:
   - 1-2 Frontend developers
   - 1 Backend developer
   - 1 UX designer (part-time)
   - 1 QA engineer (part-time)

## Timeline and Milestones

1. **Week 1-2**: Foundation
   - Basic canvas implementation
   - Core node types
   - Backend model updates

2. **Week 3-4**: Advanced Features
   - Node palette and inspector
   - Template system
   - Path customization

3. **Week 5-6**: Workflow Execution
   - Testing interface
   - Debugging tools
   - Versioning system

4. **Week 7-8**: Integration and Polish
   - Assistant integration
   - UI/UX improvements
   - Documentation and tutorials

## Conclusion

This implementation plan provides a structured approach to building a Voiceflow-inspired workflow canvas in the Jibu Console. By following this phased approach, we can incrementally build and test the functionality while ensuring integration with the existing system.

The end result will be a powerful, visual workflow editor that allows users to create complex conversation flows without coding, significantly enhancing the capabilities of the Jibu Console platform.
