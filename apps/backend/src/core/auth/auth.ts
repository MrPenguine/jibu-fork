import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth, type BetterAuthOptions, type User as BetterAuthUser } from 'better-auth';
import { organization } from 'better-auth/plugins';
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
      },
      update: {
        email: createdUser.email.toLowerCase(),
        emailConfirmed: Boolean(createdUser.emailVerified),
        fullName: name,
        firstName,
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

const databaseHooks: NonNullable<BetterAuthOptions['databaseHooks']> = {
  user: {
    create: {
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
      after: async (createdSession) => {
        const user = await authPrisma.user.findUnique({
          where: { id: createdSession.userId },
          select: { lastWorkspaceId: true },
        });
        if (user?.lastWorkspaceId) {
          await authPrisma.authSession.update({
            where: { id: createdSession.id },
            data: { activeOrganizationId: user.lastWorkspaceId },
          });
        }
      },
    },
  },
};

export const auth = betterAuth({
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
  databaseHooks,
});
