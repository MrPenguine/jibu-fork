Of course. Here is the detailed, developer-centric action plan for **Phase 3: Page-by-Page Feature Implementation**.

This phase is where the user experience truly comes to life. It leverages the solid backend foundation from Phase 1 and the UI layouts from Phase 2 to build fully interactive, data-driven features. The plan assumes your team is using a modern data-fetching library like TanStack Query (React Query) for managing server state, which is ideal for handling loading, error, and caching logic.

---

### **Phase 3 Detailed Action Plan: Page-by-Page Feature Implementation**

**Objective:** To connect the refactored UI components to the backend API, implement core user-facing functionality, and polish the user interactions with proper state management.

---

#### **Task 3.1: The "Home" Dashboard Onboarding**

**Goal:** Implement the state-aware "Home" page that guides new users and provides a command center for established users.

*   **File to Modify:** `apps/frontend/src/app/(dashboard)/workspace/[workspaceId]/page.tsx`
*   **Component to Create:** `apps/frontend/src/components/onboarding/GetStartedChecklist.tsx` (or similar path in `libs`)

*   **Action Item 3.1.1: Implement Data Fetching**
    *   **API Hook:** In your API utility files (e.g., `apps/frontend/src/utils/api.ts`), create a hook to fetch the onboarding status.
        ```typescript
        // Example using React Query
        export function useOnboardingStatus(workspaceId: string) {
          return useQuery({
            queryKey: ['onboardingStatus', workspaceId],
            queryFn: () => api.get(`/workspaces/${workspaceId}/onboarding-status`),
          });
        }
        ```
    *   **Usage:** Call this hook at the top of the `HomePage` component.

*   **Action Item 3.1.2: Implement Conditional Rendering**
    *   **Logic:** In the `HomePage` component, use the data from the hook to decide what to render.
        ```tsx
        export default function HomePage({ params }) {
          const { data: onboardingStatus, isLoading } = useOnboardingStatus(params.workspaceId);

          if (isLoading) {
            return <DashboardSkeleton />; // Use a skeleton loader from Phase 2
          }

          const isCompleted = Object.values(onboardingStatus.steps).every(Boolean);

          return (
            <div>
              {!isCompleted && <GetStartedChecklist status={onboardingStatus.steps} />}
              {/* Render the established user dashboard components */}
            </div>
          );
        }
        ```

*   **Action Item 3.1.3: Build the `GetStartedChecklist` Component**
    *   **Props:** The component should accept the `status` object as a prop.
    *   **Implementation:** Render a list of items. Each item should have a checkbox that is checked based on the prop (`status.createdAgent`, etc.). Use a `Link` component from Next.js to navigate the user to the correct page for each action.
    *   **Updating State:** The `onboardingState` is updated when an action is completed elsewhere. For example, after successfully creating a new project, the `useCreateProjectMutation`'s `onSuccess` callback should invalidate the `onboardingStatus` query key.
        ```typescript
        // In the project creation logic
        const mutation = useCreateProjectMutation({
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['onboardingStatus', workspaceId] });
          }
        });
        ```
*   **Acceptance Criteria:**
    *   New users see the checklist.
    *   The checklist is not visible for users who have completed all steps.
    *   Completing an action (e.g., creating a project) and navigating back to Home shows the corresponding item as checked.

---

#### **Task 3.2: The "Projects" Page with Folders & Drag-and-Drop**

**Goal:** Implement full folder management and an intuitive drag-and-drop interface for organizing projects.

*   **File to Modify:** `apps/frontend/src/app/(dashboard)/workspace/[workspaceId]/projects/page.tsx`

*   **Action Item 3.2.1: Fetch and Render Folders & Root Projects**
    *   **API Hooks:** Create two separate queries: `useFolders(workspaceId)` and `useRootProjects(workspaceId)` (which fetches agents where `folderId` is null).
    *   **UI:** Render folders first, with a distinct visual style (folder icon, background color). Then, render the root-level projects.

*   **Action Item 3.2.2: Implement Folder Creation**
    *   **Component:** Create a `CreateFolderModal.tsx` component.
    *   **Functionality:** The modal contains a simple form with a name input. The "Create" button calls a `useCreateFolderMutation`. On success, invalidate the `folders` query to automatically refresh the list.

*   **Action Item 3.2.3: Implement Drag-and-Drop**
    *   **Library:** Install `dnd-kit`: `pnpm add @dnd-kit/core @dnd-kit/sortable`
    *   **Implementation:**
        1.  Wrap your entire projects/folders list in a `<DndContext>` provider.
        2.  Make your project cards `Draggable` by using the `useDraggable` hook.
        3.  Make your folder components (and a main "root" area) `Droppable` by using the `useDroppable` hook.
        4.  Create a `handleDragEnd` function. This is the core logic.
            ```typescript
            function handleDragEnd(event) {
              const { active, over } = event; // active is the dragged item, over is the drop zone

              if (over && active.id !== over.id) {
                const agentId = active.id;
                const newFolderId = over.id === 'root-drop-zone' ? null : over.id;
                // Trigger the mutation
                updateAgentFolderMutation.mutate({ agentId, folderId: newFolderId });
              }
            }
            ```
    *   **Optimistic Updates:** For a smooth UX, use the `onMutate` property of your React Query mutation to move the item in the UI state *before* the API call completes. If the call fails, roll back the change in the `onError` callback and show a `toast` notification.

*   **Acceptance Criteria:**
    *   User can create a new folder, and it appears on the page.
    *   User can drag a project card and drop it onto a folder. The project visually moves inside the folder, and the state persists on page refresh.
    *   User can drag a project from a folder back to the main area.
    *   Visual feedback (e.g., highlighting the drop zone) is present during dragging.

---

#### **Task 3.3: The "Phone Numbers" Page with n8n Integration**

**Goal:** Build the enhanced, two-step "Import from Twilio" modal that validates credentials and fetches numbers dynamically.

*   **File to Modify:** `apps/frontend/src/app/(dashboard)/workspace/[workspaceId]/settings/phone-numbers/page.tsx`
*   **Component to Create:** `apps/frontend/src/components/settings/ImportPhoneNumberModal.tsx`

*   **Action Item 3.3.1: Build the Multi-Step Modal**
    *   **State Management:** Use local `useState` within the modal to manage the current step: `const [step, setStep] = useState<'credentials' | 'selection' | 'loading'>('credentials');`
    *   **UI:** Conditionally render the content based on the `step` state.

*   **Action Item 3.3.2: Implement Step 1: Credential Input**
    *   **Functionality:** Create a form for the Twilio Account SID and Auth Token.
    *   **Mutation:** The "Import Numbers" button calls a `useFetchTwilioNumbersMutation`.
        ```typescript
        const fetchNumbersMutation = useMutation({
          mutationFn: (credentials) => api.post('/telephony/fetch-twilio-numbers', credentials),
          onSuccess: (data) => {
            setAvailableNumbers(data.numbers);
            setStep('selection'); // Move to the next step
          },
          onError: () => {
            toast.error("Invalid credentials or failed to connect to Twilio.");
            setStep('credentials');
          }
        });

        // The button's onClick
        const handleImportClick = () => {
            setStep('loading');
            fetchNumbersMutation.mutate({ sid, token });
        }
        ```

*   **Action Item 3.3.3: Implement Step 2: Number Selection**
    *   **UI:** When `step` is `'selection'`, render a `Select` component from `shadcn/ui`. Populate its options with the `availableNumbers` state.
    *   **Functionality:** The final "Save Number" button calls a *different* mutation, `useProvisionNumberMutation`, passing the `workspaceId` and the `selectedPhoneNumber`. On success, close the modal and invalidate the main phone numbers list query.

*   **Acceptance Criteria:**
    *   The modal shows the credential form first.
    *   Clicking "Import" shows a loading state.
    *   On successful validation, the modal transitions to show a dropdown of phone numbers.
    *   On failure, it shows an error toast and returns to the credential form.
    *   Selecting a number and saving adds it to the list on the main page.

---

#### **Task 3.4: The "Members" Page with Pending Invites**

**Goal:** Display pending invitations and provide functionality to resend or revoke them.

*   **File to Modify:** `apps/frontend/src/app/(dashboard)/workspace/[workspaceId]/settings/members/page.tsx`
*   **Component to Create:** `apps/frontend/src/components/settings/PendingInvitationsList.tsx`

*   **Action Item 3.4.1: Fetch and Display Data**
    *   **API Hooks:** Use two separate queries: `useMembers(workspaceId)` and `usePendingInvites(workspaceId)`.
    *   **UI:** In the main page component, render the `MembersList` and, below it, the `PendingInvitationsList`, passing the fetched data as props. The pending list should only be rendered if the query returns a non-empty array.

*   **Action Item 3.4.2: Implement Actions**
    *   **Mutations:** Create `useResendInviteMutation` and `useRevokeInviteMutation`.
    *   **Functionality:** The "Resend" and "Revoke" buttons in the `PendingInvitationsList` component will call the respective mutations with the `invitationId`.
    *   **State Update:** In the `onSuccess` callback for both mutations, invalidate the `pendingInvites` query key to ensure the list automatically updates.
        ```typescript
        const revokeMutation = useMutation({
          mutationFn: (invitationId) => api.delete(`/invitations/${invitationId}`),
          onSuccess: () => {
            toast.success("Invitation revoked.");
            queryClient.invalidateQueries({ queryKey: ['pendingInvites', workspaceId] });
          }
        });
        ```

*   **Acceptance Criteria:**
    *   Admins can see a separate list of pending invitations.
    *   Clicking "Revoke" removes the invitation from the list.
    *   Clicking "Resend" shows a success notification.