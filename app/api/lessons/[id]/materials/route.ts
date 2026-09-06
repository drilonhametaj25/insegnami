import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { z } from 'zod';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { getTeacherIdForUser, getStudentIdForUser, type AuthContext } from '@/lib/api-auth';

// Schema for creating material from URL/link
const createMaterialSchema = z.object({
  name: z.string().min(1, 'Nome richiesto'),
  type: z.enum(['FILE', 'LINK', 'VIDEO', 'IMAGE', 'DOCUMENT', 'PRESENTATION']).default('LINK'),
  url: z.string().url('URL non valido'),
  description: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    const { id: lessonId } = await params;

    // Verify lesson access
    const lesson = await prisma.lesson.findUnique({
      where: {
        id: lessonId,
        tenantId: session.user.tenantId,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
    }

    // Check di ruolo: admin → tutto; TEACHER → solo le proprie lezioni;
    // STUDENT → solo se iscritto alla classe della lezione; PARENT → 403 (Wave 2).
    if (!['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'].includes(session.user.role)) {
      // SECURITY: Lesson.teacherId referenzia Teacher.id, NON User.id.
      const ctx = {
        userId: session.user.id ?? '',
        tenantId: session.user.tenantId,
        role: session.user.role,
        email: session.user.email ?? '',
        isSuperAdmin: false,
        session,
      } as AuthContext;

      if (session.user.role === 'TEACHER') {
        const tid = await getTeacherIdForUser(ctx);
        if (!tid || lesson.teacherId !== tid) {
          return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
        }
      } else if (session.user.role === 'STUDENT') {
        const sid = await getStudentIdForUser(ctx);
        if (!sid) {
          return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
        }
        const enrollment = await prisma.studentClass.findFirst({
          where: {
            studentId: sid,
            classId: lesson.classId,
            isActive: true,
          },
        });
        if (!enrollment) {
          return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
    }

    // Fetch materials from database
    const materials = await prisma.material.findMany({
      where: {
        lessonId: lessonId,
        tenantId: session.user.tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ materials });
  } catch (error) {
    console.error('Error fetching lesson materials:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Check permissions
    if (
      session.user.role !== 'ADMIN' &&
      session.user.role !== 'SUPERADMIN' &&
      session.user.role !== 'TEACHER'
    ) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const { id: lessonId } = await params;

    // Verify lesson exists and user has access
    const lesson = await prisma.lesson.findUnique({
      where: {
        id: lessonId,
        tenantId: session.user.tenantId,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lezione non trovata' }, { status: 404 });
    }

    // I teacher possono caricare materiali solo sulle proprie lezioni.
    // SECURITY: Lesson.teacherId referenzia Teacher.id, NON User.id —
    // stesso pattern del PUT di lessons/[id]/route.ts.
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
      if (!tid || lesson.teacherId !== tid) {
        return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
      }
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle file upload (multipart/form-data)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;

      if (!file) {
        return NextResponse.json({ error: 'File richiesto' }, { status: 400 });
      }

      // Validazione type/size del file (stessa whitelist del POST di
      // classes/[id]/materials) PRIMA di scrivere su disco.
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'text/plain',
      ];

      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Tipo di file non consentito' }, { status: 400 });
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return NextResponse.json({ error: 'File troppo grande (max 10MB)' }, { status: 400 });
      }

      // Enforcement quota storage del piano PRIMA di scrivere su disco:
      // usato + nuovo file deve stare nel limite effettivo (null = illimitato).
      const { getEffectiveLimits, getStorageUsedBytes } = await import('@/lib/billing/limits');
      const limits = await getEffectiveLimits(session.user.tenantId);
      if (limits.storageBytes != null) {
        const usedBytes = await getStorageUsedBytes(session.user.tenantId);
        if (usedBytes + file.size > limits.storageBytes) {
          return NextResponse.json(
            {
              error: 'Spazio di archiviazione del piano esaurito. Acquista un add-on storage o effettua l\'upgrade del piano.',
              code: 'storage-limit',
              usedBytes,
              limitBytes: limits.storageBytes,
            },
            { status: 402 }
          );
        }
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'lessons', lessonId);
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${timestamp}.${fileExt}`;
      const filePath = join(uploadsDir, fileName);

      // Write file to disk
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      // Determine material type based on file mime type
      let materialType: 'FILE' | 'LINK' | 'VIDEO' | 'IMAGE' | 'DOCUMENT' | 'PRESENTATION' = 'FILE';
      if (file.type.startsWith('image/')) {
        materialType = 'IMAGE';
      } else if (file.type.startsWith('video/')) {
        materialType = 'VIDEO';
      } else if (file.type.includes('pdf') || file.type.includes('document') || file.type.includes('word')) {
        materialType = 'DOCUMENT';
      } else if (file.type.includes('presentation') || file.type.includes('powerpoint')) {
        materialType = 'PRESENTATION';
      }

      // Create database record
      const material = await prisma.material.create({
        data: {
          tenantId: session.user.tenantId,
          lessonId: lessonId,
          name: name || file.name,
          type: materialType,
          url: `/uploads/lessons/${lessonId}/${fileName}`,
          size: file.size,
          mimeType: file.type,
          description: description || undefined,
        },
      });

      return NextResponse.json(material, { status: 201 });
    }

    // Handle JSON request (for links/URLs)
    const body = await request.json();
    const validatedData = createMaterialSchema.parse(body);

    const material = await prisma.material.create({
      data: {
        tenantId: session.user.tenantId,
        lessonId: lessonId,
        name: validatedData.name,
        type: validatedData.type,
        url: validatedData.url,
        description: validatedData.description,
      },
    });

    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    console.error('Error uploading lesson material:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Errore durante il caricamento del file' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Check permissions
    if (
      session.user.role !== 'ADMIN' &&
      session.user.role !== 'SUPERADMIN' &&
      session.user.role !== 'TEACHER'
    ) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('materialId');

    if (!materialId) {
      return NextResponse.json({ error: 'ID materiale richiesto' }, { status: 400 });
    }

    const { id: lessonId } = await params;

    // Find material and verify ownership
    const material = await prisma.material.findFirst({
      where: {
        id: materialId,
        lessonId: lessonId,
        tenantId: session.user.tenantId,
      },
    });

    if (!material) {
      return NextResponse.json({ error: 'Materiale non trovato' }, { status: 404 });
    }

    // SECURITY: validate the URL before touching the filesystem.
    // resolveSafeUploadPath rejects path-traversal payloads (e.g.
    // "/uploads/../../../.env") that would otherwise let an admin unlink
    // arbitrary files via Material.url.
    const { resolveSafeUploadPath } = await import('@/lib/uploads/safe-path');
    const filePath = resolveSafeUploadPath(material.url);
    if (filePath && existsSync(filePath)) {
      try {
        await unlink(filePath);
      } catch (fileError) {
        console.error('Error deleting file:', fileError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await prisma.material.delete({
      where: {
        id: materialId,
      },
    });

    return NextResponse.json({ message: 'Materiale eliminato con successo' });
  } catch (error) {
    console.error('Error deleting lesson material:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'eliminazione del materiale' },
      { status: 500 }
    );
  }
}
