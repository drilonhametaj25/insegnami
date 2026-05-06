import type { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isPackageLowOnHours } from '@/lib/hours-package-service';

type Tx = Prisma.TransactionClient | PrismaClient;

export type ConsumeResult = {
  consumed: boolean;
  reason?: 'already-consumed' | 'not-completed' | 'no-students' | 'no-active-package' | 'zero-duration';
  totalHoursDeducted?: number;
  studentsAffected?: number;
  lowPackageStudentIds?: string[];
};

/**
 * Deduct lesson hours from each enrolled student's active HoursPackage,
 * idempotently. Called when:
 *   - PUT /api/lessons/[id] flips status → COMPLETED
 *   - cron 'auto-complete-lessons' marks past SCHEDULED lessons COMPLETED
 *   - manual settle from /api/lessons/[id]/settle (future endpoint)
 *
 * Allocation rule: FIFO by HoursPackage.purchaseDate within the lesson's
 * course. If a single package can't cover the full duration we still
 * deduct what's available (remainingHours can go to 0 but never below).
 * The "low package" notification fires per student whose package crossed
 * the 20% threshold AFTER deduction.
 *
 * Idempotency: relies on Lesson.hoursConsumed boolean. The whole flow
 * runs in a transaction so the flag flip is atomic with the package
 * decrements — a crash mid-way doesn't half-consume.
 *
 * Concurrency: callers should NOT pass an outer tx if they want this
 * function to manage its own transaction. When you DO pass an outer tx
 * (e.g. PUT lessons handler), make sure the surrounding scope is short —
 * we lock multiple HoursPackage rows.
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

    const durationMs = lesson.endTime.getTime() - lesson.startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    if (durationHours <= 0) {
      // Mark consumed anyway so we don't keep retrying.
      await tx.lesson.update({ where: { id: lessonId }, data: { hoursConsumed: true } });
      return { consumed: false, reason: 'zero-duration' };
    }

    // Active enrolled students for this class.
    const enrolledStudents = await tx.studentClass.findMany({
      where: { classId: lesson.classId, isActive: true },
      select: { studentId: true },
    });
    if (enrolledStudents.length === 0) {
      await tx.lesson.update({ where: { id: lessonId }, data: { hoursConsumed: true } });
      return { consumed: false, reason: 'no-students' };
    }

    const courseId = lesson.class.courseId;
    const lowPackageStudentIds: string[] = [];
    let studentsAffected = 0;
    let totalHoursDeducted = 0;

    // Per-student: find FIFO packages and deduct.
    for (const { studentId } of enrolledStudents) {
      let remaining = durationHours;

      const packages = await tx.hoursPackage.findMany({
        where: {
          tenantId: lesson.tenantId,
          studentId,
          courseId,
          isActive: true,
          remainingHours: { gt: 0 },
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

        await tx.hoursPackage.update({
          where: { id: pkg.id },
          data: { remainingHours: new Decimal(newRemaining.toFixed(2)) },
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
      await prisma.$transaction(async (tx) => {
        await tx.lesson.update({
          where: { id, status: 'SCHEDULED' as any },
          data: { status: 'COMPLETED' },
        });
        markedCompleted += 1;
        const result = await consumeHoursForLesson(id, tx);
        if (result.consumed) consumed += 1;
      });
    } catch (err) {
      logger.warn(`autoCompletePastLessons: failed for ${id}`, err);
    }
  }

  logger.info(`autoCompletePastLessons: ${markedCompleted} → COMPLETED, ${consumed} consumed`);
  return { markedCompleted, consumed };
}
