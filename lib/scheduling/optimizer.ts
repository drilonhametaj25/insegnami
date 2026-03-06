/**
 * Smart Scheduling Optimizer
 *
 * Algoritmo Hill Climbing per ottimizzare i soft constraints
 * dopo che il solver CSP ha trovato una soluzione valida
 */

import {
  ScheduleInput,
  ScheduleConfig,
  GeneratedSlot,
  SolverState,
  LessonRequirement,
  AvailableSlot,
  SlotAssignment,
  createSlotKey,
} from './types';
import { checkAllHardConstraints, calculateSoftScore } from './constraints';

/**
 * Ricostruisce lo stato del solver dai GeneratedSlots
 */
function rebuildState(slots: GeneratedSlot[]): SolverState {
  const state: SolverState = {
    assignments: new Map(),
    teacherSchedule: new Map(),
    classSchedule: new Map(),
    roomSchedule: new Map(),
    remainingRequirements: [],
    stats: { iterations: 0, backtracks: 0 },
  };

  for (const slot of slots) {
    const slotKey = createSlotKey(slot.dayOfWeek, slot.slotNumber);
    const classSlotKey = `${slot.classId}-${slotKey}`;

    const requirement: LessonRequirement = {
      id: classSlotKey,
      classId: slot.classId,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
      index: 0,
    };

    const availableSlot: AvailableSlot = {
      dayOfWeek: slot.dayOfWeek,
      slotNumber: slot.slotNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };

    const assignment: SlotAssignment = {
      slot: availableSlot,
      requirement,
      room: slot.room,
      score: slot.score,
    };

    state.assignments.set(classSlotKey, assignment);

    // Teacher schedule
    if (!state.teacherSchedule.has(slot.teacherId)) {
      state.teacherSchedule.set(slot.teacherId, new Set());
    }
    state.teacherSchedule.get(slot.teacherId)!.add(slotKey);

    // Class schedule
    if (!state.classSchedule.has(slot.classId)) {
      state.classSchedule.set(slot.classId, new Set());
    }
    state.classSchedule.get(slot.classId)!.add(slotKey);

    // Room schedule
    if (slot.room) {
      if (!state.roomSchedule.has(slot.room)) {
        state.roomSchedule.set(slot.room, new Set());
      }
      state.roomSchedule.get(slot.room)!.add(slotKey);
    }
  }

  return state;
}

/**
 * Calcola il punteggio totale di una soluzione
 */
function calculateTotalScore(slots: GeneratedSlot[]): number {
  return slots.reduce((sum, slot) => sum + (slot.score || 0), 0);
}

/**
 * Trova due slot che possono essere scambiati
 * Restituisce null se lo swap non è valido
 */
function findSwappableSlots(
  slots: GeneratedSlot[],
  input: ScheduleInput,
  config: ScheduleConfig
): [number, number] | null {
  const n = slots.length;
  if (n < 2) return null;

  // Seleziona due indici random
  const i = Math.floor(Math.random() * n);
  let j = Math.floor(Math.random() * n);

  // Assicurati che siano diversi
  while (j === i) {
    j = Math.floor(Math.random() * n);
  }

  const slot1 = slots[i];
  const slot2 = slots[j];

  // Non scambiare se sono della stessa classe (non ha senso)
  if (slot1.classId === slot2.classId) {
    return null;
  }

  return [i, j];
}

/**
 * Verifica se uno swap è valido (rispetta hard constraints)
 */
function canSwap(
  slots: GeneratedSlot[],
  i: number,
  j: number,
  input: ScheduleInput,
  config: ScheduleConfig
): boolean {
  const slot1 = slots[i];
  const slot2 = slots[j];

  // Crea copie con posizioni scambiate
  const newSlot1: GeneratedSlot = {
    ...slot1,
    dayOfWeek: slot2.dayOfWeek,
    slotNumber: slot2.slotNumber,
    startTime: slot2.startTime,
    endTime: slot2.endTime,
  };

  const newSlot2: GeneratedSlot = {
    ...slot2,
    dayOfWeek: slot1.dayOfWeek,
    slotNumber: slot1.slotNumber,
    startTime: slot1.startTime,
    endTime: slot1.endTime,
  };

  // Ricostruisci stato senza i due slot
  const tempSlots = slots.filter((_, idx) => idx !== i && idx !== j);
  const state = rebuildState(tempSlots);

  // Verifica slot1 nella nuova posizione
  const req1: LessonRequirement = {
    id: 'temp1',
    classId: newSlot1.classId,
    subjectId: newSlot1.subjectId,
    teacherId: newSlot1.teacherId,
    index: 0,
  };

  const avail1: AvailableSlot = {
    dayOfWeek: newSlot1.dayOfWeek,
    slotNumber: newSlot1.slotNumber,
    startTime: newSlot1.startTime,
    endTime: newSlot1.endTime,
  };

  const check1 = checkAllHardConstraints(
    input,
    config,
    state,
    req1,
    avail1,
    newSlot1.room
  );

  if (!check1.valid) return false;

  // Aggiungi temporaneamente slot1 per verificare slot2
  const slotKey1 = createSlotKey(avail1.dayOfWeek, avail1.slotNumber);
  state.teacherSchedule.get(req1.teacherId)?.add(slotKey1) ||
    state.teacherSchedule.set(req1.teacherId, new Set([slotKey1]));
  state.classSchedule.get(req1.classId)?.add(slotKey1) ||
    state.classSchedule.set(req1.classId, new Set([slotKey1]));

  // Verifica slot2 nella nuova posizione
  const req2: LessonRequirement = {
    id: 'temp2',
    classId: newSlot2.classId,
    subjectId: newSlot2.subjectId,
    teacherId: newSlot2.teacherId,
    index: 0,
  };

  const avail2: AvailableSlot = {
    dayOfWeek: newSlot2.dayOfWeek,
    slotNumber: newSlot2.slotNumber,
    startTime: newSlot2.startTime,
    endTime: newSlot2.endTime,
  };

  const check2 = checkAllHardConstraints(
    input,
    config,
    state,
    req2,
    avail2,
    newSlot2.room
  );

  return check2.valid;
}

/**
 * Esegue lo swap e ricalcola i punteggi
 */
function performSwap(
  slots: GeneratedSlot[],
  i: number,
  j: number,
  input: ScheduleInput,
  config: ScheduleConfig
): GeneratedSlot[] {
  const newSlots = [...slots];

  const slot1 = newSlots[i];
  const slot2 = newSlots[j];

  // Scambia le posizioni temporali
  newSlots[i] = {
    ...slot1,
    dayOfWeek: slot2.dayOfWeek,
    slotNumber: slot2.slotNumber,
    startTime: slot2.startTime,
    endTime: slot2.endTime,
  };

  newSlots[j] = {
    ...slot2,
    dayOfWeek: slot1.dayOfWeek,
    slotNumber: slot1.slotNumber,
    startTime: slot1.startTime,
    endTime: slot1.endTime,
  };

  // Ricalcola punteggi per gli slot coinvolti
  const state = rebuildState(newSlots);

  for (const idx of [i, j]) {
    const slot = newSlots[idx];
    const assignment = input.assignments.find(
      a => a.classId === slot.classId && a.subjectId === slot.subjectId
    );

    const req: LessonRequirement = {
      id: `swap-${idx}`,
      classId: slot.classId,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
      index: 0,
    };

    const avail: AvailableSlot = {
      dayOfWeek: slot.dayOfWeek,
      slotNumber: slot.slotNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };

    newSlots[idx] = {
      ...slot,
      score: calculateSoftScore(
        input,
        config,
        state,
        req,
        avail,
        assignment?.weeklyHours || 1
      ),
    };
  }

  return newSlots;
}

/**
 * Prova a spostare un singolo slot in una posizione migliore
 */
function tryMoveSlot(
  slots: GeneratedSlot[],
  slotIndex: number,
  input: ScheduleInput,
  config: ScheduleConfig
): GeneratedSlot[] | null {
  const slot = slots[slotIndex];

  // Genera tutte le posizioni alternative
  const alternatives: { day: number; slotNum: number; time: { start: string; end: string } }[] = [];

  for (const day of input.days) {
    for (const timeSlot of input.timeSlots) {
      if (timeSlot.isBreak) continue;

      // Salta la posizione attuale
      if (day === slot.dayOfWeek && timeSlot.slotNumber === slot.slotNumber) {
        continue;
      }

      alternatives.push({
        day,
        slotNum: timeSlot.slotNumber,
        time: { start: timeSlot.startTime, end: timeSlot.endTime },
      });
    }
  }

  // Shuffle alternatives per evitare bias
  for (let i = alternatives.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [alternatives[i], alternatives[j]] = [alternatives[j], alternatives[i]];
  }

  // Prova alternative
  const tempSlots = slots.filter((_, idx) => idx !== slotIndex);
  const state = rebuildState(tempSlots);

  const req: LessonRequirement = {
    id: 'move-temp',
    classId: slot.classId,
    subjectId: slot.subjectId,
    teacherId: slot.teacherId,
    index: 0,
  };

  const assignment = input.assignments.find(
    a => a.classId === slot.classId && a.subjectId === slot.subjectId
  );

  let bestAlternative: {
    slot: GeneratedSlot;
    score: number;
  } | null = null;

  for (const alt of alternatives.slice(0, 10)) {
    // Limita tentativi
    const avail: AvailableSlot = {
      dayOfWeek: alt.day,
      slotNumber: alt.slotNum,
      startTime: alt.time.start,
      endTime: alt.time.end,
    };

    const check = checkAllHardConstraints(input, config, state, req, avail, slot.room);

    if (check.valid) {
      const score = calculateSoftScore(
        input,
        config,
        state,
        req,
        avail,
        assignment?.weeklyHours || 1
      );

      if (!bestAlternative || score > bestAlternative.score) {
        bestAlternative = {
          slot: {
            ...slot,
            dayOfWeek: alt.day,
            slotNumber: alt.slotNum,
            startTime: alt.time.start,
            endTime: alt.time.end,
            score,
          },
          score,
        };
      }
    }
  }

  if (bestAlternative && bestAlternative.score > (slot.score || 0)) {
    const newSlots = [...slots];
    newSlots[slotIndex] = bestAlternative.slot;
    return newSlots;
  }

  return null;
}

/**
 * Algoritmo Hill Climbing per ottimizzare la soluzione
 */
export function optimizeSolution(
  initialSlots: GeneratedSlot[],
  input: ScheduleInput,
  config: ScheduleConfig,
  iterations: number
): GeneratedSlot[] {
  let currentSlots = [...initialSlots];
  let currentScore = calculateTotalScore(currentSlots);

  let noImprovementCount = 0;
  const maxNoImprovement = Math.min(iterations / 5, 200);

  for (let iter = 0; iter < iterations; iter++) {
    // Early exit se nessun miglioramento per troppo tempo
    if (noImprovementCount >= maxNoImprovement) {
      break;
    }

    // Alterna tra strategie
    const strategy = iter % 3;

    let newSlots: GeneratedSlot[] | null = null;

    if (strategy === 0 || strategy === 1) {
      // Strategia 1 & 2: Prova swap
      const swapIndices = findSwappableSlots(currentSlots, input, config);

      if (swapIndices && canSwap(currentSlots, swapIndices[0], swapIndices[1], input, config)) {
        newSlots = performSwap(
          currentSlots,
          swapIndices[0],
          swapIndices[1],
          input,
          config
        );
      }
    } else {
      // Strategia 3: Prova move singolo
      const randomIndex = Math.floor(Math.random() * currentSlots.length);
      newSlots = tryMoveSlot(currentSlots, randomIndex, input, config);
    }

    if (newSlots) {
      const newScore = calculateTotalScore(newSlots);

      if (newScore > currentScore) {
        currentSlots = newSlots;
        currentScore = newScore;
        noImprovementCount = 0;
      } else {
        noImprovementCount++;
      }
    } else {
      noImprovementCount++;
    }
  }

  return currentSlots;
}
