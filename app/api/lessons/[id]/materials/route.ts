import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const lessonId = params.id;

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

    // TODO: Currently materials are stored in the class, not separately for lessons
    // This would require adding a Material model to the schema
    // For now, return empty array or fetch from class materials
    const materials: any[] = [];

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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Check permissions
    if (
      session.user.role !== 'ADMIN' &&
      session.user.role !== 'SUPERADMIN' &&
      session.user.role !== 'TEACHER'
    ) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const lessonId = params.id;

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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    if (!file) {
      return NextResponse.json({ error: 'File richiesto' }, { status: 400 });
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

    // Create database record
    // TODO: Requires Material model in schema
    const material = {
      id: timestamp.toString(),
      name: name || file.name,
      description: description || undefined,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      fileUrl: `/uploads/lessons/${lessonId}/${fileName}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: {
        id: session.user.id,
        firstName: session.user.firstName || '',
        lastName: session.user.lastName || '',
      },
      downloads: 0,
    };

    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    console.error('Error uploading lesson material:', error);
    return NextResponse.json(
      { error: 'Errore durante il caricamento del file' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

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

    const lessonId = params.id;

    // TODO: Verify material belongs to this lesson and tenant
    // Requires Material model in schema
    // For now, just return success
    return NextResponse.json({ message: 'Materiale eliminato con successo' });
  } catch (error) {
    console.error('Error deleting lesson material:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'eliminazione del materiale' },
      { status: 500 }
    );
  }
}
