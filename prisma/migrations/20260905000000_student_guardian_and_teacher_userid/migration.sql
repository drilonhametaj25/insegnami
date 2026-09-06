-- Wave 2: famiglie multi-figlio/multi-tutore + link Teacher→User robusto.
--
-- 1) Nuova tabella ponte student_guardians (più tutori per studente, più
--    figli per tutore), con backfill dal vecchio Student.parentUserId.
-- 2) Rimozione del vincolo UNIQUE su students.parentUserId (impediva a un
--    genitore di avere più di un figlio). Il campo resta come
--    denormalizzazione del tutore primario.
-- 3) Backfill di teachers.userId dal match email (solo dove univoco), così
--    la risoluzione del docente non dipende più dalla mail volatile.

-- CreateTable
CREATE TABLE "student_guardians" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relationship" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_guardians_studentId_userId_key" ON "student_guardians"("studentId", "userId");
CREATE INDEX "student_guardians_userId_tenantId_idx" ON "student_guardians"("userId", "tenantId");
CREATE INDEX "student_guardians_tenantId_studentId_idx" ON "student_guardians"("tenantId", "studentId");

-- AddForeignKey
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: ogni parentUserId esistente diventa il tutore primario
INSERT INTO "student_guardians" ("id", "tenantId", "studentId", "userId", "isPrimary")
SELECT gen_random_uuid()::text, s."tenantId", s."id", s."parentUserId", true
FROM "students" s
WHERE s."parentUserId" IS NOT NULL
ON CONFLICT ("studentId", "userId") DO NOTHING;

-- DropIndex: via il vincolo "un genitore = un solo figlio"
DROP INDEX IF EXISTS "students_parentUserId_key";

-- Backfill teachers.userId dal match email, solo dove il match è univoco e
-- lo user non è già collegato a un altro docente (userId è UNIQUE globale).
UPDATE "teachers" t
SET "userId" = u."id"
FROM "users" u
WHERE t."userId" IS NULL
  AND lower(u."email") = lower(t."email")
  AND (
    SELECT count(*) FROM "teachers" t3
    WHERE lower(t3."email") = lower(t."email") AND t3."userId" IS NULL
  ) = 1
  AND NOT EXISTS (
    SELECT 1 FROM "teachers" t2 WHERE t2."userId" = u."id"
  );
