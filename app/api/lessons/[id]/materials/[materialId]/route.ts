import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { unlink } from 'fs/promises';
import { prisma } from '@/lib/db';
import {
  requireAuth,
  authError,
  getTeacherIdForUser,
  getStudentIdForUser,
  type AuthContext,
} from '@/lib/api-auth';
import { resolveSafeUploadPath } from '@/lib/uploads/safe-path';
import { serveMaterialFile } from '@/lib/uploads/serve-material';

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  // tags non è persistito a schema: accettato e ignorato per compat client
  tags: z.array(z.string()).optional(),
});

/**
 * Carica il materiale (scoped su lezione+tenant) e verifica la titolarità:
 * admin ok; TEACHER solo se titolare della lezione.
 */
async function loadForWrite(ctx: AuthContext, lessonId: string, materialId: string) {
  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      lessonId,
      ...(ctx.isSuperAdmin ? {} : { tenantId: ctx.tenantId }),
    },
    include: {
      lesson: { select: { id: true, classId: true, teacherId: true } },
    },
  });

  if (!material) {
    return { material: null, response: NextResponse.json({ error: 'Materiale non trovato' }, { status: 404 }) };
  }

  if (ctx.role === 'TEACHER') {
    const teacherId = await getTeacherIdForUser(ctx);
    if (!teacherId || material.lesson.teacherId !== teacherId) {
      return { material: null, response: NextResponse.json({ error: 'Accesso negato' }, { status: 403 }) };
    }
  }

  return { material, response: null };
}

// GET /api/lessons/[id]/materials/[materialId] — dettaglio; ?download=1 → file/URL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id, materialId } = await params;

    const material = await prisma.material.findFirst({
      where: {
        id: materialId,
        lessonId: id,
        ...(ctx.isSuperAdmin ? {} : { tenantId: ctx.tenantId }),
      },
      include: {
        lesson: { select: { id: true, classId: true, teacherId: true } },
      },
    });

    if (!material) {
      return NextResponse.json({ error: 'Materiale non trovato' }, { status: 404 });
    }

    if (ctx.role === 'TEACHER') {
      const teacherId = await getTeacherIdForUser(ctx);
      if (!teacherId || material.lesson.teacherId !== teacherId) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    } else if (ctx.role === 'STUDENT') {
      const studentId = await getStudentIdForUser(ctx);
      if (!studentId) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
      const enrollment = await prisma.studentClass.findFirst({
        where: { studentId, classId: material.lesson.classId, isActive: true },
      });
      if (!enrollment) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    } else if (ctx.role === 'PARENT') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get('download') === '1') {
      return serveMaterialFile(material.url, material.name, material.mimeType);
    }

    return NextResponse.json(material);
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Lesson material GET error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// PATCH /api/lessons/[id]/materials/[materialId] — rename/descrizione
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const ctx = await requireAuth({
      roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'TEACHER'],
    });
    const { id, materialId } = await params;

    const { material, response } = await loadForWrite(ctx, id, materialId);
    if (!material) return response!;

    const body = await request.json();
    const data = patchSchema.parse(body);

    const updated = await prisma.material.update({
      where: { id: materialId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Lesson material PATCH error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// DELETE /api/lessons/[id]/materials/[materialId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const ctx = await requireAuth({
      roles: ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'TEACHER'],
    });
    const { id, materialId } = await params;

    const { material, response } = await loadForWrite(ctx, id, materialId);
    if (!material) return response!;

    await prisma.material.delete({ where: { id: materialId } });

    // SECURITY: url validato prima di toccare il filesystem (no traversal)
    const filePath = resolveSafeUploadPath(material.url);
    if (filePath) {
      try {
        await unlink(filePath);
      } catch {
        // file già assente: il record è comunque eliminato
      }
    }

    return NextResponse.json({ message: 'Materiale eliminato con successo' });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Lesson material DELETE error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
