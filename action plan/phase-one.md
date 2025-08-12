Of course. Here is a highly detailed, developer-centric action plan for **Phase 1: Backend Foundation & Hardening**.

This plan breaks down each strategic task into concrete, actionable steps with specified file locations, code snippets, and clear acceptance criteria. It is designed to be handed directly to a backend developer or team to execute.

---

### **Phase 1 Detailed Action Plan: Backend Foundation & Hardening**

**Objective:** To build a secure, scalable, and well-defined backend foundation by implementing all critical architectural patterns, security measures, and data models before any significant UI work begins.

---

#### **Task 1.1: Evolve the Prisma Schema**

**Goal:** Update the database schema to support all new workspace features.

*   **Action Item 1.1.1: Modify the Schema File**
    *   **File to Modify:** `apps/backend/prisma/schema.prisma`
    *   **Implementation:** Add or update the following models. Copy and paste this code into your schema file.
        ```prisma
        // In schema.prisma

        model Folder {
          id             String        @id @default(cuid())
          name           String
          organizationId String
          organization   Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
          agents         Agent[]
          createdAt      DateTime      @default(now())
          updatedAt      DateTime      @updatedAt
        }

        model ApiKey {
          id                String        @id @default(cuid())
          name              String
          serviceType       String        // e.g., 'OPENAI', 'ELEVENLABS'
          encryptedKeyValue String
          organizationId    String?       // For Workspace-level keys
          organization      Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
          agentId           String?       // For Agent-level keys
          agent             Agent?        @relation(fields: [agentId], references: [id], onDelete: Cascade)
          createdAt         DateTime      @default(now())
        }

        model OnboardingStatus {
          id               String    @id @default(cuid())
          userId           String    @unique
          user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
          version          Int       @default(1)
          createdAgent     Boolean   @default(false)
          addedTool        Boolean   @default(false)
          addedPhoneNumber Boolean   @default(false)
          ranTest          Boolean   @default(false)
          createdAt        DateTime  @default(now())
          updatedAt        DateTime  @updatedAt
        }

        // --- Modifications to existing models ---

        model Agent {
          // ... existing fields
          folderId  String?
          folder    Folder?  @relation(fields: [folderId], references: [id])
          apiKeys   ApiKey[]
        }

        model Invitation {
          // ... existing fields
          status String @default("PENDING") // PENDING, ACCEPTED, EXPIRED, REVOKED
        }
        ```
    *   **Acceptance Criteria:** The `schema.prisma` file is updated with the new models and relations. The `prisma generate` command runs without errors.

---

#### **Task 1.2: Production Migration & Data Integrity Strategy**

**Goal:** Establish a safe process for database migrations and handle existing data correctly.

*   **Action Item 1.2.1: Document the Migration Workflow**
    *   **File to Create/Modify:** A new `DATABASE_MIGRATIONS.md` file in the root `apps/backend` directory.
    *   **Implementation:** Document the following two-step process for the team:
        1.  **Development:** Use `npx prisma migrate dev --name <migration_name>` to generate migration files locally.
        2.  **Staging/Production:**
            *   Run `npx prisma migrate dev --create-only --name <migration_name>` to generate the SQL file without applying it.
            *   Manually review the generated `.sql` file for correctness and potential data loss issues.
            *   Run `npx prisma migrate deploy` in the CI/CD pipeline to apply the approved migration.
    *   **Acceptance Criteria:** The documentation exists and is part of the project's official process.

*   **Action Item 1.2.2: Create the Data Backfill Script**
    *   **File to Create:** `apps/backend/scripts/backfill-default-folders.ts`
    *   **Implementation:** Write a script to ensure existing agents are not orphaned.
        ```typescript
        // In backfill-default-folders.ts
        import { PrismaClient } from '@prisma/client';
        const prisma = new PrismaClient();

        async function main() {
          const organizations = await prisma.organization.findMany();
          for (const org of organizations) {
            const defaultFolder = await prisma.folder.create({
              data: {
                name: 'Default Projects',
                organizationId: org.id,
              },
            });
            await prisma.agent.updateMany({
              where: {
                organizationId: org.id,
                folderId: null,
              },
              data: {
                folderId: defaultFolder.id,
              },
            });
            console.log(`Created default folder for organization ${org.name}`);
          }
        }
        main().catch(e => console.error(e)).finally(async () => await prisma.$disconnect());
        ```
    *   **Acceptance Criteria:** The script is written, tested on a staging database, and is ready to be run once immediately after the schema migration is deployed to production.

---

#### **Task 1.3: Define API Contracts (OpenAPI/Swagger)**

**Goal:** Decouple backend and frontend development by providing a clear, auto-generated API specification.

*   **Action Item 1.3.1: Install and Configure Swagger**
    *   **File to Modify:** `apps/backend/src/main.ts`
    *   **Implementation:**
        1.  Install dependencies: `pnpm add @nestjs/swagger swagger-ui-express`
        2.  Add the configuration code to your `main.ts` bootstrap function.
            ```typescript
            // In main.ts
            import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

            async function bootstrap() {
              const app = await NestFactory.create(AppModule);
              // ... other configurations
              const config = new DocumentBuilder()
                .setTitle('Jibu AI API')
                .setDescription('API documentation for the Jibu AI Platform')
                .setVersion('1.0')
                .addBearerAuth()
                .build();
              const document = SwaggerModule.createDocument(app, config);
              SwaggerModule.setup('api', app, document); // Exposes spec at /api
              await app.listen(3000);
            }
            bootstrap();
            ```
    *   **Acceptance Criteria:** After running the backend, the Swagger UI is available at `http://localhost:3000/api`.

*   **Action Item 1.3.2: Annotate New Controllers**
    *   **Files to Modify:** All new controllers (`folder.controller.ts`, `api-key.controller.ts`, etc.).
    *   **Implementation:** Use decorators to describe each endpoint.
        ```typescript
        // Example in folder.controller.ts
        import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

        @ApiTags('Folders')
        @ApiBearerAuth()
        @Controller('folders')
        export class FolderController {
          @Post()
          @ApiOperation({ summary: 'Create a new folder' })
          @ApiResponse({ status: 201, description: 'The folder has been successfully created.'})
          @ApiResponse({ status: 403, description: 'Forbidden.' })
          create(@Body() createFolderDto: CreateFolderDto) {
            // ... implementation
          }
        }
        ```
    *   **Acceptance Criteria:** All new endpoints defined in this plan appear in the Swagger UI with correct request bodies and response codes.

---

#### **Task 1.4: Finalize Secrets Management & Encryption Strategy**

**Goal:** Ensure no secrets are hardcoded and that all sensitive data is handled securely.

*   **Action Item 1.4.1: Refactor Vault Service**
    *   **File to Modify:** `apps/backend/src/core/encryption/vault.service.ts`
    *   **Implementation:** Remove any direct dependency on `process.env`. The master encryption key should be provided via the `ConfigService` (which should be configured to pull from your chosen secrets manager, e.g., AWS Secrets Manager).
        ```typescript
        // In vault.service.ts constructor
        constructor(private readonly configService: ConfigService) {
          const masterKey = this.configService.get('ENCRYPTION_MASTER_KEY');
          if (!masterKey) {
            throw new Error('FATAL: ENCRYPTION_MASTER_KEY not configured!');
          }
          // ... initialize encryption library with masterKey
        }
        ```    *   **Acceptance Criteria:** The application fails to start if the master key cannot be retrieved from the secure source.

*   **Action Item 1.4.2: Implement Sensitive Data Redaction in Logs**
    *   **File to Create:** `apps/backend/src/core/middleware/redaction-logging.middleware.ts`
    *   **Implementation:** Create a middleware that intercepts logging calls or request bodies and removes sensitive keys.
        ```typescript
        // Psuedocode for the middleware logic
        const sensitiveKeys = ['apiKey', 'token', 'encryptedKeyValue', 'password'];
        function redact(obj: any) {
          // Recursively iterate over object and replace values for sensitive keys with '[REDACTED]'
        }
        ```
    *   **Acceptance Criteria:** Test logs show that sensitive fields are redacted correctly.

---

#### **Task 1.5: Implement Authorization (RBAC) Guards**

**Goal:** Secure every endpoint by default.

*   **Action Item 1.5.1: Create Guard Files**
    *   **Files to Create:** `apps/backend/src/core/auth/guards/workspace-member.guard.ts` and `apps/backend/src/core/auth/guards/role.guard.ts`.
    *   **Implementation:**
        ```typescript
        // In workspace-member.guard.ts
        @Injectable()
        export class WorkspaceMemberGuard implements CanActivate {
          constructor(private prisma: PrismaService) {}
          async canActivate(context: ExecutionContext): Promise<boolean> {
            const request = context.switchToHttp().getRequest();
            const { user } = request;
            const workspaceId = request.params.workspaceId || request.body.workspaceId;

            if (!user || !workspaceId) return false;

            const membership = await this.prisma.organizationMember.findUnique({
              where: { userId_organizationId: { userId: user.id, organizationId: workspaceId } },
            });
            return !!membership;
          }
        }
        ```
    *   **Acceptance Criteria:** The guard files are created and contain the necessary logic to verify user membership and roles against the database.

*   **Action Item 1.5.2: Apply Guards to Controllers**
    *   **Files to Modify:** All controllers related to workspace data (e.g., `folder.controller.ts`).
    *   **Implementation:** Use the `@UseGuards` decorator.
        ```typescript
        // At the top of folder.controller.ts
        @UseGuards(JwtAuthGuard, WorkspaceMemberGuard) // Protects all routes in this controller
        export class FolderController {
            @Post()
            @UseGuards(RoleGuard('ADMIN')) // Protects this specific route for Admins only
            create(...) { /* ... */ }
        }
        ```
    *   **Acceptance Criteria:** An automated test (or manual Postman test) confirms that an unauthorized user receives a 403 Forbidden error when trying to access a protected resource.

---

#### **Task 1.6: Refine Backend Service Logic**

**Goal:** Integrate security and new business rules directly into the service layer.

*   **Action Item 1.6.1: Add Authorization Checks to Services**
    *   **Files to Modify:** All service files (`folder.service.ts`, etc.).
    *   **Implementation:** Every public method in a service should accept `userId` and `workspaceId` as arguments and use them in database queries to scope the results.
        ```typescript
        // In folder.service.ts
        async getFoldersForUser(userId: string, workspaceId: string) {
          // The guard has already confirmed membership, but we scope the query for safety.
          return this.prisma.folder.findMany({ where: { organizationId: workspaceId } });
        }
        ```
    *   **Acceptance Criteria:** Code review confirms that no service method can access data outside of the user's authorized scope.

*   **Action Item 1.6.2: Implement Invitation Logic and Expiry Job**
    *   **File to Modify:** `apps/backend/src/modules/v1/organization/organization.service.ts`
    *   **Implementation:**
        1.  In the `revokeInvitation` method, add a check: `if (invitation.status === 'ACCEPTED') throw new BadRequestException('Cannot revoke an accepted invitation. Please remove the member instead.');`
        2.  Add a new module for scheduled tasks, install `@nestjs/schedule`, and create a cron job.
            ```typescript
            // In a new file, e.g., invitation.scheduler.ts
            import { Cron, CronExpression } from '@nestjs/schedule';
            @Injectable()
            export class InvitationScheduler {
              @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
              async handleExpiredInvitations() {
                // ... logic to find invitations older than 7 days and update status to 'EXPIRED'
              }
            }
            ```
    *   **Acceptance Criteria:** The business logic for invitations is robust, and the cron job is implemented.

*   **Action Item 1.6.3: Implement Graceful Error Handling for Key Retrieval**
    *   **File to Modify:** `apps/backend/src/modules/v1/agent/execution/agent-execution.service.ts`
    *   **Implementation:** At the point where you call `getApiKeyForService`, wrap it in a `try/catch`.
        ```typescript
        try {
          const apiKey = await this.keyManagementService.getApiKeyForService(...);
          // ... proceed with execution
        } catch (error) {
          if (error instanceof MissingApiKeyError) {
            // ... update the execution state to FAILED with a specific error message
            console.error(`Execution failed: ${error.message}`);
          }
        }
        ```
    *   **Acceptance Criteria:** Agent execution doesn't crash the application if a key is missing; instead, it correctly logs the failure and updates the agent's state.