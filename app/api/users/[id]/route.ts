import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { ensureProfileForRole, deactivateProfileForRoleChange } from '@/lib/user-profile-sync';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/users/[id] - Get single user
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;

    // Users can view their own profile, admins can view any user in their tenant
    const canViewUser = 
      session.user.id === id || 
      isAdminRole(session.user.role);

    if (!canViewUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN' && session.user.id !== id) {
      where.tenants = {
        some: {
          tenantId: session.user.tenantId,
        },
      };
    }

    const user = await prisma.user.findFirst({
      where,
      include: {
        tenants: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Transform user for response
    const responseUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
      tenants: user.tenants.map(ut => ({
        tenantId: ut.tenantId,
        tenantName: ut.tenant.name,
        role: ut.role,
        permissions: ut.permissions,
      })),
    };

    return NextResponse.json({ user: responseUser });

  } catch (error) {
    console.error('User GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;
    const body = await request.json();

    // Users can update their own profile, admins can update any user in their tenant
    const canUpdateUser = 
      session.user.id === id || 
      isAdminRole(session.user.role);

    if (!canUpdateUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN' && session.user.id !== id) {
      where.tenants = {
        some: {
          tenantId: session.user.tenantId,
        },
      };
    }

    // Check if user exists and is accessible
    const existingUser = await prisma.user.findFirst({
      where,
      include: {
        tenants: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    const { 
      firstName, 
      lastName, 
      phone, 
      password, 
      status, 
      role 
    } = body;

    // Basic profile updates
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;

    // Password update
    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }
      updateData.password = await bcrypt.hash(password, 12);
    }

    // Status update (admin only)
    if (status && isAdminRole(session.user.role)) {
      const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    // Role update (admin only, and can't change own role unless SUPERADMIN)
    let roleChanged: { from: Role; to: Role; tenantId: string } | null = null;
    if (role && isAdminRole(session.user.role)) {
      if (session.user.id === id && session.user.role !== 'SUPERADMIN') {
        return NextResponse.json(
          { error: 'Cannot change your own role' },
          { status: 400 }
        );
      }

      const validRoles = ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'DIRECTOR', 'SECRETARY'];
      if (session.user.role === 'SUPERADMIN') {
        validRoles.push('SUPERADMIN');
      }

      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role' },
          { status: 400 }
        );
      }

      const userTenant = existingUser.tenants.find(ut =>
        session.user.role === 'SUPERADMIN' || ut.tenantId === session.user.tenantId
      );

      if (userTenant && userTenant.role !== role) {
        roleChanged = {
          from: userTenant.role as Role,
          to: role as Role,
          tenantId: userTenant.tenantId,
        };
      }
    }

    // Update user + sync profile in a single transaction so that a partial
    // failure (e.g. profile creation throwing) rolls back the role change
    // too, leaving the system in a consistent state.
    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        include: {
          tenants: {
            include: {
              tenant: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });

      if (roleChanged) {
        await tx.userTenant.update({
          where: {
            userId_tenantId: { userId: id, tenantId: roleChanged.tenantId },
          },
          data: { role: roleChanged.to },
        });

        // Demote: deactivate the old profile (preserve history).
        await deactivateProfileForRoleChange(tx, {
          userId: id,
          tenantId: roleChanged.tenantId,
          oldRole: roleChanged.from,
          newRole: roleChanged.to,
        });

        // Promote: create the new profile if needed (idempotent).
        await ensureProfileForRole(tx, {
          userId: id,
          tenantId: roleChanged.tenantId,
          role: roleChanged.to,
        });
      }

      return updated;
    });

    // Transform response
    const responseUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      avatar: updatedUser.avatar,
      status: updatedUser.status,
      emailVerified: updatedUser.emailVerified,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      lastLogin: updatedUser.lastLogin,
      tenants: updatedUser.tenants.map(ut => ({
        tenantId: ut.tenantId,
        tenantName: ut.tenant.name,
        role: ut.role,
        permissions: ut.permissions,
      })),
    };

    return NextResponse.json({
      message: 'User updated successfully',
      user: responseUser,
    });

  } catch (error) {
    console.error('User PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id } = await params;

    // Only ADMIN and SUPERADMIN can delete users
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cannot delete yourself
    if (session.user.id === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Build where clause with tenant scoping
    const where: any = { id };
    
    if (session.user.role !== 'SUPERADMIN') {
      where.tenants = {
        some: {
          tenantId: session.user.tenantId,
        },
      };
    }

    // Check if user exists and is accessible
    const user = await prisma.user.findFirst({
      where,
      include: {
        tenants: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft-delete pattern (consistent with /api/students/[id]):
    //   - User.status → INACTIVE (preserves login audit, history)
    //   - UserTenant rows removed for the active tenant only (if SUPERADMIN
    //     deleting a cross-tenant user we still purge only the requested
    //     scope; the User itself stays for other tenants)
    //   - Student/Teacher profiles → status INACTIVE (cascade-equivalent
    //     without losing grades/payrolls/etc that point to them)
    //
    // Hard-delete would also work via Prisma cascade, but it would lose
    // historical references (e.g. AuditLog.userId, Payment.studentId chains)
    // that are valuable for compliance.
    const targetTenantId = session.user.role === 'SUPERADMIN'
      ? user.tenants[0]?.tenantId
      : session.user.tenantId;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });

      if (targetTenantId) {
        await tx.userTenant.deleteMany({
          where: { userId: id, tenantId: targetTenantId },
        });

        await tx.student.updateMany({
          where: { userId: id, tenantId: targetTenantId },
          data: { status: 'INACTIVE' as any },
        });
        await tx.teacher.updateMany({
          where: { userId: id, tenantId: targetTenantId },
          data: { status: 'INACTIVE' as any },
        });
      }
    });

    return NextResponse.json({
      message: 'User deleted successfully',
    });

  } catch (error) {
    console.error('User DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
