import type { AddonType } from '@prisma/client';

/**
 * Catalogo add-on (espansioni acquistabili oltre il piano).
 * Ogni add-on è venduto a "pacchetti": un pacchetto aggiunge `unitSize`
 * entità (studenti/docenti/classi) oppure GB di storage, al prezzo
 * `unitPrice` al mese. Il prezzo viene congelato come snapshot su
 * TenantAddon al momento dell'acquisto.
 */
export interface AddonDefinition {
  type: AddonType;
  name: string;
  description: string;
  unitSize: number; // entità per pacchetto (50 studenti, 5 GB, ...)
  unitLabel: string; // etichetta unità (studenti, docenti, classi, GB)
  unitPrice: number; // €/mese per pacchetto
  /** chiave del limite di piano che questo add-on espande, se applicabile */
  limitKey?: 'maxStudents' | 'maxTeachers' | 'maxClasses';
}

export const ADDON_CATALOG: Record<AddonType, AddonDefinition> = {
  EXTRA_STUDENTS: {
    type: 'EXTRA_STUDENTS',
    name: 'Posti studente extra',
    description: '+50 studenti oltre il limite del piano',
    unitSize: 50,
    unitLabel: 'studenti',
    unitPrice: 10,
    limitKey: 'maxStudents',
  },
  EXTRA_TEACHERS: {
    type: 'EXTRA_TEACHERS',
    name: 'Posti docente extra',
    description: '+5 docenti oltre il limite del piano',
    unitSize: 5,
    unitLabel: 'docenti',
    unitPrice: 8,
    limitKey: 'maxTeachers',
  },
  EXTRA_CLASSES: {
    type: 'EXTRA_CLASSES',
    name: 'Classi extra',
    description: '+10 classi oltre il limite del piano',
    unitSize: 10,
    unitLabel: 'classi',
    unitPrice: 6,
    limitKey: 'maxClasses',
  },
  EXTRA_STORAGE: {
    type: 'EXTRA_STORAGE',
    name: 'Spazio storage extra',
    description: '+5 GB di spazio per materiali e documenti',
    unitSize: 5,
    unitLabel: 'GB',
    unitPrice: 5,
  },
};

export const ADDON_TYPES = Object.keys(ADDON_CATALOG) as AddonType[];

/** Spazio storage base incluso nel piano (in GB), per slug piano. */
export const PLAN_BASE_STORAGE_GB: Record<string, number | null> = {
  starter: 1,
  professional: 10,
  enterprise: null, // illimitato
};

export function getAddonDefinition(type: AddonType): AddonDefinition {
  return ADDON_CATALOG[type];
}
