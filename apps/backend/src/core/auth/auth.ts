import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { PrismaClient } from '@prisma/client';

export const authPrisma = new PrismaClient();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const backendUrl = process.env.BETTER_AUTH_URL || 'http://localhost:4000';
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const socialProviders =
  googleClientId && googleClientSecret
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      }
    : undefined;

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || 'development-only-better-auth-secret',
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
    sendResetPassword: async () => {
      // The sender is intentionally injectable when email delivery is added.
    },
  },
  socialProviders,
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser: any) => {
          const name = createdUser.name || createdUser.email;
          await authPrisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                id: createdUser.id,
                email: createdUser.email.toLowerCase(),
                emailConfirmed: Boolean(createdUser.emailVerified),
                fullName: name,
                firstName: name.split(' ')[0],
                providerIds: [],
              },
            });
            const workspace = await tx.workspace.create({
              data: {
                name: `${user.firstName || user.email}'s Workspace`,
                memberships: {
                  create: {
                    userId: user.id,
                    role: 'owner',
                    status: 'active',
                  },
                },
              },
            });
            await tx.user.update({
              where: { id: user.id },
              data: { lastWorkspaceId: workspace.id },
            });
          });
        },
      },
    },
  } as any,
});
