import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { getEffectiveLimits } from '@/lib/billing/limits';

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admin and superadmin can perform bulk actions
    if (!['ADMIN', 'DIRECTOR', 'SECRETARY', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const tenantId = session.user.tenantId;
    const { action, teacherIds } = await request.json();

    if (!action || !teacherIds || !Array.isArray(teacherIds) || teacherIds.length === 0) {
      return NextResponse.json(
        { error: 'Azione e ID degli insegnanti richiesti' },
        { status: 400 }
      );
    }

    // Validate that all teachers belong to the current tenant
    // (status incluso: serve al check dei limiti piano sull'activate)
    const targetTeachers = await prisma.teacher.findMany({
      where: {
        id: { in: teacherIds },
        tenantId
      },
      select: { id: true, status: true }
    });

    if (targetTeachers.length !== teacherIds.length) {
      return NextResponse.json(
        { error: 'Alcuni insegnanti non trovati o non autorizzati' },
        { status: 400 }
      );
    }

    // Anti-bypass limiti piano: l'attivazione bulk non deve superare
    // maxTeachers (stesso guard della POST singola).
    if (action === 'activate' && session.user.role !== 'SUPERADMIN') {
      const limits = await getEffectiveLimits(tenantId);
      if (limits.maxTeachers != null) {
        const toActivate = targetTeachers.filter((t) => t.status !== 'ACTIVE').length;
        const currentActive = await prisma.teacher.count({
          where: { tenantId, status: 'ACTIVE' },
        });
        if (currentActive + toActivate > limits.maxTeachers) {
          return NextResponse.json(
            {
              error: `Limite docenti del piano raggiunto (${limits.maxTeachers}): impossibile attivare ${toActivate} docenti (attivi: ${currentActive}). Effettua l'upgrade del piano o acquista un add-on.`,
              code: 'plan-limit',
              limit: limits.maxTeachers,
              current: currentActive,
              requested: toActivate,
            },
            { status: 403 }
          );
        }
      }
    }

    let updateData: any = {};

    switch (action) {
      case 'activate':
        updateData = { status: 'ACTIVE' };
        break;
      case 'deactivate':
        updateData = { status: 'INACTIVE' };
        break;
      case 'suspend':
      case 'leave':
        updateData = { status: 'SUSPENDED' };
        break;
      case 'delete':
        // For delete action, we'll handle it separately
        break;
      default:
        return NextResponse.json(
          { error: 'Azione non valida' },
          { status: 400 }
        );
    }

    if (action === 'delete') {
      // Check if any teacher has associated classes or lessons
      const teachersWithClasses = await prisma.teacher.findMany({
        where: {
          id: { in: teacherIds },
          tenantId,
          OR: [
            {
              classes: {
                some: {}
              }
            },
            {
              lessons: {
                some: {}
              }
            }
          ]
        },
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      });

      if (teachersWithClasses.length > 0) {
        return NextResponse.json(
          { 
            error: 'Impossibile eliminare insegnanti con classi o lezioni assegnate',
            details: teachersWithClasses.map((t: { firstName: string; lastName: string }) => `${t.firstName} ${t.lastName}`)
          },
          { status: 400 }
        );
      }

      // Delete teachers
      await prisma.teacher.deleteMany({
        where: {
          id: { in: teacherIds },
          tenantId
        }
      });
    } else {
      // Update teachers
      await prisma.teacher.updateMany({
        where: {
          id: { in: teacherIds },
          tenantId
        },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Azione '${action}' eseguita su ${teacherIds.length} insegnanti`,
      affectedCount: teacherIds.length
    });

  } catch (error) {
    console.error('Teacher bulk action error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
