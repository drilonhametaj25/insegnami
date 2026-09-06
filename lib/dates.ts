/**
 * Helper date condivisi.
 */

/**
 * Fine giornata (23:59:59.999) in ora locale della data passata.
 * Usato sui filtri `lte` per includere l'intero ultimo giorno del range
 * (una data "YYYY-MM-DD" nuda è mezzanotte: senza questo helper l'ultimo
 * giorno resta escluso).
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
