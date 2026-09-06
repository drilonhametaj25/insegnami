import { NextResponse } from 'next/server';
import {
  requireAuth,
  authError,
  getChildStudentIds,
  getStudentIdForUser,
} from '@/lib/api-auth';
import { prisma } from '@/lib/db';

// GET /api/parent-meetings/my-options
// Opzioni per la richiesta colloqui del portale famiglia:
// - children: figli del genitore (StudentGuardian + fallback parentUserId)
// - teachers: docenti delle classi dei figli (StudentClass → Class.teacherId, dedup)
// Per STUDENT (read-only): children vuoto, teachers delle proprie classi.
export async function GET() {
  try {
    const ctx = await requireAuth({
      roles: ['PARENT', 'STUDENT', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'SUPERADMIN'],
    });

    // Studenti di riferimento: figli per il genitore, se stesso per lo studente
    let studentIds: string[] = [];
    let children: { id: string; firstName: string; lastName: string }[] = [];

    if (ctx.role === 'STUDENT') {
      // Per lo studente (read-only) children contiene il proprio profilo:
      // consente al client di conoscere il proprio studentId.
      const sid = await getStudentIdForUser(ctx);
      studentIds = sid ? [sid] : [];
      if (sid) {
        const self = await prisma.student.findFirst({
          where: { id: sid, tenantId: ctx.tenantId },
          select: { id: true, firstName: true, lastName: true },
        });
        if (self) children = [self];
      }
    } else {
      studentIds = await getChildStudentIds(ctx);
      if (studentIds.length > 0) {
        children = await prisma.student.findMany({
          where: {
            id: { in: studentIds },
            tenantId: ctx.tenantId,
          },
          select: { id: true, firstName: true, lastName: true },
          orderBy: { firstName: 'asc' },
        });
      }
    }

    if (studentIds.length === 0) {
      return NextResponse.json({ children, teachers: [] });
    }

    // Classi attive dei figli → docente titolare + materie insegnate
    const classes = await prisma.class.findMany({
      where: {
        tenantId: ctx.tenantId,
        students: {
          some: {
            studentId: { in: studentIds },
            isActive: true,
          },
        },
      },
      select: {
        teacherId: true,
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
        classSubjects: {
          select: {
            teacherId: true,
            subject: { select: { name: true } },
          },
        },
      },
    });

    // Dedup docenti per id, aggregando le materie che insegnano nelle classi
    const teacherMap = new Map<
      string,
      { id: string; firstName: string; lastName: string; subjects: Set<string> }
    >();

    for (const cls of classes) {
      if (!cls.teacher) continue;
      let entry = teacherMap.get(cls.teacher.id);
      if (!entry) {
        entry = { ...cls.teacher, subjects: new Set<string>() };
        teacherMap.set(cls.teacher.id, entry);
      }
      for (const cs of cls.classSubjects ?? []) {
        if (cs.teacherId === cls.teacher.id && cs.subject?.name) {
          entry.subjects.add(cs.subject.name);
        }
      }
    }

    const teachers = Array.from(teacherMap.values()).map((t) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      subjects: Array.from(t.subjects),
    }));

    return NextResponse.json({ children, teachers });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Parent meetings my-options GET error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
