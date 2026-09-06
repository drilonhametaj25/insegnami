import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { blockIfTenantInaccessible } from '@/lib/tenant-guard';
import { hasFeature } from '@/lib/billing/features';

// Gating di piano 'hoursPackages': 403 con code 'feature-not-in-plan' (la UI
// mostra l'upsell). SUPERADMIN esente. Fail-open su errori infra: un guasto
// Redis/DB nel check non deve spegnere il modulo per i tenant paganti.
async function hoursPackagesFeatureGate(session: {
  user: { role: string; tenantId: string };
}): Promise<NextResponse | null> {
  if (session.user.role === 'SUPERADMIN') return null;
  try {
    if (!(await hasFeature(session.user.tenantId, 'hoursPackages'))) {
      return NextResponse.json(
        { error: 'Funzionalità non inclusa nel tuo piano', code: 'feature-not-in-plan' },
        { status: 403 }
      );
    }
  } catch (featureError) {
    console.error('hoursPackages feature gate failed (fail-open):', featureError);
  }
  return null;
}

const hoursPackageSchema = z.object({
  studentId: z.string(),
  courseId: z.string(),
  totalHours: z.number().positive(),
  expiryDate: z.string().datetime().optional().nullable(),
  price: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // Only admins can create hours packages
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const featureBlocked = await hoursPackagesFeatureGate(session);
    if (featureBlocked) return featureBlocked;

    const body = await request.json();
    const validatedData = hoursPackageSchema.parse(body);

    // Verify student exists and belongs to tenant
    const student = await prisma.student.findFirst({
      where: {
        id: validatedData.studentId,
        tenantId: session.user.tenantId,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Studente non trovato' }, { status: 404 });
    }

    // Verify course exists and belongs to tenant
    const course = await prisma.course.findFirst({
      where: {
        id: validatedData.courseId,
        tenantId: session.user.tenantId,
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 });
    }

    // Create hours package
    const hoursPackage = await prisma.hoursPackage.create({
      data: {
        tenantId: session.user.tenantId,
        studentId: validatedData.studentId,
        courseId: validatedData.courseId,
        totalHours: new Decimal(validatedData.totalHours),
        remainingHours: new Decimal(validatedData.totalHours), // Initially all hours available
        expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : null,
        price: validatedData.price ? new Decimal(validatedData.price) : null,
        notes: validatedData.notes,
        isActive: true,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json(hoursPackage, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating hours package:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const blocked = await blockIfTenantInaccessible(session);
    if (blocked) return blocked;

    // La matrice non concede i pacchetti ore ai docenti
    if (session.user.role === 'TEACHER') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const featureBlocked = await hoursPackagesFeatureGate(session);
    if (featureBlocked) return featureBlocked;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const courseId = searchParams.get('courseId');
    const isActive = searchParams.get('isActive');

    // Build query filters
    const where: any = {
      tenantId: session.user.tenantId,
    };

    if (studentId) {
      where.studentId = studentId;
    }

    if (courseId) {
      where.courseId = courseId;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Students can only view their own packages
    if (session.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
        },
      });

      if (!student) {
        return NextResponse.json({ error: 'Studente non trovato' }, { status: 404 });
      }

      where.studentId = student.id;
    }

    // I genitori vedono solo i pacchetti dei figli (guardian + fallback legacy)
    if (session.user.role === 'PARENT') {
      where.student = {
        OR: [
          { parentUserId: session.user.id },
          { guardians: { some: { userId: session.user.id } } },
        ],
      };
    }

    const hoursPackages = await prisma.hoursPackage.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        purchaseDate: 'desc',
      },
    });

    return NextResponse.json(hoursPackages);
  } catch (error) {
    console.error('Error fetching hours packages:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
