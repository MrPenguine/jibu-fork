# Frontend API Utils - Complete Guide

## 📁 File Structure

```
apps/frontend/src/
├── utils/
│   ├── api.ts                          # Core API utilities ⭐
│   ├── apiContext.tsx                  # React Context Provider ⭐
│   ├── chatApi.ts                      # Chat operations ⭐
│   ├── AgentApi.ts                     # Agent management
│   ├── AssistantsApi.ts                # Assistant operations
│   ├── workflowApi.ts                  # Workflow management
│   ├── knowledgebaseApi.ts             # Knowledge base
│   ├── fileApi.ts                      # File operations
│   ├── toolsApi.ts                     # Tool management
│   ├── voicesApi.ts                    # Voice configuration
│   ├── livekitApi.ts                   # LiveKit integration
│   └── supabase/client.ts              # Supabase client
```

---

## 🏗️ Architecture

```
React Components
    ↓
Domain APIs (chatApi, AgentApi, etc.)
    ↓
Core API (api.ts - fetchAPI)
    ↓
Authentication (Supabase)
    ↓
Backend API (localhost:4000/api/v1/*)
```

---

## 1️⃣ Core API - `apps/frontend/src/utils/api.ts`

### API_BASE_URL
```typescript
export const API_BASE_URL = 'http://localhost:4000/api';
// Production: https://your-domain.com/api
```

### fetchAPI() - Main Function
```typescript
async function fetchAPI(endpoint: string, options?: RequestInit): Promise<any>
```

**Features**:
- ✅ Auto JWT token from Supabase
- ✅ Auto workspace ID from localStorage
- ✅ 30-second timeout
- ✅ Error handling
- ✅ JSON parsing

**Headers Added**:
```typescript
{
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${jwt_token}`,
  'X-Workspace-ID': workspace_id,
  'workspace-id': workspace_id
}
```

**Usage**:
```typescript
import { fetchAPI } from '@/utils/api';

// GET
const agents = await fetchAPI('/v1/agents');

// POST
const newAgent = await fetchAPI('/v1/agents', {
  method: 'POST',
  body: JSON.stringify({ name: 'My Agent' })
});

// DELETE
await fetchAPI(`/v1/agents/${id}`, { method: 'DELETE' });
```

---

## 2️⃣ React Context - `apps/frontend/src/utils/apiContext.tsx`

### Interface
```typescript
interface ApiContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  refreshContext: () => Promise<void>;
  apiRequest: (endpoint, options) => Promise<any>;
}
```

### Usage
```typescript
import { useApi } from '@/utils/apiContext';

function MyComponent() {
  const { user, token, loading, apiRequest } = useApi();
  
  const loadData = async () => {
    const data = await apiRequest('/v1/agents');
  };
  
  return <div>Welcome, {user?.email}</div>;
}
```

---

## 3️⃣ Chat API - `apps/frontend/src/utils/chatApi.ts`

### Interfaces
```typescript
interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  sequenceId: number;
  createdAt: string;
}

interface Chat {
  id: string;
  name?: string;
  sessionId: string;
  assistantId: string;
  workspaceId: string;
}
```

### Functions

#### listChats()
```typescript
async function listChats(
  id: string,
  entityType: 'assistant' | 'agent',
  sessionType?: string,
  specificWorkspaceId?: string
): Promise<Chat[]>
```

**Example**:
```typescript
const chats = await listChats('assistant-123', 'assistant');
```

#### getChatMessages()
```typescript
async function getChatMessages(
  chatId: string,
  specificWorkspaceId?: string
): Promise<ChatMessage[]>
```

**Features**:
- Cache busting
- Deduplication
- LocalStorage backup

**Example**:
```typescript
const messages = await getChatMessages('chat-123');
```

#### createChat()
```typescript
async function createChat(
  assistantId: string,
  name?: string,
  specificWorkspaceId?: string,
  isAgent?: boolean
): Promise<Chat | null>
```

**Example**:
```typescript
const chat = await createChat('assistant-123', 'My Chat');
```

#### sendChatMessage()
```typescript
async function sendChatMessage(
  chatId: string,
  content: string,
  role: 'user' | 'assistant',
  specificWorkspaceId?: string
): Promise<ChatMessage | null>
```

**Example**:
```typescript
await sendChatMessage('chat-123', 'Hello!', 'user');
```

#### updateChatName()
```typescript
async function updateChatName(
  chatId: string,
  name: string
): Promise<boolean>
```

#### deleteChat()
```typescript
async function deleteChat(chatId: string): Promise<boolean>
```

---

## 4️⃣ Other Domain APIs

### Agent API - `apps/frontend/src/utils/AgentApi.ts`
- `listAgents()`
- `getAgent(id)`
- `createAgent(data)`
- `updateAgent(id, data)`
- `deleteAgent(id)`
- `publishAgent(id)`

### Assistant API - `apps/frontend/src/utils/AssistantsApi.ts`
- `listAssistants()`
- `getAssistant(id)`
- `createAssistant(data)`
- `updateAssistant(id, data)`
- `deleteAssistant(id)`

### Workflow API - `apps/frontend/src/utils/workflowApi.ts`
- `listWorkflows()`
- `getWorkflow(id)`
- `createWorkflow(data)`
- `updateWorkflow(id, data)`
- `publishWorkflow(id)`

### Knowledge Base API - `apps/frontend/src/utils/knowledgebaseApi.ts`
- `listKnowledgeBases()`
- `getKnowledgeBase(id)`
- `uploadDocument(kbId, file)`

### File API - `apps/frontend/src/utils/fileApi.ts`
- `uploadFile(file, metadata)`
- `downloadFile(fileId)`
- `getActiveWorkspaceId()`

---

## 🎯 Usage Patterns

### Pattern 1: Simple Request
```typescript
// File: apps/frontend/src/components/AgentList.tsx
import { fetchAPI } from '@/utils/api';

const agents = await fetchAPI('/v1/agents');
```

### Pattern 2: POST Request
```typescript
// File: apps/frontend/src/components/CreateAgent.tsx
import { fetchAPI } from '@/utils/api';

const newAgent = await fetchAPI('/v1/agents', {
  method: 'POST',
  body: JSON.stringify({
    name: 'My Agent',
    description: 'Test'
  })
});
```

### Pattern 3: Using Context
```typescript
// File: apps/frontend/src/components/Dashboard.tsx
import { useApi } from '@/utils/apiContext';

function Dashboard() {
  const { user, apiRequest } = useApi();
  
  const loadData = async () => {
    const data = await apiRequest('/v1/agents');
  };
}
```

### Pattern 4: Domain API
```typescript
// File: apps/frontend/src/components/ChatInterface.tsx
import { createChat, sendChatMessage } from '@/utils/chatApi';

const chat = await createChat('assistant-123', 'New Chat');
await sendChatMessage(chat.id, 'Hello!', 'user');
```

### Pattern 5: Error Handling
```typescript
try {
  await fetchAPI(`/v1/agents/${id}`, { method: 'DELETE' });
  toast.success('Deleted');
} catch (error) {
  if (error.message.includes('401')) {
    router.push('/login');
  } else if (error.message.includes('403')) {
    toast.error('Permission denied');
  } else {
    toast.error(error.message);
  }
}
```

---

## 🛡️ Error Handling

### Error Types

**Network Errors**:
- `"Request timed out after 30 seconds"`
- `"Network error: Unable to connect to the server"`

**Auth Errors**:
- `"No active session. User must be authenticated"`
- `"No authentication token available"`

**API Errors**:
- `"API error: 400"` - Bad request
- `"API error: 401"` - Unauthorized
- `"API error: 403"` - Forbidden
- `"API error: 404"` - Not found
- `"API error: 500"` - Server error

---

## 🔄 Workspace Management

### Get Workspace ID
```typescript
// File: apps/frontend/src/utils/fileApi.ts
export function getActiveWorkspaceId(): string | null {
  return localStorage.getItem('activeWorkspaceId');
}
```

### Set Workspace ID
```typescript
localStorage.setItem('activeWorkspaceId', 'workspace-123');
```

### Priority Order
1. Function parameter (highest)
2. LocalStorage
3. Auto-added by fetchAPI

---

## ⚙️ Configuration

### Environment Variables
```env
# File: apps/frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Development vs Production
- **Dev**: `http://localhost:4000/api`
- **Prod**: `https://your-domain.com/api`

---

## 📊 Request Flow

```
1. Component
   ↓ calls domain API
2. Domain API (chatApi.ts)
   ↓ calls fetchAPI()
3. fetchAPI (api.ts)
   ↓ gets session from Supabase
4. Supabase
   ↓ returns JWT token
5. fetchAPI
   ↓ adds headers (token, workspace ID)
6. Backend API
   ↓ validates & processes
7. Response
   ↓ parsed by fetchAPI
8. Component
   ↓ receives data
```

---

## 💡 Best Practices

### ✅ DO
- Use `fetchAPI` for all backend requests
- Handle errors at component level
- Use domain APIs when available
- Store workspace ID in localStorage
- Use TypeScript interfaces

### ❌ DON'T
- Make direct `fetch()` calls
- Hardcode API URLs
- Ignore error handling
- Store sensitive data in localStorage
- Skip authentication checks

---

## 📚 Quick Reference

### Import Statements
```typescript
// Core API
import { fetchAPI, API_BASE_URL } from '@/utils/api';

// Context
import { useApi } from '@/utils/apiContext';

// Chat API
import { 
  listChats, 
  createChat, 
  sendChatMessage 
} from '@/utils/chatApi';

// Workspace
import { getActiveWorkspaceId } from '@/utils/fileApi';
```

### Common Operations
```typescript
// GET all
const items = await fetchAPI('/v1/items');

// GET one
const item = await fetchAPI(`/v1/items/${id}`);

// POST
const newItem = await fetchAPI('/v1/items', {
  method: 'POST',
  body: JSON.stringify(data)
});

// PATCH
await fetchAPI(`/v1/items/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(updates)
});

// DELETE
await fetchAPI(`/v1/items/${id}`, { method: 'DELETE' });
```

---

## Summary

The frontend API utilities provide a **robust, type-safe system** for backend communication:

- ✅ Centralized authentication via Supabase
- ✅ Automatic header management
- ✅ Comprehensive error handling
- ✅ Domain-specific abstractions
- ✅ Offline support via localStorage
- ✅ React context integration
- ✅ 30-second timeout protection
- ✅ Workspace-aware requests

All API communication flows through these utilities for consistency and maintainability.
