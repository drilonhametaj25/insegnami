-- Wave 3: billing (interval/grace/fiscali/addon yearly/platform settings),
-- didattica (status avvisi, materia lezione, campi classe, codici per-tenant),
-- finanza (bozze fatture multiple, bollo, email log, ledger ore, giustificazioni).

-- ========== ENUM ==========
CREATE TYPE "NoticeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "JustificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "EmailLogStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- ========== SUBSCRIPTION: intervallo + grace ==========
ALTER TABLE "subscriptions" ADD COLUMN "interval" "PlanInterval" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "subscriptions" ADD COLUMN "gracePeriodEnd" TIMESTAMP(3);

-- ========== ADDON CATALOG: prezzo annuale ==========
ALTER TABLE "addon_catalog" ADD COLUMN "stripeYearlyPriceId" TEXT;
CREATE UNIQUE INDEX "addon_catalog_stripeYearlyPriceId_key" ON "addon_catalog"("stripeYearlyPriceId");

-- ========== TENANT: dati fiscali + normalizzazione slug piano ==========
ALTER TABLE "tenants" ADD COLUMN "billingName" TEXT;
ALTER TABLE "tenants" ADD COLUMN "vatNumber" TEXT;
ALTER TABLE "tenants" ADD COLUMN "taxCode" TEXT;
ALTER TABLE "tenants" ADD COLUMN "sdiCode" TEXT;
ALTER TABLE "tenants" ADD COLUMN "pec" TEXT;
-- il webhook storico scriveva il piano in MAIUSCOLO: normalizza
UPDATE "tenants" SET "plan" = lower("plan") WHERE "plan" <> lower("plan");

-- ========== PLATFORM SETTINGS (singleton) ==========
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "defaultTrialDays" INTEGER NOT NULL DEFAULT 14,
    "allowNewRegistrations" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "replyTo" TEXT,
    "graceDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "platform_settings" ("id", "updatedAt") VALUES ('platform', CURRENT_TIMESTAMP);

-- ========== NOTICE: ciclo di vita ==========
ALTER TABLE "notices" ADD COLUMN "status" "NoticeStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "notices" ADD COLUMN "publishedAt" TIMESTAMP(3);
-- gli avvisi esistenti risultano pubblicati alla loro publishAt
UPDATE "notices" SET "publishedAt" = "publishAt" WHERE "publishedAt" IS NULL;

-- ========== LESSON: materia ==========
ALTER TABLE "lessons" ADD COLUMN "subjectId" TEXT;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ========== CLASS: dettagli operativi ==========
ALTER TABLE "classes" ADD COLUMN "description" TEXT;
ALTER TABLE "classes" ADD COLUMN "level" TEXT;
ALTER TABLE "classes" ADD COLUMN "room" TEXT;
ALTER TABLE "classes" ADD COLUMN "monthlyPrice" DECIMAL(10,2);

-- ========== CODICI PER-TENANT (via unique globali) ==========
DROP INDEX IF EXISTS "students_studentCode_key";
CREATE UNIQUE INDEX "students_tenantId_studentCode_key" ON "students"("tenantId", "studentCode");
DROP INDEX IF EXISTS "teachers_teacherCode_key";
CREATE UNIQUE INDEX "teachers_tenantId_teacherCode_key" ON "teachers"("tenantId", "teacherCode");
DROP INDEX IF EXISTS "classes_code_key";
CREATE UNIQUE INDEX "classes_tenantId_code_key" ON "classes"("tenantId", "code");
DROP INDEX IF EXISTS "courses_code_key";
CREATE UNIQUE INDEX "courses_tenantId_code_key" ON "courses"("tenantId", "code");

-- ========== INVOICE: bozze multiple (partial unique) ==========
-- number=0 identifica le bozze: possono coesistere in numero arbitrario;
-- l'unicità del progressivo vale solo per le fatture emesse.
DROP INDEX IF EXISTS "invoices_tenantId_seriesId_year_number_key";
CREATE UNIQUE INDEX "invoices_tenant_series_year_number_issued_key"
  ON "invoices"("tenantId", "seriesId", "year", "number")
  WHERE "number" > 0;

-- ========== INVOICE SETTINGS: bollo ==========
ALTER TABLE "invoice_settings" ADD COLUMN "bolloVirtuale" BOOLEAN NOT NULL DEFAULT false;

-- ========== ABSENCE JUSTIFICATIONS ==========
CREATE TABLE "absence_justifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "attachmentUrl" TEXT,
    "status" "JustificationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "absence_justifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "absence_justifications_tenantId_status_idx" ON "absence_justifications"("tenantId", "status");
CREATE INDEX "absence_justifications_tenantId_studentId_dateFrom_idx" ON "absence_justifications"("tenantId", "studentId", "dateFrom");
ALTER TABLE "absence_justifications" ADD CONSTRAINT "absence_justifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "absence_justifications" ADD CONSTRAINT "absence_justifications_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "absence_justifications" ADD CONSTRAINT "absence_justifications_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "absence_justifications" ADD CONSTRAINT "absence_justifications_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ========== EMAIL LOG ==========
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "messageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_logs_tenantId_createdAt_idx" ON "email_logs"("tenantId", "createdAt");
CREATE INDEX "email_logs_sourceType_sourceId_idx" ON "email_logs"("sourceType", "sourceId");
CREATE INDEX "email_logs_to_createdAt_idx" ON "email_logs"("to", "createdAt");

-- ========== HOURS LEDGER ==========
CREATE TABLE "hours_ledger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hours_ledger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hours_ledger_packageId_lessonId_key" ON "hours_ledger"("packageId", "lessonId");
CREATE INDEX "hours_ledger_tenantId_studentId_idx" ON "hours_ledger"("tenantId", "studentId");
ALTER TABLE "hours_ledger" ADD CONSTRAINT "hours_ledger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hours_ledger" ADD CONSTRAINT "hours_ledger_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "hours_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hours_ledger" ADD CONSTRAINT "hours_ledger_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hours_ledger" ADD CONSTRAINT "hours_ledger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
