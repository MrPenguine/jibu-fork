# Plan 2: Unified JSON + Versioning Rules

Goal: Persist the entire workflow in a single JSON blob per WorkflowVersion and keep defaults at the Agent level. The JSON only contains overrides and execution graph (nodes/edges), plus UI state.

## Unified JSON Contract (stored in WorkflowVersion.workflowJson)

- __Metadata__
  - `id, name, description?`
  - `status` (redundant to version row; may be included for snapshot completeness)
  - `version` (redundant to version row; optional in JSON)
- __Agent linkage__
  - No agent defaults stored here. Only IDs if helpful to resolve execution context.
- __UI state__
  - `ui.viewport = { x, y, zoom }`
- __Graph__
  - `graph.nodes: FlowNode[]`
  - `graph.edges: FlowEdge[]`
  - Do NOT store `connections` index; generate on demand from edges if needed.
- __Model settings__
  - No workflow-level defaults in JSON. Agent holds defaults in DB.
  - Assistant node uses:
    - `inheritModel: true` (default) → use agent defaults
    - `inheritModel: false` → store explicit `data.model` override on the node

Example minimal shape:
```json
{
  "id": "wf_abc",
  "name": "Main Flow",
  "ui": { "viewport": { "x": 0, "y": 0, "zoom": 1 } },
  "graph": {
    "nodes": [ { "id": "start", "type": "START", "position": { "x": 100, "y": 100 }, "data": { "label": "Start" } } ],
    "edges": []
  }
}
```

## Node Override Rules

- __Assistant node__
  - Default (inherit): `data.inheritModel = true`; do not include `data.model`
  - Override: `data.inheritModel = false` and include `data.model = { provider, model, temperature?, maxTokens?, preference? }`
- __Message / Listen (voice)__
  - Inherit TTS/STT from Agent by default
  - If a node needs a different voice/transcriber, store node-level fields such as `data.ttsProvider`, `data.voiceId`, `data.sttProvider`, `data.sttModel` only when changed

## Versioning Rules (Workflow + WorkflowVersion)

- A `Workflow` represents a logical flow and owns `versions: WorkflowVersion[]`
- Each `WorkflowVersion` is immutable once published
- `Workflow` holds pointers for hot paths:
  - `publishedVersionId` → the live version
  - `draftVersionId` → the currently editable draft
- Publishing:
  - Validate the current draft JSON
  - Set draft version `status = "published"`, `publishedAt = now()`
  - Move pointer `publishedVersionId` to this version
  - Create a new draft version by cloning the published JSON with `version + 1`, `status = "draft"`

## Validation (on publish and optionally on save)

- __Structure__
  - Exactly one START node
  - Each edge references existing nodes
  - No unreachable non-Note nodes (from START)
- __Required fields by type__
  - API_CALL: `url`, `method`
  - TOOL_CALL: `toolId`
  - LISTEN: `variableName`
  - ASSISTANT: `inheritModel` present; if `false` and `data.model` present, validate provider/model
- __Handles__
  - CONDITION edges must use `sourceHandle` of `true` or `false`

## Execution Resolution (runtime)

- Resolve effective model and voice/transcriber as:
  1) Node override (Assistant `inheritModel=false`, or Message/Listen explicit TTS/STT fields)
  2) Agent defaults from DB
- Do not depend on workflow-level defaults

## API Behavior Summary

- `GET /workflows/:workflowId` → logical container with metadata and pointers
- `GET /workflows/:workflowId/versions/:version` → returns the full JSON for that version
- `PUT /workflows/:workflowId/versions/:version` (draft only) → updates draft JSON (autosave)
- `POST /workflows/:workflowId/versions/:version/publish` → validates and publishes; then creates next draft

## Frontend Behavior Summary

- Editor always loads current draft version JSON
- Autosave writes the entire JSON to the draft version
- Publish runs server-side validation and updates pointers
- Published versions are view-only
