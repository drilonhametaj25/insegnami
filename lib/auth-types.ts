import type { DefaultSession } from "next-auth";
import type { JWT, DefaultJWT } from "next-auth/jwt";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      firstName: string;
      lastName: string;
      role: Role;
      tenantId: string;
      tenantName: string;
      permissions: any;
      avatar: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    firstName: string;
    lastName: string;
    role: Role;
    tenantId: string;
    tenantName: string;
    permissions: any;
    avatar: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    firstName: string;
    lastName: string;
    role: Role;
    tenantId: string;
    tenantName: string;
    permissions: any;
    avatar: string | null;
  }
}
