/**
 * Smart Scheduling Solver
 *
 * Algoritmo CSP (Constraint Satisfaction Problem) con backtracking
 * per la generazione automatica di orari scolastici
 */

import {
  ScheduleInput,
  ScheduleConfig,
  ScheduleResult,
  SolverState,
  LessonRequirement,
  AvailableSlot,
  SlotAssignment,
  GeneratedSlot,
  ScheduleStats,
  DEFAULT_CONFIG,
  createSlotKey,
} from './types';
import {
  checkAllHardConstraints,
  calculateSoftScore,
} from './constraints';
import { optimizeSolution } from './optimizer';

/**
 * Genera tutti i requisiti di lezione da piazzare
 * Se una materia ha 4 ore settimanali, genera 4 requisiti
 */
function generateRequirements(input: ScheduleInput): LessonRequirement[] {
  const requirements: LessonRequirement[] = [];
  let idCounter = 0;

  for (const assignment of input.assignments) {
    for (let i = 0; i < assignment.weeklyHours; i++) {
      requirements.push({
        id: `req-${idCounter++}`,
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId,
        index: i + 1,
      });
    }
  }

  return requirements;
}

/**
 * Genera tutti gli slot disponibili (giorni × ore)
 */
function generateAvailableSlots(input: ScheduleInput): AvailableSlot[] {
  const slots: AvailableSlot[] = [];

  for (const day of input.days) {
    for (const timeSlot of input.timeSlots) {
      if (!timeSlot.isBreak) {
        slots.push({
          dayOfWeek: day,
          slotNumber: timeSlot.slotNumber,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
        });
      }
    }
  }

  return slots;
}

/**
 * Inizializza lo stato del solver
 */
function initializeState(requirements: LessonRequirement[]): SolverState {
  return {
    assignments: new Map(),
    teacherSchedule: new Map(),
    classSchedule: new Map(),
    roomSchedule: new Map(),
    remainingRequirements: [...requirements],
    stats: {
      iterations: 0,
      backtracks: 0,
    },
  };
}

/**
 * Assegna una lezione a uno slot nello stato
 */
function assignSlot(
  state: SolverState,
  assignment: SlotAssignment
): void {
  const slotKey = createSlotKey(
    assignment.slot.dayOfWeek,
    assignment.slot.slotNumber
  );
  const classSlotKey = `${assignment.requirement.classId}-${slotKey}`;

  // Registra assegnazione
  state.assignments.set(classSlotKey, assignment);

  // Aggiorna schedule insegnante
  const teacherId = assignment.requirement.teacherId;
  if (!state.teacherSchedule.has(teacherId)) {
    state.teacherSchedule.set(teacherId, new Set());
  }
  state.teacherSchedule.get(teacherId)!.add(slotKey);

  // Aggiorna schedule classe
  const classId = assignment.requirement.classId;
  if (!state.classSchedule.has(classId)) {
    state.classSchedule.set(classId, new Set());
  }
  state.classSchedule.get(classId)!.add(slotKey);

  // Aggiorna schedule aula
  if (assignment.room) {
    if (!state.roomSchedule.has(assignment.room)) {
      state.roomSchedule.set(assignment.room, new Set());
    }
    state.roomSchedule.get(assignment.room)!.add(slotKey);
  }

  // Rimuovi dal remaining
  state.remainingRequirements = state.remainingRequirements.filter(
    r => r.id !== assignment.requirement.id
  );
}

/**
 * Rimuove un'assegnazione (backtracking)
 */
function unassignSlot(
  state: SolverState,
  assignment: SlotAssignment
): void {
  const slotKey = createSlotKey(
    assignment.slot.dayOfWeek,
    assignment.slot.slotNumber
  );
  const classSlotKey = `${assignment.requirement.classId}-${slotKey}`;

  // Rimuovi assegnazione
  state.assignments.delete(classSlotKey);

  // Aggiorna schedule insegnante
  state.teacherSchedule.get(assignment.requirement.teacherId)?.delete(slotKey);

  // Aggiorna schedule classe
  state.classSchedule.get(assignment.requirement.classId)?.delete(slotKey);

  // Aggiorna schedule aula
  if (assignment.room) {
    state.roomSchedule.get(assignment.room)?.delete(slotKey);
  }

  // Ri-aggiungi al remaining
  state.remainingRequirements.push(assignment.requirement);
}

/**
 * Seleziona il prossimo requisito usando euristica MRV
 * (Minimum Remaining Values - il più vincolato)
 */
function selectNextRequirement(
  state: SolverState,
  input: ScheduleInput,
  config: ScheduleConfig,
  availableSlots: AvailableSlot[]
): LessonRequirement | null {
  if (state.remainingRequirements.length === 0) return null;

  let bestRequirement: LessonRequirement | null = null;
  let minValidSlots = Infinity;

  for (const requirement of state.remainingRequirements) {
    // Conta slot validi per questo requisito
    let validCount = 0;

    for (const slot of availableSlots) {
      const { valid } = checkAllHardConstraints(
        input,
        config,
        state,
        requirement,
        slot
      );
      if (valid) validCount++;
    }

    // MRV: scegli quello con meno opzioni
    if (validCount < minValidSlots) {
      minValidSlots = validCount;
      bestRequirement = requirement;
    }

    // Se un requisito ha 0 slot validi, fail early
    if (validCount === 0) {
      return requirement; // Forza fallimento rapido
    }
  }

  return bestRequirement;
}

/**
 * Trova slot validi per un requisito, ordinati per punteggio soft
 */
function findValidSlots(
  state: SolverState,
  input: ScheduleInput,
  config: ScheduleConfig,
  requirement: LessonRequirement,
  availableSlots: AvailableSlot[]
): { slot: AvailableSlot; score: number }[] {
  const validSlots: { slot: AvailableSlot; score: number }[] = [];

  // Trova le ore settimanali per questa materia/classe
  const assignment = input.assignments.find(
    a =>
      a.classId === requirement.classId &&
      a.subjectId === requirement.subjectId
  );
  const weeklyHours = assignment?.weeklyHours || 1;

  for (const slot of availableSlots) {
    const { valid } = checkAllHardConstraints(
      input,
      config,
      state,
      requirement,
      slot
    );

    if (valid) {
      const score = calculateSoftScore(
        input,
        config,
        state,
        requirement,
        slot,
        weeklyHours
      );
      validSlots.push({ slot, score });
    }
  }

  // Ordina per punteggio decrescente (slot migliori prima)
  validSlots.sort((a, b) => b.score - a.score);

  return validSlots;
}

/**
 * Algoritmo principale: Backtracking con MRV
 */
function solve(
  state: SolverState,
  input: ScheduleInput,
  config: ScheduleConfig,
  availableSlots: AvailableSlot[],
  startTime: number
): boolean {
  // Check timeout
  if (Date.now() - startTime > config.algorithmParams.timeout) {
    return false;
  }

  // Check max iterations
  if (state.stats.iterations >= config.algorithmParams.maxIterations) {
    return false;
  }

  state.stats.iterations++;

  // Caso base: tutti i requisiti piazzati
  if (state.remainingRequirements.length === 0) {
    return true;
  }

  // Seleziona prossimo requisito (MRV)
  const requirement = selectNextRequirement(state, input, config, availableSlots);
  if (!requirement) return true; // Nessun requisito rimanente

  // Trova slot validi
  const validSlots = findValidSlots(
    state,
    input,
    config,
    requirement,
    availableSlots
  );

  // Se nessuno slot valido, backtrack
  if (validSlots.length === 0) {
    state.stats.backtracks++;
    return false;
  }

  // Prova ogni slot
  for (const { slot, score } of validSlots) {
    const assignment: SlotAssignment = {
      slot,
      requirement,
      score,
    };

    // Assegna
    assignSlot(state, assignment);

    // Ricorsione
    if (solve(state, input, config, availableSlots, startTime)) {
      return true;
    }

    // Backtrack
    unassignSlot(state, assignment);
    state.stats.backtracks++;
  }

  return false;
}

/**
 * Converte lo stato del solver in output finale
 */
function stateToGeneratedSlots(state: SolverState): GeneratedSlot[] {
  const slots: GeneratedSlot[] = [];

  state.assignments.forEach(assignment => {
    slots.push({
      dayOfWeek: assignment.slot.dayOfWeek,
      slotNumber: assignment.slot.slotNumber,
      startTime: assignment.slot.startTime,
      endTime: assignment.slot.endTime,
      classId: assignment.requirement.classId,
      subjectId: assignment.requirement.subjectId,
      teacherId: assignment.requirement.teacherId,
      room: assignment.room,
      score: assignment.score,
    });
  });

  return slots;
}

/**
 * Calcola punteggio totale dell'orario (0-100)
 */
function calculateTotalScore(slots: GeneratedSlot[], maxPossible: number): number {
  if (slots.length === 0) return 0;

  const totalScore = slots.reduce((sum, slot) => sum + (slot.score || 0), 0);

  // Normalizza a 0-100
  const normalized = (totalScore / maxPossible) * 100;

  return Math.max(0, Math.min(100, Math.round(normalized)));
}

/**
 * Valida l'input prima di procedere
 */
function validateInput(input: ScheduleInput): string[] {
  const errors: string[] = [];

  if (!input.classes || input.classes.length === 0) {
    errors.push('Nessuna classe definita');
  }

  if (!input.teachers || input.teachers.length === 0) {
    errors.push('Nessun insegnante definito');
  }

  if (!input.subjects || input.subjects.length === 0) {
    errors.push('Nessuna materia definita');
  }

  if (!input.assignments || input.assignments.length === 0) {
    errors.push('Nessuna assegnazione materia-classe-insegnante definita');
  }

  if (!input.timeSlots || input.timeSlots.length === 0) {
    errors.push('Nessuno slot orario definito');
  }

  if (!input.days || input.days.length === 0) {
    errors.push('Nessun giorno definito');
  }

  // Verifica che ogni assegnazione abbia dati validi
  for (const assignment of input.assignments || []) {
    const classExists = input.classes?.some(c => c.id === assignment.classId);
    const teacherExists = input.teachers?.some(t => t.id === assignment.teacherId);
    const subjectExists = input.subjects?.some(s => s.id === assignment.subjectId);

    if (!classExists) {
      errors.push(`Classe ${assignment.classId} non trovata`);
    }
    if (!teacherExists) {
      errors.push(`Insegnante ${assignment.teacherId} non trovato`);
    }
    if (!subjectExists) {
      errors.push(`Materia ${assignment.subjectId} non trovata`);
    }
  }

  // Verifica fattibilità: slot disponibili >= ore richieste per classe
  const hoursPerClass = new Map<string, number>();
  for (const assignment of input.assignments || []) {
    const current = hoursPerClass.get(assignment.classId) || 0;
    hoursPerClass.set(assignment.classId, current + assignment.weeklyHours);
  }

  const slotsPerWeek =
    (input.days?.length || 0) *
    (input.timeSlots?.filter(t => !t.isBreak).length || 0);

  hoursPerClass.forEach((hours, classId) => {
    if (hours > slotsPerWeek) {
      const className = input.classes?.find(c => c.id === classId)?.name || classId;
      errors.push(
        `Classe ${className}: ${hours} ore settimanali richieste ma solo ${slotsPerWeek} slot disponibili`
      );
    }
  });

  return errors;
}

/**
 * Entry point principale: genera l'orario
 */
export async function generateSchedule(
  input: ScheduleInput,
  config: ScheduleConfig = DEFAULT_CONFIG
): Promise<ScheduleResult> {
  const startTime = Date.now();

  // Valida input
  const errors = validateInput(input);
  if (errors.length > 0) {
    return {
      success: false,
      slots: [],
      score: 0,
      stats: {
        totalSlots: 0,
        slotsGenerated: 0,
        hardConstraintsSatisfied: 0,
        hardConstraintsTotal: 0,
        softConstraintsScore: 0,
        softConstraintsMaxScore: 0,
        generationTimeMs: Date.now() - startTime,
        optimizationTimeMs: 0,
        backtrackingSteps: 0,
      },
      errors,
    };
  }

  // Genera requisiti e slot disponibili
  const requirements = generateRequirements(input);
  const availableSlots = generateAvailableSlots(input);

  // Inizializza stato
  const state = initializeState(requirements);

  // Esegui solver
  const solved = solve(state, input, config, availableSlots, startTime);
  const generationTime = Date.now() - startTime;

  if (!solved) {
    // Prova con meno vincoli soft (fallback)
    const warnings: string[] = [];

    if (state.remainingRequirements.length > 0) {
      warnings.push(
        `Impossibile piazzare ${state.remainingRequirements.length} lezioni. ` +
          'Verifica che ci siano abbastanza slot e che gli insegnanti siano disponibili.'
      );
    }

    // Genera comunque risultato parziale
    let slots = stateToGeneratedSlots(state);

    return {
      success: false,
      slots,
      score: 0,
      stats: {
        totalSlots: requirements.length,
        slotsGenerated: slots.length,
        hardConstraintsSatisfied: slots.length,
        hardConstraintsTotal: requirements.length,
        softConstraintsScore: 0,
        softConstraintsMaxScore: requirements.length * 10,
        generationTimeMs: generationTime,
        optimizationTimeMs: 0,
        backtrackingSteps: state.stats.backtracks,
      },
      warnings,
    };
  }

  // Ottimizzazione con Hill Climbing
  const optimizationStart = Date.now();
  let optimizedSlots = stateToGeneratedSlots(state);

  if (config.algorithmParams.optimizationRounds > 0) {
    optimizedSlots = optimizeSolution(
      optimizedSlots,
      input,
      config,
      config.algorithmParams.optimizationRounds
    );
  }

  const optimizationTime = Date.now() - optimizationStart;

  // Calcola punteggio finale
  const maxScore = requirements.length * 10; // Max 10 punti per slot
  const totalScore = calculateTotalScore(optimizedSlots, maxScore);

  const stats: ScheduleStats = {
    totalSlots: requirements.length,
    slotsGenerated: optimizedSlots.length,
    hardConstraintsSatisfied: optimizedSlots.length,
    hardConstraintsTotal: requirements.length,
    softConstraintsScore: optimizedSlots.reduce((sum, s) => sum + (s.score || 0), 0),
    softConstraintsMaxScore: maxScore,
    generationTimeMs: generationTime,
    optimizationTimeMs: optimizationTime,
    backtrackingSteps: state.stats.backtracks,
  };

  return {
    success: true,
    slots: optimizedSlots,
    score: totalScore,
    stats,
  };
}
