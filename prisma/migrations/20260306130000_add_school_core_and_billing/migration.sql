-- Migration: add_school_core_and_billing
-- Date: 2026-03-06
-- Description: Add missing school core modules, SaaS billing, and tenant columns

-- ========================================
-- 1. ALTER ROLE ENUM (add new values)
-- ========================================
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DIRECTOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SECRETARY';

-- ========================================
-- 2. ALTER NOTIFICATIONTYPE ENUM (add new values)
-- ========================================
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GRADE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISCIPLINARY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'HOMEWORK';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPORT_CARD';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING';

-- ========================================
-- 3. CREATE NEW ENUMS
-- ========================================

-- GradeType
CREATE TYPE "GradeType" AS ENUM ('ORAL', 'WRITTEN', 'PRACTICAL', 'HOMEWORK', 'PROJECT', 'TEST', 'BEHAVIOR');

-- ReportCardStatus
CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- DisciplinaryType
CREATE TYPE "DisciplinaryType" AS ENUM ('NOTE', 'WARNING', 'SUSPENSION', 'POSITIVE');

-- Severity
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- PeriodType
CREATE TYPE "PeriodType" AS ENUM ('TRIMESTRE', 'QUADRIMESTRE', 'SEMESTRE', 'PENTAMESTRE');

-- SubscriptionStatus
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'UNPAID', 'PAUSED');

-- PlanInterval
CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- MaterialType
CREATE TYPE "MaterialType" AS ENUM ('FILE', 'LINK', 'VIDEO', 'IMAGE', 'DOCUMENT', 'PRESENTATION');

-- ========================================
-- 4. ALTER TENANTS TABLE (add new columns)
-- ========================================
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "setupStage" TEXT NOT NULL DEFAULT 'INITIAL';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "setupCompletedAt" TIMESTAMP(3);

-- Create unique index for stripeCustomerId
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_stripeCustomerId_key" ON "tenants"("stripeCustomerId");

-- ========================================
-- 5. CREATE SAAS BILLING TABLES
-- ========================================

-- Plans table
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "interval" "PlanInterval" NOT NULL DEFAULT 'MONTHLY',
    "maxStudents" INTEGER,
    "maxTeachers" INTEGER,
    "maxClasses" INTEGER,
    "features" JSONB NOT NULL DEFAULT '{}',
    "description" TEXT,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- Plans unique indexes
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");
CREATE UNIQUE INDEX "plans_stripePriceId_key" ON "plans"("stripePriceId");

-- Subscriptions table
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- Subscriptions indexes
CREATE UNIQUE INDEX "subscriptions_tenantId_key" ON "subscriptions"("tenantId");
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");
CREATE INDEX "subscriptions_stripeCustomerId_idx" ON "subscriptions"("stripeCustomerId");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- ========================================
-- 6. CREATE SCHOOL CORE TABLES
-- ========================================

-- Academic Years
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_years_tenantId_name_key" ON "academic_years"("tenantId", "name");

-- Academic Periods
CREATE TABLE "academic_periods" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PeriodType" NOT NULL DEFAULT 'QUADRIMESTRE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_periods_pkey" PRIMARY KEY ("id")
);

-- Subjects
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT DEFAULT '#3b82f6',
    "icon" TEXT,
    "weeklyHours" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subjects_tenantId_code_key" ON "subjects"("tenantId", "code");

-- Teacher Subjects (M2M)
CREATE TABLE "teacher_subjects" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "teacher_subjects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teacher_subjects_teacherId_subjectId_key" ON "teacher_subjects"("teacherId", "subjectId");

-- Class Subjects (M2M with teacher assignment)
CREATE TABLE "class_subjects" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weeklyHours" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "class_subjects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_subjects_classId_subjectId_key" ON "class_subjects"("classId", "subjectId");

-- Grades
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "periodId" TEXT,
    "value" DECIMAL(4,2) NOT NULL,
    "valueText" TEXT,
    "weight" DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    "type" "GradeType" NOT NULL DEFAULT 'WRITTEN',
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "grades_studentId_subjectId_idx" ON "grades"("studentId", "subjectId");
CREATE INDEX "grades_classId_subjectId_idx" ON "grades"("classId", "subjectId");
CREATE INDEX "grades_tenantId_date_idx" ON "grades"("tenantId", "date");
CREATE INDEX "grades_tenantId_studentId_idx" ON "grades"("tenantId", "studentId");
CREATE INDEX "grades_classId_date_idx" ON "grades"("classId", "date");

-- Report Cards
CREATE TABLE "report_cards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "ReportCardStatus" NOT NULL DEFAULT 'DRAFT',
    "overallComment" TEXT,
    "behaviorGrade" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_cards_studentId_classId_periodId_key" ON "report_cards"("studentId", "classId", "periodId");

-- Report Card Entries
CREATE TABLE "report_card_entries" (
    "id" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "finalGrade" DECIMAL(4,2) NOT NULL,
    "finalGradeText" TEXT,
    "averageOral" DECIMAL(4,2),
    "averageWritten" DECIMAL(4,2),
    "averagePractical" DECIMAL(4,2),
    "overallAverage" DECIMAL(4,2),
    "teacherComment" TEXT,
    "absenceCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "report_card_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_card_entries_reportCardId_subjectId_key" ON "report_card_entries"("reportCardId", "subjectId");

-- Disciplinary Notes
CREATE TABLE "disciplinary_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "type" "DisciplinaryType" NOT NULL DEFAULT 'NOTE',
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "parentNotifiedAt" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disciplinary_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "disciplinary_notes_tenantId_studentId_idx" ON "disciplinary_notes"("tenantId", "studentId");
CREATE INDEX "disciplinary_notes_tenantId_date_idx" ON "disciplinary_notes"("tenantId", "date");
CREATE INDEX "disciplinary_notes_studentId_date_idx" ON "disciplinary_notes"("studentId", "date");

-- Homework
CREATE TABLE "homework" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "attachments" JSONB DEFAULT '[]',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "homework_tenantId_classId_idx" ON "homework"("tenantId", "classId");
CREATE INDEX "homework_tenantId_dueDate_idx" ON "homework"("tenantId", "dueDate");
CREATE INDEX "homework_classId_dueDate_idx" ON "homework"("classId", "dueDate");

-- Homework Submissions
CREATE TABLE "homework_submissions" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT,
    "attachments" JSONB DEFAULT '[]',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grade" DECIMAL(4,2),
    "feedback" TEXT,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "homework_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "homework_submissions_homeworkId_studentId_key" ON "homework_submissions"("homeworkId", "studentId");

-- Materials
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL DEFAULT 'FILE',
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "mimeType" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "materials_tenantId_lessonId_idx" ON "materials"("tenantId", "lessonId");

-- Audit Logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_tenantId_entity_entityId_idx" ON "audit_logs"("tenantId", "entity", "entityId");
CREATE INDEX "audit_logs_tenantId_userId_idx" ON "audit_logs"("tenantId", "userId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- ========================================
-- 7. ADD NOTIFICATION INDEX (BUG-040 fix)
-- ========================================
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- ========================================
-- 8. ADD FOREIGN KEYS
-- ========================================

-- Subscriptions FK
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Academic Years FK
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Academic Periods FK
ALTER TABLE "academic_periods" ADD CONSTRAINT "academic_periods_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subjects FK
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Teacher Subjects FK
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Class Subjects FK
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grades FK
ALTER TABLE "grades" ADD CONSTRAINT "grades_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Report Cards FK
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Report Card Entries FK
ALTER TABLE "report_card_entries" ADD CONSTRAINT "report_card_entries_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "report_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_card_entries" ADD CONSTRAINT "report_card_entries_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Disciplinary Notes FK
ALTER TABLE "disciplinary_notes" ADD CONSTRAINT "disciplinary_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disciplinary_notes" ADD CONSTRAINT "disciplinary_notes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disciplinary_notes" ADD CONSTRAINT "disciplinary_notes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disciplinary_notes" ADD CONSTRAINT "disciplinary_notes_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Homework FK
ALTER TABLE "homework" ADD CONSTRAINT "homework_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework" ADD CONSTRAINT "homework_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework" ADD CONSTRAINT "homework_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework" ADD CONSTRAINT "homework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "homework" ADD CONSTRAINT "homework_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Homework Submissions FK
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Materials FK
ALTER TABLE "materials" ADD CONSTRAINT "materials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "materials" ADD CONSTRAINT "materials_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Audit Logs FK
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
