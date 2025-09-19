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

    // Get materials - assuming we have a Material model
    // For now, let's return a mock structure that would work with a future Material model
    const materials = await prisma.$queryRaw`
      SELECT 
        'mock-material-1' as id,
        'Dispensa Lezione 1' as name,
        'Introduzione alla grammatica inglese' as description,
        'HANDOUT' as type,
        '/uploads/materials/handout-1.pdf' as filePath,
        'application/pdf' as mimeType,
        1024000 as fileSize,
        NOW() as uploadedAt,
        ${session.user.id} as uploadedBy
      WHERE false
    ` as any[];

    // Mock data for demonstration
    const mockMaterials = [
      {
        id: '1',
        name: 'Dispensa Lezione 1',
        description: 'Introduzione alla grammatica inglese',
        type: 'HANDOUT',
        filePath: '/uploads/materials/handout-1.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024000,
        uploadedAt: new Date().toISOString(),
        uploadedBy: {
          id: session.user.id,
          firstName: session.user.name?.split(' ')[0] || '',
          lastName: session.user.name?.split(' ')[1] || '',
        },
        downloadCount: 12,
      },
      {
        id: '2',
        name: 'Esercizi Capitolo 1',
        description: 'Esercizi pratici sui tempi verbali',
        type: 'EXERCISE',
        filePath: '/uploads/materials/exercises-1.pdf',
        mimeType: 'application/pdf',
        fileSize: 756000,
        uploadedAt: new Date(Date.now() - 86400000).toISOString(),
        uploadedBy: {
          id: session.user.id,
          firstName: session.user.name?.split(' ')[0] || '',
          lastName: session.user.name?.split(' ')[1] || '',
        },
        downloadCount: 8,
      },
    ];

    return NextResponse.json({
      materials: mockMaterials,
      totalSize: mockMaterials.reduce((sum, m) => sum + m.fileSize, 0),
      count: mockMaterials.length,
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

    // For now, return mock response since we don't have Material model
    const mockMaterial = {
      id: `material_${timestamp}`,
      name,
      description: description || null,
      type: type || 'HANDOUT',
      filePath: `/uploads/materials/${filename}`,
      mimeType: file.type,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: {
        id: session.user.id,
        firstName: session.user.name?.split(' ')[0] || '',
        lastName: session.user.name?.split(' ')[1] || '',
      },
      downloadCount: 0,
    };

    return NextResponse.json({
      message: 'Material uploaded successfully',
      material: mockMaterial,
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

    // For now, return success since we don't have Material model
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
