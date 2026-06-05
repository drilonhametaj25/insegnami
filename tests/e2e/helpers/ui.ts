import { Page, Locator } from '@playwright/test';

/**
 * Seleziona la prima opzione VISIBILE di un Select Mantine. I Mantine Select
 * tengono tutte le opzioni nel DOM: filtriamo solo quelle del dropdown aperto.
 */
export async function selectFirstOption(page: Page, opener: Locator) {
  await opener.click();
  const firstOption = page.locator('[role="option"]:visible').first();
  await firstOption.waitFor({ state: 'visible', timeout: 10000 });
  await firstOption.click();
}

/** Apre un DatePickerInput/DateInput e seleziona il giorno 15 del mese mostrato. */
export async function pickDay15(page: Page, opener: Locator) {
  await pickDay(page, opener, 15);
}

/**
 * Apre un DatePickerInput/DateInput e seleziona il giorno indicato del mese
 * mostrato. I bottoni-giorno Mantine hanno aria-label completo (es. "5 June
 * 2026"), quindi li selezioniamo per testo esatto della cella.
 */
export async function pickDay(page: Page, opener: Locator, day: number) {
  await opener.click();
  // Scopo la selezione al dropdown aperto da QUESTO opener (aria-controls),
  // per evitare di colpire i giorni di un altro calendario ancora montato.
  const dropdownId = await opener.getAttribute('aria-controls');
  const scope = dropdownId ? page.locator(`#${dropdownId}`) : page;
  // I giorni hanno aria-label "5 June 2026": selezioniamo per nome accessibile.
  await scope
    .getByRole('button', { name: new RegExp(`^${day}\\s`) })
    .first()
    .click();
}
