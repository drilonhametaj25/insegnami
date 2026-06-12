import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Utility functions for token generation (Node.js runtime only)
export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Helper function to hash passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Helper function to verify passwords
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Genera uno slug univoco a partire da un nome (es. nome scuola).
 * Funzione pura rispetto al DB: l'esistenza è delegata al callback `exists`,
 * così è testabile senza Prisma.
 *
 * - slugify base: lowercase, sequenze non alfanumeriche → '-', trim dei '-'
 * - input senza caratteri validi → fallback 'scuola'
 * - collisione → suffissi -2, -3, ... fino a -20
 * - esauriti i suffissi numerici → suffisso random base36 di 4 caratteri
 */
export async function slugifyUnique(
  name: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'scuola';

  if (!(await exists(base))) {
    return base;
  }

  // Suffissi numerici progressivi: -2, -3, ... -20
  for (let i = 2; i <= 20; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  // Caso estremo (>20 omonimie): suffisso random base36 di 4 caratteri.
  // Non ricontrolliamo exists: la probabilità di collisione è trascurabile e
  // l'eventuale unique constraint del DB resta l'ultima rete di sicurezza.
  const random = crypto.randomBytes(3).readUIntBE(0, 3).toString(36).padStart(4, '0').slice(-4);
  return `${base}-${random}`;
}
