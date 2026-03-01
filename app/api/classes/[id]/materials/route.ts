import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// GET /api/classes/[id]/materials - Get materials for a class
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify class exists and user has access
    const classWhere: any = { id };
    if (session.user.role !== 'SUPERADMIN') {
      classWhere.tenantId = session.user.tenantId;
    }

    // For students, verify they're enrolled in this class
    if (session.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: {
          email: session.user.email!,
          tenantId: session.user.tenantId,
        },
      });
      
      if (student) {
        const enrollment = await prisma.studentClass.findFirst({
          where: {
            studentId: student.id,
            classId: id,
            isActive: true,
          },
        });
        
        if (!enrollment) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // For teachers, verify they teach this class
    if (session.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email!,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher) {
        classWhere.teacherId = teacher.id;
      }
    }

    const classExists = await prisma.class.findFirst({
      where: classWhere,
    });

    if (!classExists) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Get materials from lessons of this class
    // Materials are tied to lessons, so we query through lessons
    const materials = await prisma.material.findMany({
      where: {
        tenantId: session.user.tenantId,
        lesson: {
          classId: id,
        },
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            startTime: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format materials for response
    const formattedMaterials = materials.map((material) => ({
      id: material.id,
      name: material.name,
      description: material.description,
      type: material.type,
      filePath: material.url,
      mimeType: material.mimeType,
      fileSize: material.size || 0,
      uploadedAt: material.createdAt.toISOString(),
      lesson: material.lesson ? {
        id: material.lesson.id,
        title: material.lesson.title,
        date: material.lesson.startTime,
      } : null,
    }));

    const totalSize = formattedMaterials.reduce((sum, m) => sum + (m.fileSize || 0), 0);

    return NextResponse.json({
      materials: formattedMaterials,
      totalSize,
      count: formattedMaterials.length,
    });

  } catch (error) {
    console.error('Materials GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/classes/[id]/materials - Upload new material
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only teachers and admins can upload materials
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Verify class exists and user has access
    const classWhere: any = { id };
    if (session.user.role !== 'SUPERADMIN') {
      classWhere.tenantId = session.user.tenantId;
    }

    // For teachers, verify they teach this class
    if (session.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: {
          email: session.user.email!,
          tenantId: session.user.tenantId,
        },
      });
      if (teacher) {
        classWhere.teacherId = teacher.id;
      }
    }

    const classExists = await prisma.class.findFirst({
      where: classWhere,
    });

    if (!classExists) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: 'Material name is required' }, { status: 400 });
    }

    // Validate file type and size
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'materials');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Generate unique filename
    const timestamp = Date.now();
    const cleanName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const extension = path.extname(file.name);
    const filename = `${timestamp}_${cleanName}${extension}`;
    const filePath = path.join(uploadsDir, filename);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Get a lesson from this class to attach the material to
    // Materials are tied to lessons in our schema
    const lessonId = formData.get('lessonId') as string;

    let targetLessonId = lessonId;

    // If no lessonId provided, get the most recent lesson for this class
    if (!targetLessonId) {
      const recentLesson = await prisma.lesson.findFirst({
        where: {
          classId: id,
          tenantId: session.user.tenantId,
        },
        orderBy: {
          startTime: 'desc',
        },
      });

      if (recentLesson) {
        targetLessonId = recentLesson.id;
      }
    }

    if (!targetLessonId) {
      // Create a placeholder lesson for materials if no lessons exist
      const newLesson = await prisma.lesson.create({
        data: {
          tenantId: session.user.tenantId,
          classId: id,
          teacherId: classExists.teacherId,
          title: 'Materiali di Classe',
          startTime: new Date(),
          endTime: new Date(Date.now() + 60 * 60 * 1000),
          status: 'COMPLETED',
        },
      });
      targetLessonId = newLesson.id;
    }

    // Create material in database
    const material = await prisma.material.create({
      data: {
        tenantId: session.user.tenantId,
        lessonId: targetLessonId,
        name,
        description: description || null,
        type: (type as any) || 'FILE',
        url: `/uploads/materials/${filename}`,
        mimeType: file.type,
        size: file.size,
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            startTime: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Material uploaded successfully',
      material: {
        id: material.id,
        name: material.name,
        description: material.description,
        type: material.type,
        filePath: material.url,
        mimeType: material.mimeType,
        fileSize: material.size,
        uploadedAt: material.createdAt.toISOString(),
        lesson: material.lesson ? {
          id: material.lesson.id,
          title: material.lesson.title,
          date: material.lesson.startTime,
        } : null,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Materials POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/classes/[id]/materials/[materialId] - Delete material
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only teachers and admins can delete materials
    if (!['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('materialId');

    if (!materialId) {
      return NextResponse.json({ error: 'Material ID required' }, { status: 400 });
    }

    // Find and verify material belongs to this class
    const material = await prisma.material.findFirst({
      where: {
        id: materialId,
        tenantId: session.user.tenantId,
        lesson: {
          classId: id,
        },
      },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Delete the material
    await prisma.material.delete({
      where: { id: materialId },
    });

    // Optionally delete the file from disk
    // Note: In production, you might want to soft delete or use cloud storage
    try {
      const fs = await import('fs/promises');
      const filePath = path.join(process.cwd(), 'public', material.url);
      await fs.unlink(filePath);
    } catch (err) {
      // File might not exist, that's okay
      console.warn('Could not delete file:', err);
    }

    return NextResponse.json({
      message: 'Material deleted successfully',
    });

  } catch (error) {
    console.error('Materials DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
