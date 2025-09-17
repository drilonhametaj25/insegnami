import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/)
    
    // Should show login form
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login')
    
    // Fill in login form
    await page.fill('input[name="email"]', 'admin@example.com')
    await page.fill('input[name="password"]', 'password123')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard after successful login
    await expect(page).toHaveURL(/\/dashboard/)
    
    // Should show dashboard content
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    
    // Fill in login form with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible()
    
    // Should remain on login page
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for dashboard tests
    await page.goto('/login')
    await page.fill('input[name="email"]', 'admin@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('should navigate to students page', async ({ page }) => {
    await page.click('a[href*="/students"]')
    
    await expect(page).toHaveURL(/\/students/)
    await expect(page.getByRole('heading', { name: /students/i })).toBeVisible()
  })

  test('should navigate to teachers page', async ({ page }) => {
    await page.click('a[href*="/teachers"]')
    
    await expect(page).toHaveURL(/\/teachers/)
    await expect(page.getByRole('heading', { name: /teachers/i })).toBeVisible()
  })

  test('should navigate to classes page', async ({ page }) => {
    await page.click('a[href*="/classes"]')
    
    await expect(page).toHaveURL(/\/classes/)
    await expect(page.getByRole('heading', { name: /classes/i })).toBeVisible()
  })

  test('should navigate to analytics page', async ({ page }) => {
    await page.click('a[href*="/analytics"]')
    
    await expect(page).toHaveURL(/\/analytics/)
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible()
    
    // Should show analytics components
    await expect(page.getByText(/total students/i)).toBeVisible()
    await expect(page.getByText(/total teachers/i)).toBeVisible()
  })

  test('should show sidebar navigation items', async ({ page }) => {
    // Check that main navigation items are visible
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /students/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /teachers/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /classes/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /lessons/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /payments/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /analytics/i })).toBeVisible()
  })
})
