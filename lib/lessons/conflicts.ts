import { prisma } from '@/lib/db';

export type LessonConflict =
  | { kind: 'teacher'; lessonId: string; teacherId: string }
  | { kind: 'room'; lessonId: string; room: string };

/**
 * Find lessons that overlap with the proposed time window.
 *
 * Overlap formula: two intervals [s1, e1) and [s2, e2) overlap iff
 *   s1 < e2 AND s2 < e1
 *
 * The previous implementation in lessons/route.ts used two AND-clauses that
 * missed the case where the new lesson fully contains an existing one
 * (and vice versa). This helper covers all cases.
 *
 * Room collision is checked only when `room` is provided and non-empty.
 */
export async function findLessonConflicts(params: {
  tenantId: string;
  teacherId: string;
  room?: string | null;
  startTime: Date;
  endTime: Date;
  /** Lesson id to exclude (e.g. when updating). */
  excludeLessonId?: string;
  /**
   * Più lezioni da escludere dai confronti (es. update di un'intera serie
   * ricorrente: ogni occorrenza viene spostata, quindi i vecchi slot della
   * serie non devono generare falsi conflitti). Cumulativo con excludeLessonId.
   */
  excludeLessonIds?: string[];
}): Promise<LessonConflict[]> {
  const { tenantId, teacherId, room, startTime, endTime, excludeLessonId, excludeLessonIds } = params;

  // Unione degli id esclusi (singolo + array) per retrocompatibilità con i caller esistenti
  const excludedIds = [
    ...(excludeLessonId ? [excludeLessonId] : []),
    ...(excludeLessonIds ?? []),
  ];

  const overlapWhere = {
    tenantId,
    startTime: { lt: endTime },
    endTime: { gt: startTime },
    status: { notIn: ['CANCELLED' as const] },
    ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
  };

  const conflicts: LessonConflict[] = [];

  const teacherClash = await prisma.lesson.findFirst({
    where: { ...overlapWhere, teacherId },
    select: { id: true, teacherId: true },
  });
  if (teacherClash) {
    conflicts.push({ kind: 'teacher', lessonId: teacherClash.id, teacherId: teacherClash.teacherId });
  }

  if (room && room.trim()) {
    const roomClash = await prisma.lesson.findFirst({
      where: { ...overlapWhere, room: room.trim() },
      select: { id: true, room: true },
    });
    if (roomClash && roomClash.room) {
      conflicts.push({ kind: 'room', lessonId: roomClash.id, room: roomClash.room });
    }
  }

  return conflicts;
}

export function conflictMessage(conflicts: LessonConflict[]): string {
  const parts: string[] = [];
  if (conflicts.some((c) => c.kind === 'teacher')) {
    parts.push('Il docente ha già una lezione in questo orario');
  }
  if (conflicts.some((c) => c.kind === 'room')) {
    parts.push('L\'aula è già occupata in questo orario');
  }
  return parts.join('. ');
}
