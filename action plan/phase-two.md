Of course. Here is the detailed, developer-centric action plan for **Phase 2: Core UI Refactor & Layout**.

This plan is designed for your frontend team. It follows the expert recommendation to enable parallel development by introducing API mocking from the start. This ensures the UI can be built completely, tested, and polished before the backend endpoints from Phase 1 are fully deployed.

---

### **Phase 2 Detailed Action Plan: Core UI Refactor & Layout**

**Objective:** To implement the new, superior workspace navigation structure and core page layouts. To enable rapid, decoupled frontend development by establishing a robust API mocking layer.

---

#### **Task 2.1: Refactor the Main Sidebar Navigation**

**Goal:** Transform the current flat sidebar into a clean, hierarchical navigation system that reduces cognitive load and improves information architecture.

*   **Action Item 2.1.1: Restructure the Sidebar Component**
    *   **File to Modify:** Locate your primary sidebar component. Based on your structure, this is likely `libs/shadcn-ui/src/components/organization/CustomAppSidebar.tsx` or a similar `nav-main.tsx`.
    *   **Implementation:** Reorganize the JSX structure into three distinct visual groups. Use headings and the `Separator` component from `shadcn/ui` for visual distinction.
        ```tsx
        // In CustomAppSidebar.tsx
        <div className="flex flex-col h-full">
          {/* Group 1: Workspace */}
          <div className="p-2">
            <h2 className="px-2 py-1 text-xs font-semibold text-muted-foreground">WORKSPACE</h2>
            <NavItem href={`/workspace/${workspaceId}`} icon={<HomeIcon />}>Home</NavItem>
            <NavItem href={`/workspace/${workspaceId}/projects`} icon={<ProjectsIcon />}>Projects</NavItem>
          </div>

          <Separator />

          {/* Group 2: Management & Settings */}
          <div className="p-2">
             {/* Implementation from next step */}
          </div>

          <Separator />

          {/* Group 3: Help & Community */}
          <div className="p-2">
             {/* Implementation from next step */}
          </div>

          {/* User Menu at the bottom */}
        </div>
        ```

*   **Action Item 2.1.2: Implement Collapsible Settings Menu**
    *   **File to Modify:** The same sidebar component file.
    *   **Implementation:** Use the `Accordion` component from `shadcn/ui` to house all settings links. This makes the sidebar cleaner by default.
        ```tsx
        // In the "Management & Settings" div
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1" className="border-b-0">
            <AccordionTrigger className="px-2 py-1 hover:no-underline">
              <div className="flex items-center">
                <SettingsIcon className="w-4 h-4 mr-2" />
                <span>Settings</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pl-4">
              <NavItem href={`/workspace/${workspaceId}/settings/members`}>Members</NavItem>
              <NavItem href={`/workspace/${workspaceId}/settings/phone-numbers`}>Phone Numbers</NavItem>
              <NavItem href={`/workspace/${workspaceId}/settings/api-keys`}>API Keys</NavItem>
              <NavItem href={`/workspace/${workspaceId}/settings/usage`}>Usage</NavItem>
              <NavItem href={`/workspace/${workspaceId}/settings/billing`}>Plans & Billing</NavItem>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        ```

*   **Action Item 2.1.3: Implement the User Profile Menu**
    *   **File to Modify:** The same sidebar component file.
    *   **Implementation:** Replace the static "Jibu AI" text link at the bottom with a `DropdownMenu` component.
        ```tsx
        // At the bottom of the sidebar
        <div className="p-2 mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
              <div className="flex items-center p-2 rounded-md hover:bg-muted">
                <Avatar>...</Avatar>
                <span className="ml-2">Jibu AI</span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        ```

*   **Action Item 2.1.4: Integrate Internationalization (i18n)**
    *   **File to Modify:** The same sidebar component file, and all future UI components.
    *   **Implementation:**
        1.  Install an i18n library: `pnpm add next-intl` (a popular choice for Next.js).
        2.  Configure the library according to its documentation.
        3.  Wrap every user-facing string in a translation function `t()`.
            ```tsx
            // Example
            import { useTranslations } from 'next-intl';

            export function Sidebar() {
              const t = useTranslations('Sidebar');
              return <NavItem href="/...">{t('projects')}</NavItem>;
            }
            ```
    *   **Acceptance Criteria:** All text in the sidebar is rendered via the translation function, even if only an English file exists for now. This prevents technical debt.

---

#### **Task 2.2: Create the New Settings Dashboard Page**

**Goal:** Build the main settings page that acts as a visual navigation hub for all administrative tasks.

*   **Action Item 2.2.1: Create the Page File and Route**
    *   **File to Create:** `apps/frontend/src/app/(dashboard)/workspace/[workspaceId]/settings/page.tsx`
    *   **Implementation:** Create a new page component that will serve as the container for the settings cards.

*   **Action Item 2.2.2: Implement the Card Grid Layout**
    *   **File to Modify:** The new `page.tsx` file.
    *   **Implementation:** Use CSS Grid or Flexbox to create a responsive grid. Use the `Card` component from `shadcn/ui` for each settings link.
        ```tsx
        // In /settings/page.tsx
        import Link from 'next/link';
        import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
        import { UsersIcon, PhoneIcon, KeyIcon, CreditCardIcon, BarChartIcon } from 'lucide-react'; // or your icon library

        const settingsCards = [
          { title: "Members", description: "Manage your team...", href: "/settings/members", icon: <UsersIcon /> },
          // ... add all other settings pages
        ];

        export default function SettingsPage({ params }) {
          return (
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <div className="grid grid-cols-1 gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3">
                {settingsCards.map((card) => (
                  <Link href={`/workspace/${params.workspaceId}${card.href}`} key={card.title}>
                    <Card className="h-full transition-all hover:border-primary">
                      <CardHeader>
                        {card.icon}
                        <CardTitle>{card.title}</CardTitle>
                        <CardDescription>{card.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        }
        ```
    *   **Acceptance Criteria:** The page renders at the correct URL. The grid displays correctly. Clicking each card navigates to the corresponding (currently non-existent) sub-page.

---

#### **Task 2.3: Establish Frontend API Mocking with MSW**

**Goal:** Decouple the frontend from the backend, allowing UI development and testing to proceed without waiting for live APIs.

*   **Action Item 2.3.1: Install and Initialize MSW**
    *   **Action:** Open a terminal in your `apps/frontend` directory.
    *   **Implementation:**
        1.  Install the dependency: `pnpm add msw --save-dev`
        2.  Initialize the service worker: `npx msw init public/ --save` (This creates the `mockServiceWorker.js` file in your public directory).
    *   **Acceptance Criteria:** The `mockServiceWorker.js` file is present in `apps/frontend/public/`.

*   **Action Item 2.3.2: Create Mock Handlers**
    *   **Directory to Create:** `apps/frontend/src/mocks/`
    *   **Files to Create:** `apps/frontend/src/mocks/handlers.ts` and `apps/frontend/src/mocks/browser.ts`.
    *   **Implementation (`handlers.ts`):** Define mock responses for the new endpoints.
        ```typescript
        // In /mocks/handlers.ts
        import { http, HttpResponse } from 'msw';

        export const handlers = [
          // Mock for getting folders
          http.get('/api/v1/folders', ({ params }) => {
            return HttpResponse.json([
              { id: 'folder_1', name: 'Default Projects' },
              { id: 'folder_2', name: 'Client A' },
            ]);
          }),

          // Mock for getting members
          http.get('/api/v1/organizations/:orgId/members', () => {
             return HttpResponse.json([
                { id: 'user_1', name: 'Jibu AI', email: 'jibu@example.com', role: 'OWNER' },
             ]);
          }),
          // ... add mocks for all other endpoints
        ];
        ```
    *   **Implementation (`browser.ts`):** Set up the browser-based worker.
        ```typescript
        // In /mocks/browser.ts
        import { setupWorker } from 'msw/browser';
        import { handlers } from './handlers';

        export const worker = setupWorker(...handlers);
        ```
    *   **Acceptance Criteria:** Mock handlers for the key features (folders, members, phone numbers) are defined.

*   **Action Item 2.3.3: Conditionally Enable Mocking in the App**
    *   **File to Create:** `apps/frontend/src/mocks/index.ts` or a similar startup file.
    *   **Implementation:** Create a function that starts the worker only in development and when an environment variable is set.
        ```typescript
        // In /mocks/index.ts
        async function initMocks() {
          if (typeof window === 'undefined') {
            // Server-side logic if needed, but we focus on client-side
          } else {
            const { worker } = await import('./browser');
            worker.start();
          }
        }
        initMocks();
        ```
    *   **Implementation (in your root layout):**
        1.  Set up an environment variable in `.env.local`: `NEXT_PUBLIC_API_MOCKING=enabled`
        2.  In your main layout file (`apps/frontend/src/app/layout.tsx`), conditionally call the mock setup.
            ```tsx
            // In layout.tsx
            if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') {
              require('@/mocks'); // This will run the setup file
            }
            ```
    *   **Acceptance Criteria:** When the app loads in development with the ENV var enabled, the browser's developer console shows a `[MSW] Mocking enabled.` message. API calls in the Network tab are intercepted by the service worker, and the UI is populated with the defined mock data.