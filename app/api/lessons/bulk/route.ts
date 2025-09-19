import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body = await request.json();
    const { lessonIds, updates } = body;

    // Validazione input
    if (!lessonIds || !Array.isArray(lessonIds) || lessonIds.length === 0) {
      return NextResponse.json(
        { error: 'lessonIds deve essere un array non vuoto' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'updates è obbligatorio' },
        { status: 400 }
      );
    }

    // Get user's tenant
    const userTenant = await prisma.userTenant.findFirst({
      where: { userId: session.user.id }
    });

    if (!userTenant) {
      return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
    }

    // Verify all lessons exist and belong to tenant
    const existingLessons = await prisma.lesson.findMany({
      where: {
        id: { in: lessonIds },
        tenantId: userTenant.tenantId
      }
    });

    if (existingLessons.length !== lessonIds.length) {
      return NextResponse.json(
        { error: 'Alcune lezioni non sono state trovate' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (updates.title) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.room !== undefined) updateData.room = updates.room;
    if (updates.status) updateData.status = updates.status;
    
    // Handle time updates
    if (updates.startTime) updateData.startTime = new Date(updates.startTime);
    if (updates.endTime) updateData.endTime = new Date(updates.endTime);

    // Perform bulk update
    const result = await prisma.lesson.updateMany({
      where: {
        id: { in: lessonIds },
        tenantId: userTenant.tenantId
      },
      data: updateData
    });

    return NextResponse.json({ 
      updated: result.count,
      message: `${result.count} lezioni aggiornate con successo` 
    });

  } catch (error) {
    console.error('Errore nell\'aggiornamento bulk lezioni:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body = await request.json();
    const { lessonIds } = body;

    // Validazione input
    if (!lessonIds || !Array.isArray(lessonIds) || lessonIds.length === 0) {
      return NextResponse.json(
        { error: 'lessonIds deve essere un array non vuoto' },
        { status: 400 }
      );
    }

    // Get user's tenant
    const userTenant = await prisma.userTenant.findFirst({
      where: { userId: session.user.id }
    });

    if (!userTenant) {
      return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
    }

    // Check user permissions (only ADMIN can bulk delete)
    if (userTenant.role !== 'ADMIN' && userTenant.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Permessi insufficienti' },
        { status: 403 }
      );
    }

    // Delete related attendance records first
    await prisma.attendance.deleteMany({
      where: {
        lessonId: { in: lessonIds }
      }
    });

    // Perform bulk delete
    const result = await prisma.lesson.deleteMany({
      where: {
        id: { in: lessonIds },
        tenantId: userTenant.tenantId
      }
    });

    return NextResponse.json({ 
      deleted: result.count,
      message: `${result.count} lezioni eliminate con successo` 
    });

  } catch (error) {
    console.error('Errore nell\'eliminazione bulk lezioni:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
