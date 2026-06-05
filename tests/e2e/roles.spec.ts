import { test, expect } from '@playwright/test';
import { storageStateFor } from './helpers/auth';

/**
 * Ruoli e permessi: protezione middleware delle route admin, voci di
 * navigazione filtrate per ruolo, e accesso alle dashboard di ruolo.
 */

test.describe('Permessi — ADMIN', () => {
  test.use({ storageState: storageStateFor('admin') });

  test('admin vede le voci di gestione (Utenti, Docenti)', async ({ page }) => {
    await page.goto('/it/dashboard');
    await expect(page.getByRole('link', { name: 'Utenti', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Docenti', exact: true })).toBeVisible();
  });

  test('admin può accedere alla gestione utenti', async ({ page }) => {
    await page.goto('/it/dashboard/admin/users');
    await expect(page).toHaveURL(/\/dashboard\/admin\/users/);
  });
});

test.describe('Permessi — STUDENT', () => {
  test.use({ storageState: storageStateFor('student') });

  test('lo studente NON vede le voci admin (Utenti/Docenti)', async ({ page }) => {
    await page.goto('/it/dashboard');
    await expect(page.getByRole('link', { name: 'Utenti', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Docenti', exact: true })).toHaveCount(0);
  });

  test('lo studente è bloccato dalle route admin (redirect)', async ({ page }) => {
    await page.goto('/it/dashboard/admin/users');
    // Il middleware reindirizza alla dashboard
    await expect(page).not.toHaveURL(/\/admin\/users/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Permessi — PARENT', () => {
  test.use({ storageState: storageStateFor('parent') });

  test('il genitore vede le proprie voci e non quelle admin', async ({ page }) => {
    await page.goto('/it/dashboard');
    await expect(page.getByRole('link', { name: 'Utenti', exact: true })).toHaveCount(0);
    // Voci tipiche del genitore
    await expect(page.getByRole('link', { name: /Pagamenti/i }).first()).toBeVisible();
  });

  test('il genitore è bloccato dalle route admin', async ({ page }) => {
    await page.goto('/it/dashboard/admin/users');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).not.toHaveURL(/\/admin\/users/);
  });
});

test.describe('Permessi — TEACHER', () => {
  test.use({ storageState: storageStateFor('teacher') });

  test('il docente vede le proprie voci didattiche', async ({ page }) => {
    await page.goto('/it/dashboard');
    await expect(page.getByRole('link', { name: 'Utenti', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Lezioni/i }).first()).toBeVisible();
  });

  test('il docente è bloccato dalle route admin', async ({ page }) => {
    await page.goto('/it/dashboard/admin/users');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).not.toHaveURL(/\/admin\/users/);
  });
});
