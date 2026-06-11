-- Reconcile schema drift: lo schema è evoluto via `prisma db push` senza migration.
-- SQL reso idempotente (IF NOT EXISTS / duplicate_object) perché alcuni DB
-- (dev, o prod parzialmente allineati) possono già avere parte di questi oggetti.

-- CreateEnum
DO $$ BEGIN CREATE TYPE "AddonType" AS ENUM ('EXTRA_STUDENTS', 'EXTRA_TEACHERS', 'EXTRA_CLASSES', 'EXTRA_STORAGE'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "AddonStatus" AS ENUM ('ACTIVE', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "AutomationRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "InvoiceDocumentType" AS ENUM ('TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06', 'TD16', 'TD17', 'TD18', 'TD19', 'TD20', 'TD21', 'TD22', 'TD23', 'TD24', 'TD25', 'TD26', 'TD27', 'TD28'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'REJECTED', 'PAID', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "SdiEventType" AS ENUM ('NS', 'RC', 'MC', 'NE', 'MT', 'EC', 'DT', 'AT'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "SdiTransmissionStatus" AS ENUM ('PENDING', 'TRANSMITTED', 'ACCEPTED', 'REJECTED', 'NOT_DELIVERED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'LOCKED', 'PAID'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PayrollLineType" AS ENUM ('HOURS', 'BONUS', 'EXPENSE_REIMBURSEMENT', 'ADJUSTMENT', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PayrollWithholdingType" AS ENUM ('RITENUTA_ACCONTO', 'INPS', 'INAIL', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "TaxRegime" AS ENUM ('FORFETTARIO', 'ORDINARIO', 'DIPENDENTE', 'COCOCO', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "AccountingMovementType" AS ENUM ('REVENUE', 'COST'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "AccountingMovementSource" AS ENUM ('INVOICE', 'PAYMENT', 'PAYROLL', 'SUBSCRIPTION', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "hoursConsumed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "logo" TEXT,
ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_addons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "AddonType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitSize" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "status" "AddonStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeSubscriptionItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "addon_catalog" (
    "id" TEXT NOT NULL,
    "type" "AddonType" NOT NULL,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "priceAmount" DECIMAL(10,2),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addon_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "holidays" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "automation_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "jobName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "resultJson" JSONB,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoice_series" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prefix" TEXT,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "yearCounters" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoice_customer_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT,
    "userId" TEXT,
    "denominazione" TEXT,
    "nome" TEXT,
    "cognome" TEXT,
    "codiceFiscale" TEXT,
    "partitaIva" TEXT,
    "pec" TEXT,
    "codiceDestinatario" TEXT NOT NULL DEFAULT '0000000',
    "regimeFiscale" TEXT,
    "indirizzo" TEXT NOT NULL,
    "cap" TEXT NOT NULL,
    "comune" TEXT NOT NULL,
    "provincia" TEXT,
    "nazione" TEXT NOT NULL DEFAULT 'IT',
    "email" TEXT,
    "telefono" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoice_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "denominazione" TEXT NOT NULL,
    "partitaIva" TEXT NOT NULL,
    "codiceFiscale" TEXT NOT NULL,
    "regimeFiscale" TEXT NOT NULL DEFAULT 'RF01',
    "iscrizioneREA" TEXT,
    "capitaleSociale" DECIMAL(15,2),
    "socioUnico" TEXT,
    "statoLiquidazione" TEXT DEFAULT 'LN',
    "indirizzo" TEXT NOT NULL,
    "cap" TEXT NOT NULL,
    "comune" TEXT NOT NULL,
    "provincia" TEXT,
    "nazione" TEXT NOT NULL DEFAULT 'IT',
    "telefono" TEXT,
    "email" TEXT,
    "sdiProvider" TEXT NOT NULL DEFAULT 'file-system',
    "sdiCredentials" JSONB,
    "conservazioneEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "number" INTEGER NOT NULL DEFAULT 0,
    "year" INTEGER NOT NULL,
    "documentType" "InvoiceDocumentType" NOT NULL DEFAULT 'TD01',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentDate" TIMESTAMP(3),
    "customerProfileId" TEXT NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "vatTotal" DECIMAL(15,2) NOT NULL,
    "withholdingTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentMethod" TEXT,
    "paymentTerms" JSONB,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "sdiStatus" "SdiTransmissionStatus" NOT NULL DEFAULT 'PENDING',
    "sdiIdentifier" TEXT,
    "sdiTransmittedAt" TIMESTAMP(3),
    "sdiAcceptedAt" TIMESTAMP(3),
    "sdiRejectedReason" TEXT,
    "xmlContent" TEXT,
    "pdfUrl" TEXT,
    "relatedInvoiceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(15,4) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "vatNature" TEXT,
    "discountPercent" DECIMAL(5,2),
    "total" DECIMAL(15,2) NOT NULL,
    "paymentId" TEXT,
    "studentId" TEXT,
    "courseId" TEXT,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sdi_events" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "eventType" "SdiEventType" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadXml" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "sdi_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_periods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payrolls" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "hourlyRateSnapshot" DECIMAL(10,2) NOT NULL,
    "hoursWorked" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grossBase" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "extrasTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "withholdingsTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "payslipPdfUrl" TEXT,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_line_items" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "type" "PayrollLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "unitAmount" DECIMAL(15,4) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "lessonId" TEXT,

    CONSTRAINT "payroll_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_withholdings" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "type" "PayrollWithholdingType" NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "base" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "payroll_withholdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "teacher_payroll_settings" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "taxRegime" "TaxRegime" NOT NULL DEFAULT 'ORDINARIO',
    "iban" TEXT,
    "defaultWithholdings" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "accounting_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "AccountingMovementType" NOT NULL,
    "source" "AccountingMovementSource" NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "payrollId" TEXT,
    "classId" TEXT,
    "courseId" TEXT,
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "accounting_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_addons_tenantId_idx" ON "tenant_addons"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_addons_tenantId_status_idx" ON "tenant_addons"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "addon_catalog_type_key" ON "addon_catalog"("type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "addon_catalog_stripeProductId_key" ON "addon_catalog"("stripeProductId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "addon_catalog_stripePriceId_key" ON "addon_catalog"("stripePriceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "holidays_tenantId_date_idx" ON "holidays"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "holidays_tenantId_date_name_key" ON "holidays"("tenantId", "date", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_runs_jobName_startedAt_idx" ON "automation_runs"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_runs_status_idx" ON "automation_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_series_tenantId_code_key" ON "invoice_series"("tenantId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoice_customer_profiles_tenantId_codiceFiscale_idx" ON "invoice_customer_profiles"("tenantId", "codiceFiscale");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoice_customer_profiles_tenantId_partitaIva_idx" ON "invoice_customer_profiles"("tenantId", "partitaIva");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_settings_tenantId_key" ON "invoice_settings"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_tenantId_year_status_idx" ON "invoices"("tenantId", "year", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_tenantId_sdiStatus_idx" ON "invoices"("tenantId", "sdiStatus");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_tenantId_seriesId_year_number_key" ON "invoices"("tenantId", "seriesId", "year", "number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_lines_invoiceId_lineNumber_key" ON "invoice_lines"("invoiceId", "lineNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sdi_events_invoiceId_receivedAt_idx" ON "sdi_events"("invoiceId", "receivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_periods_tenantId_status_idx" ON "payroll_periods"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_periods_tenantId_year_month_key" ON "payroll_periods"("tenantId", "year", "month");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payrolls_tenantId_status_idx" ON "payrolls"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payrolls_teacherId_periodId_idx" ON "payrolls"("teacherId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payrolls_periodId_teacherId_key" ON "payrolls"("periodId", "teacherId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_line_items_payrollId_idx" ON "payroll_line_items"("payrollId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payroll_withholdings_payrollId_idx" ON "payroll_withholdings"("payrollId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_payroll_settings_teacherId_key" ON "teacher_payroll_settings"("teacherId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "accounting_movements_tenantId_date_type_idx" ON "accounting_movements"("tenantId", "date", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "accounting_movements_tenantId_source_idx" ON "accounting_movements"("tenantId", "source");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "accounting_movements_tenantId_classId_idx" ON "accounting_movements"("tenantId", "classId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lessons_teacherId_startTime_status_idx" ON "lessons"("teacherId", "startTime", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lessons_tenantId_startTime_idx" ON "lessons"("tenantId", "startTime");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_tenantId_status_dueDate_idx" ON "payments"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "teachers_userId_key" ON "teachers"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "teachers_tenantId_status_idx" ON "teachers"("tenantId", "status");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "tenant_addons" ADD CONSTRAINT "tenant_addons_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "teachers" ADD CONSTRAINT "teachers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "holidays" ADD CONSTRAINT "holidays_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "holidays" ADD CONSTRAINT "holidays_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoice_series" ADD CONSTRAINT "invoice_series_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoice_customer_profiles" ADD CONSTRAINT "invoice_customer_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoice_customer_profiles" ADD CONSTRAINT "invoice_customer_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoice_customer_profiles" ADD CONSTRAINT "invoice_customer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "invoice_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "invoice_customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "sdi_events" ADD CONSTRAINT "sdi_events_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "payroll_withholdings" ADD CONSTRAINT "payroll_withholdings_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "teacher_payroll_settings" ADD CONSTRAINT "teacher_payroll_settings_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "accounting_movements" ADD CONSTRAINT "accounting_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "accounting_movements" ADD CONSTRAINT "accounting_movements_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "accounting_movements" ADD CONSTRAINT "accounting_movements_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

