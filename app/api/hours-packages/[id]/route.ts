import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can delete hours packages
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const { id } = await params;

    // Verify package exists and belongs to tenant
    const hoursPackage = await prisma.hoursPackage.findFirst({
      where: {
        id: id,
        tenantId: session.user.tenantId,
      },
    });

    if (!hoursPackage) {
      return NextResponse.json(
        { error: 'Pacchetto ore non trovato' },
        { status: 404 }
      );
    }

    // Delete the package
    await prisma.hoursPackage.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: 'Pacchetto ore eliminato con successo' });
  } catch (error) {
    console.error('Error deleting hours package:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
