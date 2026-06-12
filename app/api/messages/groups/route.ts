import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole, canManage } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTeacherIdForUser, type AuthContext } from '@/lib/api-auth';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { z } from 'zod';

// Schema di validazione per la creazione di un gruppo di comunicazione custom
const createGroupSchema = z.object({
  name: z.string().min(2, 'Il nome deve avere almeno 2 caratteri'),
  description: z.string().optional(),
  memberIds: z.array(z.string().min(1)).min(1, 'Almeno un membro richiesto'),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build predefined groups based on existing data
    const groups: any[] = [];

    try {
      // Get all classes the user can access
      let classesWhere: any = {
        tenantId: session.user.tenantId,
      };

      // SECURITY: Class.teacherId references Teacher.id, NOT User.id.
      if (session.user.role === 'TEACHER') {
        const ctx = {
          userId: session.user.id ?? '',
          tenantId: session.user.tenantId,
          role: session.user.role,
          email: session.user.email ?? '',
          isSuperAdmin: false,
          session,
        } as AuthContext;
        const tid = await getTeacherIdForUser(ctx);
        classesWhere.teacherId = tid ?? '__no_teacher__';
      }

      const classes = await prisma.class.findMany({
        where: classesWhere,
        include: {
          course: {
            select: {
              name: true,
            },
          },
          students: {
            select: {
              id: true,
            },
          },
        },
      });

      // Add class-based groups
      classes.forEach(classItem => {
        groups.push({
          id: `class_${classItem.id}`,
          name: `Classe ${classItem.name}`,
          description: `Gruppo per la classe ${classItem.name} - ${classItem.course?.name || 'Senza corso'}`,
          type: 'CLASS',
          memberCount: classItem.students.length,
          classId: classItem.id,
          className: classItem.name,
          courseName: classItem.course?.name,
          createdAt: classItem.createdAt,
        });
      });

      // Get all courses
      const courses = await prisma.course.findMany({
        where: {
          tenantId: session.user.tenantId,
        },
        include: {
          classes: {
            include: {
              students: true,
            },
          },
        },
      });

      // Add course-based groups
      courses.forEach(course => {
        const totalStudents = course.classes.reduce((sum: number, cls: any) => sum + cls.students.length, 0);
        groups.push({
          id: `course_${course.id}`,
          name: `Corso ${course.name}`,
          description: `Gruppo per tutti gli studenti del corso ${course.name}`,
          type: 'COURSE',
          memberCount: totalStudents,
          courseId: course.id,
          courseName: course.name,
          createdAt: course.createdAt,
        });
      });

      // Add role-based groups if user is admin
      if (isAdminRole(session.user.role)) {
        const [teachersCount, studentsCount, parentsCount] = await Promise.all([
          prisma.userTenant.count({
            where: {
              tenantId: session.user.tenantId,
              role: 'TEACHER',
            },
          }),
          prisma.userTenant.count({
            where: {
              tenantId: session.user.tenantId,
              role: 'STUDENT',
            },
          }),
          prisma.userTenant.count({
            where: {
              tenantId: session.user.tenantId,
              role: 'PARENT',
            },
          }),
        ]);

        groups.push(
          {
            id: 'all_teachers',
            name: 'Tutti i Docenti',
            description: 'Gruppo con tutti i docenti della scuola',
            type: 'TEACHERS',
            memberCount: teachersCount,
            createdAt: new Date(),
          },
          {
            id: 'all_students',
            name: 'Tutti gli Studenti',
            description: 'Gruppo con tutti gli studenti della scuola',
            type: 'STUDENTS',
            memberCount: studentsCount,
            createdAt: new Date(),
          },
          {
            id: 'all_parents',
            name: 'Tutti i Genitori',
            description: 'Gruppo con tutti i genitori della scuola',
            type: 'PARENTS',
            memberCount: parentsCount,
            createdAt: new Date(),
          }
        );
      }

      // Gruppi CUSTOM creati dagli utenti (POST sottostante)
      const customGroups = await prisma.communicationGroup.findMany({
        where: { tenantId: session.user.tenantId, isActive: true },
        include: { _count: { select: { memberships: true } } },
        orderBy: { createdAt: 'desc' },
      });
      customGroups.forEach((g) => {
        groups.push({
          id: g.id,
          name: g.name,
          description: g.description || '',
          type: 'CUSTOM',
          memberCount: g._count.memberships,
          createdAt: g.createdAt,
        });
      });

      // Sort by creation date
      groups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedGroups = groups.slice(startIndex, startIndex + limit);
      const totalPages = Math.ceil(groups.length / limit);

      return NextResponse.json({
        groups: paginatedGroups,
        pagination: {
          page,
          limit,
          total: groups.length,
          totalPages,
        },
      });

    } catch (dbError) {
      console.error('Database error in groups API:', dbError);
      // Return empty groups on database error
      return NextResponse.json({
        groups: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }
  } catch (error) {
    console.error('Error fetching message groups:', error);
    return NextResponse.json(
      {
        groups: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        }
      },
      { status: 500 }
    );
  }
}

// POST /api/messages/groups — crea un gruppo di comunicazione custom con membri
export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Possono creare gruppi gli admin (ADMIN_ROLES) e i docenti
    if (!canManage(session.user.role)) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const tenantId = session.user.tenantId;
    const creatorId = session.user.id; // narrow: già verificato sopra

    const body = await request.json();
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, description, memberIds } = parsed.data;

    // Verifica FK cross-tenant: TUTTI i memberIds devono essere utenti del tenant.
    // Dedup per non farsi ingannare da id duplicati nel payload.
    const uniqueMemberIds = Array.from(new Set(memberIds));
    const memberships = await prisma.userTenant.findMany({
      where: {
        userId: { in: uniqueMemberIds },
        tenantId,
      },
      select: { userId: true },
    });
    const validUserIds = new Set(memberships.map((m) => m.userId));
    if (validUserIds.size !== uniqueMemberIds.length) {
      const invalidIds = uniqueMemberIds.filter((id) => !validUserIds.has(id));
      return NextResponse.json(
        { error: 'Utenti non validi: alcuni ID non appartengono a questo tenant', invalidIds },
        { status: 400 }
      );
    }

    // Crea gruppo + membri in transazione (tutto o niente)
    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.communicationGroup.create({
        data: {
          tenantId,
          creatorId,
          name,
          description: description ?? null,
          type: 'CUSTOM',
        },
      });

      await tx.communicationGroupMember.createMany({
        data: uniqueMemberIds.map((userId) => ({
          groupId: created.id,
          userId,
        })),
      });

      return created;
    });

    return NextResponse.json(
      {
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          type: group.type,
          memberCount: uniqueMemberIds.length,
          createdAt: group.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating message group:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
