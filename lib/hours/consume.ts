import type { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isPackageLowOnHours } from '@/lib/hours-package-service';

type Tx = Prisma.TransactionClient | PrismaClient;

export type ConsumeResult = {
  consumed: boolean;
  reason?: 'already-consumed' | 'not-completed' | 'no-students' | 'no-active-package' | 'zero-duration' | 'no-attendees';
  totalHoursDeducted?: number;
  studentsAffected?: number;
  lowPackageStudentIds?: string[];
  courseId?: string;
  tenantId?: string;
};

export type RefundResult = {
  refunded: boolean;
  totalHoursRestored: number;
  packagesAffected: number;
};

/**
 * Deduct lesson hours from the attending students' active HoursPackages,
 * idempotently. Called when:
 *   - PUT /api/lessons/[id] flips status → COMPLETED
 *   - cron 'auto-complete-lessons' marks past SCHEDULED lessons COMPLETED
 *
 * Regole (rev. contabilità):
 *   - consumo SOLO per studenti con Attendance PRESENT o LATE nella lezione
 *     (chi è assente non erode il pacchetto);
 *   - i pacchetti scaduti (expiryDate <= inizio lezione) sono esclusi;
 *   - allocazione FIFO per purchaseDate; un pacchetto che arriva a 0 ore
 *     residue viene disattivato (isActive: false);
 *   - ogni erosione scrive una riga HoursLedger (packageId+lessonId unique:
 *     idempotenza hard — un eventuale P2002 è trattato come no-op);
 *   - la notifica "low hours" NON parte da qui: i chiamanti usano
 *     lowPackageStudentIds col modulo lib/hours/notify.ts.
 *
 * Idempotency: Lesson.hoursConsumed + vincolo unique del ledger. The whole
 * flow runs in a transaction so flag flip + decrements + ledger are atomic.
 */
export async function consumeHoursForLesson(
  lessonId: string,
  outerTx?: Tx,
): Promise<ConsumeResult> {
  const run = async (tx: Tx): Promise<ConsumeResult> => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true, tenantId: true, classId: true, status: true,
        startTime: true, endTime: true, hoursConsumed: true,
        class: { select: { courseId: true } },
      } as any,
    }) as any;
    if (!lesson) return { consumed: false, reason: 'not-completed' };
    if (lesson.hoursConsumed) return { consumed: false, reason: 'already-consumed' };
    if (lesson.status !== 'COMPLETED') return { consumed: false, reason: 'not-completed' };

    const courseId = lesson.class.courseId;
    const baseInfo = { courseId, tenantId: lesson.tenantId };

    const durationMs = lesson.endTime.getTime() - lesson.startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    if (durationHours <= 0) {
      // Mark consumed anyway so we don't keep retrying.
      await tx.lesson.update({ where: { id: lessonId }, data: { hoursConsumed: true } });
      return { consumed: false, reason: 'zero-duration', ...baseInfo };
    }

    // Solo chi ha effettivamente frequentato consuma ore: PRESENT o LATE.
    const attendees = await tx.attendance.findMany({
      where: { lessonId, status: { in: ['PRESENT', 'LATE'] } },
      select: { studentId: true },
    });
    if (attendees.length === 0) {
      await tx.lesson.update({ where: { id: lessonId }, data: { hoursConsumed: true } });
      return { consumed: false, reason: 'no-attendees', ...baseInfo };
    }

    const lowPackageStudentIds: string[] = [];
    let studentsAffected = 0;
    let totalHoursDeducted = 0;

    // Per-student: find FIFO packages and deduct.
    for (const { studentId } of attendees) {
      let remaining = durationHours;

      const packages = await tx.hoursPackage.findMany({
        where: {
          tenantId: lesson.tenantId,
          studentId,
          courseId,
          isActive: true,
          remainingHours: { gt: 0 },
          // Pacchetti scaduti esclusi (riferimento: inizio lezione)
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: lesson.startTime } },
          ],
        },
        orderBy: { purchaseDate: 'asc' },
        select: { id: true, remainingHours: true, totalHours: true },
      });

      if (packages.length === 0) {
        // Student has no active package on this course — common in schools
        // that don't sell packages at all. Skip silently.
        continue;
      }

      let studentDeducted = 0;
      for (const pkg of packages) {
        if (remaining <= 0) break;
        const available = Number(pkg.remainingHours);
        const take = Math.min(available, remaining);
        const newRemaining = available - take;

        // Ledger prima del decremento: la unique (packageId, lessonId) è
        // l'idempotenza hard. Un P2002 = consumo già registrato → no-op.
        try {
          await tx.hoursLedger.create({
            data: {
              tenantId: lesson.tenantId,
              packageId: pkg.id,
              lessonId,
              studentId,
              hours: new Decimal(take.toFixed(2)),
            },
          });
        } catch (err: any) {
          if (err?.code === 'P2002') continue;
          throw err;
        }

        await tx.hoursPackage.update({
          where: { id: pkg.id },
          data: {
            remainingHours: new Decimal(newRemaining.toFixed(2)),
            // Pacchetto esaurito → disattivato
            isActive: newRemaining > 0,
          },
        });

        studentDeducted += take;
        remaining -= take;

        if (isPackageLowOnHours(newRemaining, Number(pkg.totalHours))) {
          lowPackageStudentIds.push(studentId);
        }
      }

      if (studentDeducted > 0) {
        studentsAffected += 1;
        totalHoursDeducted += studentDeducted;
      }
    }

    // Even if no student had a package, mark consumed: the lesson is
    // settled and re-running shouldn't re-scan for free.
    await tx.lesson.update({
      where: { id: lessonId },
      data: { hoursConsumed: true },
    });

    return {
      consumed: true,
      totalHoursDeducted: Math.round(totalHoursDeducted * 100) / 100,
      studentsAffected,
      lowPackageStudentIds: Array.from(new Set(lowPackageStudentIds)),
      ...baseInfo,
    };
  };

  if (outerTx) return run(outerTx);
  return prisma.$transaction(run, { timeout: 15_000 });
}

/**
 * Storno del consumo ore quando una lezione COMPLETED viene CANCELLED:
 * ripristina remainingHours dei pacchetti leggendo il ledger, riattiva i
 * pacchetti eventualmente disattivati, cancella le righe ledger e azzera
 * Lesson.hoursConsumed. Idempotente (nessuna riga ledger → no-op).
 */
export async function refundHoursForLesson(
  lessonId: string,
  outerTx?: Tx,
): Promise<RefundResult> {
  const run = async (tx: Tx): Promise<RefundResult> => {
    const entries = await tx.hoursLedger.findMany({
      where: { lessonId },
      select: { id: true, packageId: true, hours: true },
    });

    let totalHoursRestored = 0;
    for (const entry of entries) {
      const hours = Number(entry.hours);
      const pkg = await tx.hoursPackage.findUnique({
        where: { id: entry.packageId },
        select: { remainingHours: true },
      });
      if (!pkg) continue; // pacchetto cancellato nel frattempo: niente da ripristinare
      const restored = Number(pkg.remainingHours) + hours;
      await tx.hoursPackage.update({
        where: { id: entry.packageId },
        data: {
          remainingHours: new Decimal(restored.toFixed(2)),
          isActive: true,
        },
      });
      totalHoursRestored += hours;
    }

    if (entries.length > 0) {
      await tx.hoursLedger.deleteMany({ where: { lessonId } });
    }

    await tx.lesson.update({
      where: { id: lessonId },
      data: { hoursConsumed: false },
    });

    return {
      refunded: entries.length > 0,
      totalHoursRestored: Math.round(totalHoursRestored * 100) / 100,
      packagesAffected: entries.length,
    };
  };

  if (outerTx) return run(outerTx);
  return prisma.$transaction(run, { timeout: 15_000 });
}

/**
 * Cron-target: mark past SCHEDULED lessons as COMPLETED and consume hours.
 * Bounded: only lessons whose endTime is older than `graceMinutes` (default
 * 30) are affected, so a teacher who's late to update doesn't get
 * pre-empted by the cron during the lesson itself.
 */
export async function autoCompletePastLessons(graceMinutes = 30): Promise<{ markedCompleted: number; consumed: number }> {
  const cutoff = new Date(Date.now() - graceMinutes * 60_000);
  const candidates = await prisma.lesson.findMany({
    where: { status: 'SCHEDULED', endTime: { lt: cutoff } },
    select: { id: true },
    take: 500, // safety cap per run
  });

  let markedCompleted = 0;
  let consumed = 0;
  for (const { id } of candidates) {
    try {
      let result: ConsumeResult | null = null;
      await prisma.$transaction(async (tx) => {
        await tx.lesson.update({
          where: { id, status: 'SCHEDULED' as any },
          data: { status: 'COMPLETED' },
        });
        markedCompleted += 1;
        result = await consumeHoursForLesson(id, tx);
        if (result.consumed) consumed += 1;
      });

      // Notifica low-hours FUORI dalla transazione (best-effort) usando
      // i lowPackageStudentIds restituiti dal consumo.
      const r = result as ConsumeResult | null;
      if (r?.consumed && r.lowPackageStudentIds && r.lowPackageStudentIds.length > 0 && r.tenantId && r.courseId) {
        try {
          const { notifyLowHoursStudents } = await import('@/lib/hours/notify');
          await notifyLowHoursStudents(r.tenantId, r.courseId, r.lowPackageStudentIds);
        } catch (err) {
          logger.warn(`autoCompletePastLessons: notifica low-hours fallita per ${id}`, err);
        }
      }
    } catch (err) {
      logger.warn(`autoCompletePastLessons: failed for ${id}`, err);
    }
  }

  logger.info(`autoCompletePastLessons: ${markedCompleted} → COMPLETED, ${consumed} consumed`);
  return { markedCompleted, consumed };
}
