import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { rateLimitByKey } from "@/lib/rate-limit";

const authOptions = {
  trustHost: true, // Required for production behind reverse proxy
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).toLowerCase();
        const password = credentials.password as string;

        // Rate limit per email: 10 attempts per minute, defends against
        // credential stuffing without affecting legitimate users.
        const allowed = await rateLimitByKey(email, 10, 60 * 1000, 'rl:login');
        if (!allowed) {
          return null;
        }

        try {
          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user || !user.password) {
            return null;
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(
            password,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          // Check if user has active status
          if (user.status !== "ACTIVE") {
            return null;
          }

          // Get user's tenant relationship
          const userTenant = await prisma.userTenant.findFirst({
            where: { userId: user.id },
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          if (!userTenant) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: userTenant.role,
            tenantId: userTenant.tenantId,
            tenantName: userTenant.tenant.name,
            permissions: userTenant.permissions,
            avatar: user.avatar,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/login",
    signUp: "/auth/register",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }: any) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.permissions = user.permissions;
        token.avatar = user.avatar;
        token.refreshedAt = Date.now();
      }

      // Session update — triggered client-side via useSession().update().
      // We ALWAYS re-fetch role/status/tenant from the DB so a role change
      // by an admin or a User.status flip to INACTIVE takes effect on the
      // next request, not after JWT expiry (30 days). The JWT cache stays
      // (no DB hit per request) but invalidation is now under our control.
      if (trigger === "update" && token?.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
            status: true,
            tenants: {
              where: token.tenantId ? { tenantId: token.tenantId as string } : undefined,
              select: { role: true, tenantId: true, permissions: true, tenant: { select: { name: true, isActive: true } } },
              take: 1,
            },
          },
        });
        if (fresh && fresh.status === 'ACTIVE') {
          const ut = fresh.tenants[0];
          token.firstName = fresh.firstName;
          token.lastName = fresh.lastName;
          token.avatar = fresh.avatar;
          if (ut) {
            token.role = ut.role;
            token.tenantId = ut.tenantId;
            token.tenantName = ut.tenant?.name ?? token.tenantName;
            token.permissions = ut.permissions;
          }
          token.refreshedAt = Date.now();
        } else if (fresh && fresh.status !== 'ACTIVE') {
          // User was suspended / deactivated — drop role so route guards
          // refuse subsequent requests. NextAuth doesn't expose direct
          // session invalidation, but a role of 'INACTIVE_USER' won't
          // satisfy any can() check.
          token.role = 'INACTIVE_USER';
        }

        // Allow caller to additionally override specific keys via session arg.
        if (session) {
          token = { ...token, ...session };
        }
      }

      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.tenantName = token.tenantName;
        session.user.permissions = token.permissions;
        session.user.avatar = token.avatar;
      }
      return session;
    },
  },
  events: {
    async signOut(message: any) {
      console.log("User signed out:", message.token?.email);
    },
  },
  debug: process.env.NODE_ENV === "development",
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
export { authOptions };

// Create a wrapper that properly handles the async nature of auth() in Next.js 15
export async function getAuth() {
  try {
    return await auth();
  } catch (error) {
    // In development, Next.js 15 may throw errors for sync header access
    // For now, we'll catch and return null to prevent crashes
    if (process.env.NODE_ENV === "development") {
      console.warn("Auth error (likely Next.js 15 headers issue):", error);
      return null;
    }
    throw error;
  }
}

// Role helper constants for permission checks
// ADMIN_ROLES: All roles that have full administrative access
export const ADMIN_ROLES: Role[] = ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'];

// Helper function to check if a role has admin access
export function isAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role as Role);
}

// Helper function to check if a role can manage (admin + teacher)
export function canManage(role: string | undefined): boolean {
  if (!role) return false;
  return [...ADMIN_ROLES, 'TEACHER'].includes(role as Role);
}
