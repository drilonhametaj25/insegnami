import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';

type Tx = Prisma.TransactionClient | PrismaClient;

export type TimesheetEntry = {
  lessonId: string;
  classId: string;
  className: string;
  startTime: Date;
  endTime: Date;
  hours: number;
};

export type Timesheet = {
  teacherId: string;
  periodStart: Date;
  periodEnd: Date;
  totalHours: number;
  entries: TimesheetEntry[];
};

/**
 * Aggregate teacher hours actually worked in a payroll period.
 *
 * Source of truth: Lesson rows with status=COMPLETED whose startTime falls
 * within the period window. Lessons with status=SCHEDULED/IN_PROGRESS/
 * CANCELLED are NOT counted — that prevents paying for a lesson that
 * never happened or whose actual duration we don't yet trust.
 *
 * Returns hour breakdown per lesson so the payroll generator can produce
 * a granular PayrollLineItem per HOURS row, and the cedolino PDF can show
 * which lessons sum to the gross base.
 */
export async function calculateTimesheet(
  tenantId: string,
  teacherId: string,
  periodStart: Date,
  periodEnd: Date,
  tx: Tx = prisma,
): Promise<Timesheet> {
  const lessons = await tx.lesson.findMany({
    where: {
      tenantId,
      teacherId,
      status: 'COMPLETED',
      startTime: { gte: periodStart, lte: periodEnd },
    },
    select: {
      id: true,
      classId: true,
      startTime: true,
      endTime: true,
      class: { select: { name: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  const entries: TimesheetEntry[] = lessons.map((l) => {
    const hours = Math.max(0, (l.endTime.getTime() - l.startTime.getTime()) / (1000 * 60 * 60));
    return {
      lessonId: l.id,
      classId: l.classId,
      className: l.class.name,
      startTime: l.startTime,
      endTime: l.endTime,
      hours: Math.round(hours * 100) / 100,
    };
  });

  const totalHours = Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100;

  return {
    teacherId,
    periodStart,
    periodEnd,
    totalHours,
    entries,
  };
}

/**
 * Period bounds for a (year, month). Month is 1-12. End is exclusive end
 * of last day at 23:59:59.999 UTC so timezone-agnostic queries don't
 * miss late-evening lessons.
 */
export function periodBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}
