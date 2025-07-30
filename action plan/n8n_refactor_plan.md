# N8N Orchestration and Workflow Engine Refactor Plan

This document outlines the phased approach to refactor the N8N integration, moving from a hardcoded workflow generation system to a modular, template-based, and locally managed workflow engine.

## Phase 1: Foundational Refactoring - Template-Based Node Generation

The goal of this phase is to eliminate hardcoded JSON from the services and introduce a clean, reusable template system for creating N8N nodes.

-   `[ ]` **Task 1.1: Create Node Template Files**
    -   `[x]` Create `google-gemini.template.ts`
    -   `[x]` Create `ai-agent.template.ts`
    -   `[ ]` Create `webhook.template.ts` (New)
    -   `[ ]` Create `respond-to-webhook.template.ts` (New)
    -   `[ ]` Create `chat-trigger.template.ts` (Unused for now)
-   `[ ]` **Task 1.2: Implement a Template Parsing Service**
    -   `[ ]` Create `N8nTemplateService` in the `n8n-orchestrator` module.
    -   `[ ]` Implement a method to read a template file and substitute placeholders with dynamic data.
-   `[ ]` **Task 1.3: Refactor `N8nWorkflowService`**
    -   `[ ]` Update `createN8nWorkflowRecord` to use `N8nTemplateService`.
    -   `[ ]` Remove hardcoded node JSON and replace it with calls to the template service.
-   `[ ]` **Task 1.4: Verification**
    -   `[ ]` Test the end-to-end workflow creation to ensure it generates the correct JSON and that workflows are created successfully in N8N.

## Phase 2: Local Workflow & Node Management Engine

This phase focuses on building a local representation of workflows, allowing the application to manage them independently before synchronizing with N8N.

-   `[ ]` **Task 2.1: Define Local Database Models**
    -   `[ ]` Define `Workflow` and `WorkflowNode` entities in the `workflow` module.
-   `[ ]` **Task 2.2: Implement Local Workflow Service**
    -   `[ ]` Create `WorkflowService` with CRUD methods for local workflows and their nodes.
-   `[ ]` **Task 2.3: Build the Synchronization Logic**
    -   `[ ]` Enhance `WorkflowSynchronizerService` to read local workflow data, generate the N8N JSON using the templates from Phase 1, and call the N8N API to create/update the workflow.
-   `[ ]` **Task 2.4: API Endpoints**
    -   `[ ]` Create API endpoints to manage local workflows and trigger synchronization.

## Phase 3: Advanced Features & UI Integration

This phase involves building the user interface to manage these new local workflows and adding more advanced capabilities.

-   `[ ]` **Task 3.1: Frontend Workflow Builder UI**
    -   `[ ]` Design and build a UI for creating, editing, and visualizing workflows.
-   `[ ]` **Task 3.2: Two-Way Synchronization (Harmonization)**
    -   `[ ]` Implement logic to fetch a workflow from N8N and update the local representation, allowing for the import of existing workflows and detection of manual changes.
-   `[ ]` **Task 3.3: Versioning**
    -   `[ ]` Add versioning to the local `Workflow` model to keep a history of changes.