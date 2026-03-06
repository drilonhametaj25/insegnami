/**
 * Smart Scheduling Module
 *
 * Generatore automatico di orari scolastici basato su CSP
 * (Constraint Satisfaction Problem)
 *
 * @example
 * ```typescript
 * import { generateSchedule, DEFAULT_CONFIG } from '@/lib/scheduling';
 *
 * const result = await generateSchedule({
 *   tenantId: 'tenant-1',
 *   academicYearId: 'year-1',
 *   classes: [...],
 *   teachers: [...],
 *   subjects: [...],
 *   assignments: [...],
 *   timeSlots: [...],
 *   days: [1, 2, 3, 4, 5],
 *   config: DEFAULT_CONFIG,
 * });
 *
 * if (result.success) {
 *   console.log(`Orario generato con score ${result.score}/100`);
 *   console.log(`${result.slots.length} lezioni piazzate`);
 * }
 * ```
 */

// Types
export type {
  TimeSlot,
  ScheduleClass,
  ScheduleTeacher,
  UnavailableSlot,
  ScheduleSubject,
  ClassSubjectAssignment,
  ScheduleInput,
  ScheduleConfig,
  LessonRequirement,
  AvailableSlot,
  SlotAssignment,
  GeneratedSlot,
  SlotWarning,
  ScheduleResult,
  ScheduleStats,
  SolverState,
} from './types';

// Constants
export { DEFAULT_CONFIG, createSlotKey, parseSlotKey } from './types';

// Main solver
export { generateSchedule } from './solver';

// Optimizer (for advanced usage)
export { optimizeSolution } from './optimizer';

// Constraints (for custom validation)
export {
  checkTeacherOverlap,
  checkRoomOverlap,
  checkClassOverlap,
  checkTeacherAvailability,
  checkAllHardConstraints,
  calculateSoftScore,
} from './constraints';
