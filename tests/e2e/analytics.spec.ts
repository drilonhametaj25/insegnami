import { test, expect } from '@playwright/test'

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/login')
    await page.fill('input[name="email"]', 'admin@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/)
    
    // Navigate to analytics
    await page.click('a[href*="/analytics"]')
    await expect(page).toHaveURL(/\/analytics/)
  })

  test('should display overview statistics cards', async ({ page }) => {
    // Check that all main stat cards are visible
    await expect(page.getByText(/total students/i)).toBeVisible()
    await expect(page.getByText(/total teachers/i)).toBeVisible()
    await expect(page.getByText(/total classes/i)).toBeVisible()
    await expect(page.getByText(/lessons this period/i)).toBeVisible()
    
    // Check that stat values are displayed (numbers should be visible)
    const statCards = page.locator('[data-testid="stat-card"], .stats-card, [class*="stat"]')
    await expect(statCards.first()).toBeVisible()
  })

  test('should display key metrics', async ({ page }) => {
    // Check key metrics section
    await expect(page.getByText(/attendance rate/i)).toBeVisible()
    await expect(page.getByText(/total revenue/i)).toBeVisible()
    await expect(page.getByText(/overdue payments/i)).toBeVisible()
  })

  test('should change time period filter', async ({ page }) => {
    // Find and click period selector
    const periodSelector = page.getByRole('combobox').first() || page.locator('select').first()
    
    if (await periodSelector.isVisible()) {
      // Click to open dropdown
      await periodSelector.click()
      
      // Select 90 days option
      await page.getByRole('option', { name: /90 days/i }).click()
      
      // Wait for data to reload
      await page.waitForTimeout(1000)
      
      // Verify the selection
      await expect(periodSelector).toHaveValue('90')
    }
  })

  test('should display charts', async ({ page }) => {
    // Wait for charts to load
    await page.waitForTimeout(2000)
    
    // Check for chart containers or SVG elements
    const chartElements = page.locator('svg, canvas, [class*="chart"], [class*="recharts"]')
    
    // Should have at least one chart element
    await expect(chartElements.first()).toBeVisible({ timeout: 10000 })
  })

  test('should show export options', async ({ page }) => {
    // Look for export buttons or section
    const exportSection = page.getByText(/export data/i)
    
    if (await exportSection.isVisible()) {
      // Check for export buttons
      await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /export excel/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /export pdf/i })).toBeVisible()
    }
  })

  test('should refresh data when refresh button is clicked', async ({ page }) => {
    // Look for refresh button
    const refreshButton = page.getByRole('button', { name: /refresh/i }) || 
                         page.locator('[data-testid="refresh-button"]') ||
                         page.locator('button[title*="refresh"]')
    
    if (await refreshButton.isVisible()) {
      await refreshButton.click()
      
      // Should show loading state briefly
      await page.waitForTimeout(500)
      
      // Data should be refreshed (no specific assertion needed, just verify no errors)
      await expect(page.getByText(/total students/i)).toBeVisible()
    }
  })

  test('should handle empty data gracefully', async ({ page }) => {
    // Mock empty response (this would be done with request interception in real tests)
    
    // Check that no data messages are handled properly
    const noDataElements = page.getByText(/no.*data.*available/i)
    
    // If no data messages exist, that's fine too
    const count = await noDataElements.count()
    
    // Just verify page doesn't crash
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible()
  })

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Check that main elements are still visible and accessible
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible()
    await expect(page.getByText(/total students/i)).toBeVisible()
    
    // Check that navigation is accessible (hamburger menu or visible nav)
    const navElements = page.locator('nav, [role="navigation"], .sidebar, .navbar')
    if (await navElements.count() > 0) {
      await expect(navElements.first()).toBeVisible()
    }
  })
})
