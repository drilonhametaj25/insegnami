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

        // Rate limit per email: difende dal credential stuffing senza
        // penalizzare gli utenti legittimi. In sviluppo/test il limite è
        // alto per non rendere instabili le suite E2E (login ripetuti).
        const loginLimit = process.env.NODE_ENV === 'production' ? 10 : 1000;
        const allowed = await rateLimitByKey(email, loginLimit, 60 * 1000, 'rl:login');
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
          // orderBy deterministico: con più appartenenze viene scelta sempre
          // la più vecchia; tenantCount serve al futuro switch multi-sede.
          const [userTenant, tenantCount] = await Promise.all([
            prisma.userTenant.findFirst({
              where: { userId: user.id },
              orderBy: { createdAt: 'asc' },
              include: {
                tenant: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            }),
            prisma.userTenant.count({ where: { userId: user.id } }),
          ]);

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
            tenantCount,
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
        token.tenantCount = user.tenantCount;
        token.permissions = user.permissions;
        token.avatar = user.avatar;
        token.refreshedAt = Date.now();
      }

      // Re-fetch role/status/tenant from the DB so a role change by an admin
      // or a User.status flip to INACTIVE takes effect quickly, not after
      // JWT expiry (30 days). The JWT cache stays (no DB hit per request)
      // but invalidation is now under our control.
      const refreshFromDb = async () => {
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
          // Timbrato comunque: evita una query DB a ogni richiesta successiva.
          token.refreshedAt = Date.now();
        } else {
          // Utente non trovato (cancellato): niente da aggiornare, ma il
          // timbro evita di rieseguire la query a ogni richiesta.
          token.refreshedAt = Date.now();
        }
      };

      // Session update (useSession().update()) o refresh periodico: il token
      // resta valido 30 giorni, quindi ogni 5 minuti rileggiamo dal DB.
      const refreshedAt = typeof token.refreshedAt === 'number' ? token.refreshedAt : 0;
      const isStale = Date.now() - refreshedAt > 5 * 60 * 1000;
      if ((trigger === "update" || isStale) && token?.id) {
        await refreshFromDb();

        // Allow caller to additionally override specific keys via session arg.
        if (trigger === "update" && session) {
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
