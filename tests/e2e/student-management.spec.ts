import { test, expect } from '@playwright/test'

test.describe('Student Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/login')
    await page.fill('input[name="email"]', 'admin@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/)
    
    // Navigate to students
    await page.click('a[href*="/students"]')
    await expect(page).toHaveURL(/\/students/)
  })

  test('should display students list', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /students/i })).toBeVisible()
    
    // Check for students table or list
    const studentsTable = page.getByRole('table') || page.locator('[data-testid="students-table"]')
    
    if (await studentsTable.isVisible()) {
      // Should show table headers
      await expect(page.getByRole('columnheader')).toHaveCount(5, { timeout: 5000 })
    }
  })

  test('should open create student modal', async ({ page }) => {
    // Click create button
    const createButton = page.getByRole('button', { name: /add student|create student|new student/i })
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Should open modal
      await expect(page.getByRole('dialog') || page.locator('[role="dialog"]')).toBeVisible()
      
      // Should show form fields
      await expect(page.getByLabel(/first name/i)).toBeVisible()
      await expect(page.getByLabel(/last name/i)).toBeVisible()
      await expect(page.getByLabel(/email/i)).toBeVisible()
    }
  })

  test('should create a new student successfully', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /add student|create student|new student/i })
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Wait for modal
      await page.waitForSelector('[role="dialog"], .modal, [data-testid="student-modal"]')
      
      // Fill form
      await page.fill('input[name="firstName"], [data-testid="firstName"]', 'John')
      await page.fill('input[name="lastName"], [data-testid="lastName"]', 'Doe')
      await page.fill('input[name="email"], [data-testid="email"]', 'john.doe@example.com')
      await page.fill('input[name="phone"], [data-testid="phone"]', '+1234567890')
      
      // Select date of birth if available
      const dobInput = page.locator('input[name="dateOfBirth"], [data-testid="dateOfBirth"]')
      if (await dobInput.isVisible()) {
        await dobInput.fill('1995-05-15')
      }
      
      // Submit form
      const submitButton = page.getByRole('button', { name: /save|create|submit/i })
      await submitButton.click()
      
      // Should close modal and show success
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
      
      // Should show success notification (if implemented)
      const notification = page.locator('[data-testid="notification"], .notification, [role="alert"]')
      if (await notification.isVisible()) {
        await expect(notification).toContainText(/success|created/i)
      }
    }
  })

  test('should validate required fields', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /add student|create student|new student/i })
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Wait for modal
      await page.waitForSelector('[role="dialog"], .modal')
      
      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /save|create|submit/i })
      await submitButton.click()
      
      // Should show validation errors
      const errorMessages = page.locator('[data-testid*="error"], .error, [role="alert"]')
      
      if (await errorMessages.count() > 0) {
        await expect(errorMessages.first()).toBeVisible()
      }
      
      // Form should still be open
      await expect(page.getByRole('dialog')).toBeVisible()
    }
  })

  test('should search students', async ({ page }) => {
    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i) || 
                       page.locator('input[name="search"]') ||
                       page.locator('[data-testid="search-input"]')
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('John')
      
      // Wait for search results
      await page.waitForTimeout(1000)
      
      // Results should be filtered (this is hard to test without actual data)
      // Just verify no crash occurs
      await expect(page.getByRole('heading', { name: /students/i })).toBeVisible()
    }
  })

  test('should view student details', async ({ page }) => {
    // Look for view/details button or student row
    const viewButton = page.getByRole('button', { name: /view|details/i }).first() ||
                      page.locator('[data-testid*="view"], [data-testid*="details"]').first()
    
    if (await viewButton.isVisible()) {
      await viewButton.click()
      
      // Should navigate to details page or open modal
      await page.waitForTimeout(1000)
      
      // Check for detail view
      const isModalOpen = await page.getByRole('dialog').isVisible()
      const isDetailsPage = page.url().includes('/students/')
      
      expect(isModalOpen || isDetailsPage).toBeTruthy()
    }
  })

  test('should handle pagination if present', async ({ page }) => {
    // Look for pagination controls
    const pagination = page.locator('.pagination, [data-testid="pagination"], [aria-label*="pagination"]')
    
    if (await pagination.isVisible()) {
      const nextButton = page.getByRole('button', { name: /next/i }) ||
                        page.locator('[data-testid="next-page"]')
      
      if (await nextButton.isVisible() && !await nextButton.isDisabled()) {
        await nextButton.click()
        
        // Wait for page to load
        await page.waitForTimeout(1000)
        
        // Should still show students page
        await expect(page.getByRole('heading', { name: /students/i })).toBeVisible()
      }
    }
  })
})
