/**
 * Smart Scheduling Constraints
 *
 * Definizione dei vincoli hard e soft per l'algoritmo CSP
 */

import {
  ScheduleInput,
  ScheduleConfig,
  SolverState,
  LessonRequirement,
  AvailableSlot,
  SlotAssignment,
  createSlotKey,
} from './types';

// ============ HARD CONSTRAINTS ============
// Devono essere SEMPRE rispettati, altrimenti l'orario è invalido

/**
 * H1: No sovrapposizione insegnante
 * Un insegnante non può essere in due posti contemporaneamente
 */
export function checkTeacherOverlap(
  state: SolverState,
  requirement: LessonRequirement,
  slot: AvailableSlot
): boolean {
  const slotKey = createSlotKey(slot.dayOfWeek, slot.slotNumber);
  const teacherSlots = state.teacherSchedule.get(requirement.teacherId);

  if (!teacherSlots) return true; // Nessun conflitto

  return !teacherSlots.has(slotKey);
}

/**
 * H2: No sovrapposizione aula
 * Un'aula non può ospitare due lezioni contemporaneamente
 */
export function checkRoomOverlap(
  state: SolverState,
  room: string | undefined,
  slot: AvailableSlot
): boolean {
  if (!room) return true; // Nessuna aula specificata

  const slotKey = createSlotKey(slot.dayOfWeek, slot.slotNumber);
  const roomSlots = state.roomSchedule.get(room);

  if (!roomSlots) return true;

  return !roomSlots.has(slotKey);
}

/**
 * H3: No sovrapposizione classe
 * Una classe non può avere due lezioni contemporaneamente
 */
export function checkClassOverlap(
  state: SolverState,
  requirement: LessonRequirement,
  slot: AvailableSlot
): boolean {
  const slotKey = createSlotKey(slot.dayOfWeek, slot.slotNumber);
  const classSlots = state.classSchedule.get(requirement.classId);

  if (!classSlots) return true;

  return !classSlots.has(slotKey);
}

/**
 * H4: Verifica disponibilità insegnante
 * L'insegnante non ha dichiarato indisponibilità per quello slot
 */
export function checkTeacherAvailability(
  input: ScheduleInput,
  requirement: LessonRequirement,
  slot: AvailableSlot
): boolean {
  const teacher = input.teachers.find(t => t.id === requirement.teacherId);

  if (!teacher?.unavailableSlots) return true;

  return !teacher.unavailableSlots.some(
    unavailable =>
      unavailable.dayOfWeek === slot.dayOfWeek &&
      unavailable.slotNumber === slot.slotNumber
  );
}

/**
 * Verifica tutti i vincoli hard per un'assegnazione proposta
 */
export function checkAllHardConstraints(
  input: ScheduleInput,
  config: ScheduleConfig,
  state: SolverState,
  requirement: LessonRequirement,
  slot: AvailableSlot,
  room?: string
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // H1: No sovrapposizione insegnante
  if (config.hardConstraints.noTeacherOverlap) {
    if (!checkTeacherOverlap(state, requirement, slot)) {
      violations.push(`Insegnante già impegnato in questo slot`);
    }
  }

  // H2: No sovrapposizione aula
  if (config.hardConstraints.noRoomOverlap && room) {
    if (!checkRoomOverlap(state, room, slot)) {
      violations.push(`Aula già occupata in questo slot`);
    }
  }

  // H3: No sovrapposizione classe
  if (config.hardConstraints.noClassOverlap) {
    if (!checkClassOverlap(state, requirement, slot)) {
      violations.push(`Classe già ha lezione in questo slot`);
    }
  }

  // H4: Disponibilità insegnante
  if (!checkTeacherAvailability(input, requirement, slot)) {
    violations.push(`Insegnante non disponibile in questo slot`);
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

// ============ SOFT CONSTRAINTS ============
// Preferenze che migliorano la qualità dell'orario

/**
 * S1: Materie difficili al mattino
 * Matematica, Fisica, Latino nelle prime 3 ore
 */
export function scoreSubjectTiming(
  input: ScheduleInput,
  requirement: LessonRequirement,
  slot: AvailableSlot,
  weight: number
): number {
  if (weight === 0) return 0;

  const subject = input.subjects.find(s => s.id === requirement.subjectId);
  if (!subject?.difficulty) return 0;

  const isMorning = slot.slotNumber <= 3;
  const isAfternoon = slot.slotNumber >= 5;

  if (subject.difficulty === 'HIGH') {
    // Materie difficili: bonus se al mattino, penalità se al pomeriggio
    if (isMorning) return weight;
    if (isAfternoon) return -weight * 0.5;
    return 0;
  }

  if (subject.difficulty === 'LOW') {
    // Materie facili: leggero bonus se al pomeriggio
    if (isAfternoon) return weight * 0.3;
    return 0;
  }

  return 0;
}

/**
 * S2: No buchi nell'orario
 * Evitare ore vuote tra lezioni
 */
export function scoreNoGaps(
  state: SolverState,
  requirement: LessonRequirement,
  slot: AvailableSlot,
  weight: number,
  totalSlotsPerDay: number
): number {
  if (weight === 0) return 0;

  const classSlots = state.classSchedule.get(requirement.classId);
  if (!classSlots) return weight; // Prima lezione, va bene ovunque

  // Trova gli slot già assegnati per questa classe in questo giorno
  const daySlots: number[] = [];
  classSlots.forEach(key => {
    const [day, slotNum] = key.split('-').map(Number);
    if (day === slot.dayOfWeek) {
      daySlots.push(slotNum);
    }
  });

  if (daySlots.length === 0) return weight; // Prima lezione del giorno

  // Aggiungi lo slot proposto
  daySlots.push(slot.slotNumber);
  daySlots.sort((a, b) => a - b);

  // Calcola buchi
  let gaps = 0;
  for (let i = 1; i < daySlots.length; i++) {
    const diff = daySlots[i] - daySlots[i - 1];
    if (diff > 1) {
      gaps += diff - 1;
    }
  }

  // Penalità per ogni buco
  return weight - gaps * weight * 0.3;
}

/**
 * S3: Distribuzione equilibrata nella settimana
 * Evitare tutte le ore di una materia in un giorno
 */
export function scoreBalancedDistribution(
  state: SolverState,
  requirement: LessonRequirement,
  slot: AvailableSlot,
  weight: number,
  weeklyHours: number
): number {
  if (weight === 0) return 0;

  // Conta quante ore di questa materia sono già in questo giorno
  let hoursThisDay = 0;

  state.assignments.forEach(assignment => {
    if (
      assignment.requirement.classId === requirement.classId &&
      assignment.requirement.subjectId === requirement.subjectId &&
      assignment.slot.dayOfWeek === slot.dayOfWeek
    ) {
      hoursThisDay++;
    }
  });

  // Idealmente, distribuire equamente (es. 4 ore = max 1 al giorno)
  const idealPerDay = Math.ceil(weeklyHours / 5);

  if (hoursThisDay >= idealPerDay) {
    // Penalità se già troppe ore in questo giorno
    return -weight * (hoursThisDay - idealPerDay + 1) * 0.5;
  }

  return weight * 0.5; // Bonus per distribuzione equilibrata
}

/**
 * S4: Max ore consecutive stessa materia
 * Evitare 3+ ore di fila della stessa materia
 */
export function scoreConsecutiveHours(
  state: SolverState,
  requirement: LessonRequirement,
  slot: AvailableSlot,
  weight: number,
  maxConsecutive: number = 2
): number {
  if (weight === 0) return 0;

  // Conta ore consecutive
  let consecutive = 1; // Includiamo lo slot proposto

  // Controlla slot precedenti
  for (let i = slot.slotNumber - 1; i >= 1; i--) {
    const key = createSlotKey(slot.dayOfWeek, i);
    const assignment = state.assignments.get(key);

    if (
      assignment &&
      assignment.requirement.classId === requirement.classId &&
      assignment.requirement.subjectId === requirement.subjectId
    ) {
      consecutive++;
    } else {
      break;
    }
  }

  // Controlla slot successivi
  for (let i = slot.slotNumber + 1; i <= 8; i++) {
    const key = createSlotKey(slot.dayOfWeek, i);
    const assignment = state.assignments.get(key);

    if (
      assignment &&
      assignment.requirement.classId === requirement.classId &&
      assignment.requirement.subjectId === requirement.subjectId
    ) {
      consecutive++;
    } else {
      break;
    }
  }

  if (consecutive > maxConsecutive) {
    return -weight * (consecutive - maxConsecutive);
  }

  return weight * 0.3; // Piccolo bonus se non eccede
}

/**
 * S5: Preferenza pausa pranzo
 * Evitare lezioni nello slot 12:00-14:00 se possibile
 */
export function scoreLunchBreak(
  slot: AvailableSlot,
  weight: number,
  lunchSlots: number[] = [5, 6] // Slot 5 e 6 tipicamente = pranzo
): number {
  if (weight === 0) return 0;

  if (lunchSlots.includes(slot.slotNumber)) {
    return -weight * 0.5; // Piccola penalità per slot pranzo
  }

  return 0;
}

/**
 * S6: Bilanciamento carico insegnante
 * Distribuire equamente le ore nella settimana
 */
export function scoreTeacherLoadBalance(
  state: SolverState,
  input: ScheduleInput,
  requirement: LessonRequirement,
  slot: AvailableSlot,
  weight: number
): number {
  if (weight === 0) return 0;

  // Conta ore dell'insegnante per ogni giorno
  const hoursPerDay: number[] = [0, 0, 0, 0, 0]; // Lun-Ven

  state.assignments.forEach(assignment => {
    if (assignment.requirement.teacherId === requirement.teacherId) {
      hoursPerDay[assignment.slot.dayOfWeek - 1]++;
    }
  });

  // Aggiungi l'ora proposta
  hoursPerDay[slot.dayOfWeek - 1]++;

  // Calcola deviazione standard
  const mean = hoursPerDay.reduce((a, b) => a + b, 0) / 5;
  const variance =
    hoursPerDay.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / 5;
  const stdDev = Math.sqrt(variance);

  // Più bassa la deviazione, meglio è
  if (stdDev < 1) return weight;
  if (stdDev < 2) return weight * 0.5;
  return -weight * 0.3;
}

/**
 * Calcola punteggio totale soft constraints per un'assegnazione
 */
export function calculateSoftScore(
  input: ScheduleInput,
  config: ScheduleConfig,
  state: SolverState,
  requirement: LessonRequirement,
  slot: AvailableSlot,
  weeklyHours: number
): number {
  const weights = config.softConstraints;

  let score = 0;

  // S1: Materie difficili al mattino
  score += scoreSubjectTiming(
    input,
    requirement,
    slot,
    weights.difficultSubjectsInMorning
  );

  // S2: No buchi
  score += scoreNoGaps(
    state,
    requirement,
    slot,
    weights.noGaps,
    input.timeSlots.filter(t => !t.isBreak).length
  );

  // S3: Distribuzione equilibrata
  score += scoreBalancedDistribution(
    state,
    requirement,
    slot,
    weights.balancedDistribution,
    weeklyHours
  );

  // S4: Max ore consecutive
  score += scoreConsecutiveHours(
    state,
    requirement,
    slot,
    weights.maxConsecutiveSameSubject
  );

  // S5: Pausa pranzo
  score += scoreLunchBreak(slot, weights.lunchBreakPreference);

  // S6: Bilanciamento carico
  score += scoreTeacherLoadBalance(
    state,
    input,
    requirement,
    slot,
    weights.teacherLoadBalance
  );

  return score;
}
