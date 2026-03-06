/**
 * Smart Scheduling Types
 *
 * Tipi TypeScript per l'algoritmo di generazione orario
 * basato su CSP (Constraint Satisfaction Problem)
 */

// ============ INPUT TYPES ============

export interface TimeSlot {
  slotNumber: number;
  startTime: string; // "08:00"
  endTime: string;   // "09:00"
  isBreak: boolean;
}

export interface ScheduleClass {
  id: string;
  name: string;
  year: number;
  section: string;
}

export interface ScheduleTeacher {
  id: string;
  firstName: string;
  lastName: string;
  maxHoursPerDay?: number;
  unavailableSlots?: UnavailableSlot[];
}

export interface UnavailableSlot {
  dayOfWeek: number;
  slotNumber: number;
}

export interface ScheduleSubject {
  id: string;
  name: string;
  difficulty?: 'LOW' | 'MEDIUM' | 'HIGH'; // Per soft constraint "materie difficili al mattino"
}

export interface ClassSubjectAssignment {
  classId: string;
  subjectId: string;
  teacherId: string;
  weeklyHours: number;
}

export interface ScheduleInput {
  tenantId: string;
  academicYearId: string;
  classes: ScheduleClass[];
  teachers: ScheduleTeacher[];
  subjects: ScheduleSubject[];
  assignments: ClassSubjectAssignment[]; // Chi insegna cosa a chi
  timeSlots: TimeSlot[];
  days: number[]; // [1,2,3,4,5] = Lun-Ven
  rooms?: string[];
  config: ScheduleConfig;
}

// ============ CONFIGURATION ============

export interface ScheduleConfig {
  // Hard constraints (sempre attivi)
  hardConstraints: {
    noTeacherOverlap: boolean;    // H1: Insegnante non in 2 posti
    noClassOverlap: boolean;      // H3: Classe non ha 2 lezioni
    noRoomOverlap: boolean;       // H2: Aula non doppia (se rooms definite)
    respectWeeklyHours: boolean;  // H4: Ore settimanali rispettate
  };

  // Soft constraints con peso (0-10)
  softConstraints: {
    difficultSubjectsInMorning: number;  // S1: Materie difficili prime ore
    noGaps: number;                       // S2: Evita buchi
    balancedDistribution: number;         // S3: Distribuzione equilibrata
    maxConsecutiveSameSubject: number;    // S4: Max ore consecutive
    lunchBreakPreference: number;         // S5: Preferenza pausa pranzo
    teacherLoadBalance: number;           // S6: Bilanciamento carico
  };

  // Parametri algoritmo
  algorithmParams: {
    maxIterations: number;        // Max iterazioni backtracking
    optimizationRounds: number;   // Round di ottimizzazione Hill Climbing
    timeout: number;              // Timeout in millisecondi
  };
}

export const DEFAULT_CONFIG: ScheduleConfig = {
  hardConstraints: {
    noTeacherOverlap: true,
    noClassOverlap: true,
    noRoomOverlap: true,
    respectWeeklyHours: true,
  },
  softConstraints: {
    difficultSubjectsInMorning: 8,
    noGaps: 7,
    balancedDistribution: 6,
    maxConsecutiveSameSubject: 5,
    lunchBreakPreference: 4,
    teacherLoadBalance: 3,
  },
  algorithmParams: {
    maxIterations: 100000,
    optimizationRounds: 1000,
    timeout: 30000, // 30 secondi
  },
};

// ============ INTERNAL TYPES ============

/**
 * Rappresenta una "richiesta" di lezione da piazzare
 * Se weeklyHours = 4, ci saranno 4 Requirement per quella materia/classe
 */
export interface LessonRequirement {
  id: string;           // Unique ID per questa richiesta
  classId: string;
  subjectId: string;
  teacherId: string;
  index: number;        // Quale ora settimanale (1, 2, 3, 4...)
}

/**
 * Uno slot temporale disponibile
 */
export interface AvailableSlot {
  dayOfWeek: number;    // 1-5
  slotNumber: number;   // 1-8
  startTime: string;
  endTime: string;
}

/**
 * Assegnazione di una lezione a uno slot
 */
export interface SlotAssignment {
  slot: AvailableSlot;
  requirement: LessonRequirement;
  room?: string;
  score?: number;       // Punteggio soft constraints
}

// ============ OUTPUT TYPES ============

export interface GeneratedSlot {
  dayOfWeek: number;
  slotNumber: number;
  startTime: string;
  endTime: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  room?: string;
  score?: number;
  warnings?: SlotWarning[];
}

export interface SlotWarning {
  type: 'SOFT_CONSTRAINT_VIOLATION' | 'SUBOPTIMAL' | 'INFO';
  message: string;
  constraint?: string;
}

export interface ScheduleResult {
  success: boolean;
  slots: GeneratedSlot[];
  score: number;         // Punteggio totale (0-100)
  stats: ScheduleStats;
  errors?: string[];
  warnings?: string[];
}

export interface ScheduleStats {
  totalSlots: number;
  slotsGenerated: number;
  hardConstraintsSatisfied: number;
  hardConstraintsTotal: number;
  softConstraintsScore: number;
  softConstraintsMaxScore: number;
  generationTimeMs: number;
  optimizationTimeMs: number;
  backtrackingSteps: number;
}

// ============ SOLVER STATE ============

export interface SolverState {
  assignments: Map<string, SlotAssignment>; // slotKey -> assignment
  teacherSchedule: Map<string, Set<string>>; // teacherId -> Set<slotKey>
  classSchedule: Map<string, Set<string>>;   // classId -> Set<slotKey>
  roomSchedule: Map<string, Set<string>>;    // room -> Set<slotKey>
  remainingRequirements: LessonRequirement[];
  stats: {
    iterations: number;
    backtracks: number;
  };
}

// Helper per creare chiave slot unica
export function createSlotKey(dayOfWeek: number, slotNumber: number): string {
  return `${dayOfWeek}-${slotNumber}`;
}

// Helper per parsare chiave slot
export function parseSlotKey(key: string): { dayOfWeek: number; slotNumber: number } {
  const [day, slot] = key.split('-').map(Number);
  return { dayOfWeek: day, slotNumber: slot };
}
