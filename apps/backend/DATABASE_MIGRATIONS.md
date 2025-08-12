## Database Migration Workflow

This document outlines the official process for creating and applying database migrations to ensure safety and consistency across all environments.

### Two-Step Migration Process

To prevent accidental data loss and to maintain a clear review process, we follow a two-step workflow for all schema changes.

#### 1. Development Environment

In your local development environment, you can freely generate and apply migrations as you work on features.

```bash
npx prisma migrate dev --name <migration_name>
```

This command will:
- Generate a new SQL migration file in the `prisma/migrations` directory.
- Apply the migration to your local database.
- Ensure your Prisma Client is up-to-date.

Replace `<migration_name>` with a short, descriptive name for your change (e.g., `add-user-avatars`).

#### 2. Staging & Production Environments

Deploying to staging or production requires a more careful approach. **Directly running `migrate dev` in these environments is strictly prohibited.**

**Step A: Create the Migration File (Without Applying)**

First, generate the SQL migration file without applying it to any database.

```bash
npx prisma migrate dev --create-only --name <migration_name>
```

**Step B: Review the SQL Migration**

Manually inspect the generated `.sql` file inside the `prisma/migrations` folder. This is a critical step to:
- Verify that the changes are correct.
- Identify any potentially destructive operations (e.g., dropping a column that could lead to data loss).
- Ensure the migration will perform as expected.

**Step C: Deploy and Apply the Migration**

Once the SQL file has been reviewed and approved, commit it to version control. The CI/CD pipeline should be configured to run the following command during deployment:

```bash
npx prisma migrate deploy
```

This command applies all pending migration files to the database without generating any new ones, making it the safe and recommended way to handle production migrations.
