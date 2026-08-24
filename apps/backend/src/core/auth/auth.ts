import { prismaAdapter } from '@better-auth/prisma-adapter';
import {
  betterAuth,
  type BetterAuthOptions,
  type BetterAuthPlugin,
  type User as BetterAuthUser,
} from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { admin, createAccessControl, organization } from 'better-auth/plugins';
import { getSharedPrismaService } from '../database/prisma.service';

const authPrisma = getSharedPrismaService();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const backendUrl = process.env.BETTER_AUTH_URL || 'http://localhost:4000';
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const runtimeEnv = process.env.NODE_ENV || 'development';
const configuredSecret = process.env.BETTER_AUTH_SECRET;

if (!configuredSecret && runtimeEnv === 'production') {
  throw new Error('BETTER_AUTH_SECRET must be configured in production');
}

const betterAuthSecret = configuredSecret || 'development-only-better-auth-secret';
const ADMIN_ROLES = ['admin', 'superadmin'] as const;
const adminAccessControl = createAccessControl({
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'impersonate',
    'impersonate-admins',
    'delete',
    'set-password',
    'set-email',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
});
const adminRole = adminAccessControl.newRole({
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'delete',
    'set-password',
    'set-email',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
});
const userRole = adminAccessControl.newRole({ user: [], session: [] });

interface AdminApi {
  banUser(input: {
    body: { userId: string; banReason?: string; banExpiresIn?: number };
    headers?: Headers;
  }): Promise<unknown>;
  unbanUser(input: { body: { userId: string }; headers?: Headers }): Promise<unknown>;
  setRole(input: {
    body: { userId: string; role: string | string[] };
    headers?: Headers;
  }): Promise<unknown>;
}

function platformAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

const socialProviders =
  googleClientId && googleClientSecret
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      }
    : undefined;

export async function provisionApplicationUser(createdUser: BetterAuthUser): Promise<void> {
  const name = createdUser.name || createdUser.email;
  const firstName = name.split(' ')[0] || createdUser.email;
  const configuredAdmin = platformAdminEmails().has(createdUser.email.toLowerCase());
  let authUser = await authPrisma.authUser.findUnique({
    where: { id: createdUser.id },
    select: { role: true, banned: true, banReason: true, banExpires: true },
  });

  if (configuredAdmin && !ADMIN_ROLES.includes(authUser?.role as (typeof ADMIN_ROLES)[number])) {
    await authPrisma.authUser.update({
      where: { id: createdUser.id },
      data: { role: 'admin' },
    });
    authUser = { ...authUser, role: 'admin' };
  }

  const suspended = Boolean(
    authUser?.banned && (!authUser.banExpires || authUser.banExpires > new Date()),
  );

  await authPrisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { id: createdUser.id },
      create: {
        id: createdUser.id,
        email: createdUser.email.toLowerCase(),
        emailConfirmed: Boolean(createdUser.emailVerified),
        fullName: name,
        firstName,
        providerIds: [],
        isAdmin: ADMIN_ROLES.includes(authUser?.role as (typeof ADMIN_ROLES)[number]),
        adminRole: authUser?.role,
        isSuspended: suspended,
        suspendedAt: suspended ? new Date() : null,
        suspensionReason: suspended ? authUser?.banReason || 'Banned by admin' : null,
      },
      update: {
        email: createdUser.email.toLowerCase(),
        emailConfirmed: Boolean(createdUser.emailVerified),
        fullName: name,
        firstName,
        isAdmin: ADMIN_ROLES.includes(authUser?.role as (typeof ADMIN_ROLES)[number]),
        adminRole: authUser?.role,
        isSuspended: suspended,
        suspendedAt: suspended ? undefined : null,
        suspensionReason: suspended ? authUser?.banReason || 'Banned by admin' : null,
      },
    });
    const membership = await tx.workspaceMembership.findFirst({
      where: { userId: user.id },
    });
    const workspace = membership
      ? { id: membership.workspaceId }
      : await tx.workspace.create({
          data: {
            name: `${user.firstName || user.email}'s Workspace`,
            slug: `${user.firstName || 'workspace'}-${createdUser.id.slice(0, 8)}`
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-'),
            memberships: {
              create: {
                userId: user.id,
                role: 'owner',
                status: 'active',
              },
            },
          },
          select: { id: true },
        });

    await tx.user.update({
      where: { id: user.id },
      data: { lastWorkspaceId: workspace.id },
    });
  });
}

export async function syncApplicationUserFromAuth(userId: string): Promise<void> {
  const authUser = await authPrisma.authUser.findUnique({
    where: { id: userId },
    select: { role: true, banned: true, banReason: true, banExpires: true },
  });
  if (!authUser) return;
  const suspended = Boolean(
    authUser.banned && (!authUser.banExpires || authUser.banExpires > new Date()),
  );
  await authPrisma.user.updateMany({
    where: { id: userId },
    data: {
      isAdmin: ADMIN_ROLES.includes(authUser.role as (typeof ADMIN_ROLES)[number]),
      adminRole: authUser.role,
      isSuspended: suspended,
      suspendedAt: suspended ? new Date() : null,
      suspensionReason: suspended ? authUser.banReason || 'Banned by admin' : null,
    },
  });
}

async function resolveOrCreateWorkspace(userId: string): Promise<string | null> {
  const user = await authPrisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      firstName: true,
      lastWorkspaceId: true,
    },
  });
  if (!user) return null;

  const membershipWhere = {
    userId,
    status: 'active',
  };
  if (user.lastWorkspaceId) {
    const lastMembership = await authPrisma.workspaceMembership.findFirst({
      where: {
        ...membershipWhere,
        workspaceId: user.lastWorkspaceId,
      },
      select: { workspaceId: true },
    });
    if (lastMembership) return lastMembership.workspaceId;
  }

  const existingMembership = await authPrisma.workspaceMembership.findFirst({
    where: {
      ...membershipWhere,
      role: 'owner',
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { workspaceId: true },
  });
  if (existingMembership) {
    await authPrisma.user.update({
      where: { id: userId },
      data: { lastWorkspaceId: existingMembership.workspaceId },
    });
    return existingMembership.workspaceId;
  }

  const workspace = await authPrisma.workspace.create({
    data: {
      name: `${user.firstName || user.email}'s Workspace`,
      slug: `${user.firstName || 'workspace'}-${userId.slice(0, 8)}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
      memberships: {
        create: {
          userId,
          role: 'owner',
          status: 'active',
        },
      },
    },
    select: { id: true },
  });
  await authPrisma.user.update({
    where: { id: userId },
    data: { lastWorkspaceId: workspace.id },
  });
  return workspace.id;
}

const databaseHooks: NonNullable<BetterAuthOptions['databaseHooks']> = {
  user: {
    create: {
      before: async (createdUser) => {
        if (platformAdminEmails().has(createdUser.email.toLowerCase())) {
          return { data: { ...createdUser, role: 'admin' } };
        }
        return { data: createdUser };
      },
      after: async (createdUser) => {
        await provisionApplicationUser(createdUser);
      },
    },
    update: {
      after: async (updatedUser) => {
        await provisionApplicationUser(updatedUser);
      },
    },
  },
  session: {
    create: {
      before: async (createdSession) => {
        const workspaceId = await resolveOrCreateWorkspace(createdSession.userId);
        return {
          data: {
            activeOrganizationId: workspaceId,
          },
        };
      },
    },
  },
};

const authInstance = betterAuth({
  secret: betterAuthSecret,
  baseURL: backendUrl,
  trustedOrigins: [frontendUrl, backendUrl],
  database: prismaAdapter(authPrisma, {
    provider: 'postgresql',
    transaction: true,
  }),
  user: {
    modelName: 'AuthUser',
  },
  session: {
    modelName: 'AuthSession',
    cookieCache: {
      enabled: true,
      maxAge: 300,
      strategy: 'compact',
    },
    freshAge: 3600,
  },
  account: {
    modelName: 'AuthAccount',
  },
  verification: {
    modelName: 'AuthVerification',
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ url }) => {
      if (runtimeEnv !== 'production') {
        console.warn(
          `[Better Auth] Password reset email delivery is not configured. Reset URL: ${url}`,
        );
        return;
      }
      throw new Error('Email delivery is not configured');
    },
  },
  socialProviders,
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: [...ADMIN_ROLES],
      roles: { admin: adminRole, superadmin: adminRole, user: userRole },
    }) as unknown as BetterAuthPlugin,
    organization({
      creatorRole: 'owner',
      allowUserToCreateOrganization: true,
      schema: {
        session: {
          fields: {
            activeOrganizationId: 'activeOrganizationId',
          },
        },
        organization: {
          modelName: 'Workspace',
        },
        member: {
          modelName: 'WorkspaceMembership',
          fields: {
            organizationId: 'workspaceId',
          },
        },
        invitation: {
          modelName: 'Invitation',
          fields: {
            organizationId: 'workspaceId',
            inviterId: 'invitedById',
          },
        },
      },
      sendInvitationEmail: async ({ id, email, organization: invitedOrganization }) => {
        const invitationUrl = `${frontendUrl}/invite/${id}`;
        if (runtimeEnv !== 'production') {
          console.warn(
            `[Better Auth] Invitation email delivery is not configured. Invitation URL for ${email} to ${invitedOrganization.name}: ${invitationUrl}`,
          );
          return;
        }
        throw new Error('Email delivery is not configured');
      },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (context) => {
      // User impersonation is deliberately disabled for this application.
      if (context.path === '/admin/impersonate-user') {
        throw APIError.from('FORBIDDEN', {
          code: 'IMPERSONATION_DISABLED',
          message: 'User impersonation is disabled',
        });
      }
    }),
    after: createAuthMiddleware(async (context) => {
      if (!['/admin/ban-user', '/admin/unban-user', '/admin/set-role'].includes(context.path)) return;
      const session = context.context.session;
      const body = context.body as { userId?: string; role?: string | string[] } | undefined;
      if (!session?.user?.id || !body?.userId) return;
      await syncApplicationUserFromAuth(body.userId);

      const actionByPath: Record<string, string> = {
        '/admin/ban-user': 'BAN_USER',
        '/admin/unban-user': 'UNBAN_USER',
        '/admin/set-role': 'SET_ROLE',
      };
      await authPrisma.adminAuditLog.create({
        data: {
          adminUserId: session.user.id,
          action: actionByPath[context.path],
          targetType: 'User',
          targetId: body.userId,
          details: {
            role: body.role,
            statusCode: 200,
          },
          ipAddress: session.session.ipAddress || null,
          userAgent: session.session.userAgent || null,
        },
      });
    }),
  },
  databaseHooks,
});

// Admin plugin endpoints require this minimal cast because its nested core type is incompatible.
export const auth = authInstance as typeof authInstance & {
  api: typeof authInstance.api & AdminApi;
};
