-- Wave 4: lead persistenti dal form contatti pubblico
CREATE TABLE "contact_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "school" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'it',
    "source" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contact_requests_createdAt_idx" ON "contact_requests"("createdAt");
CREATE INDEX "contact_requests_handledAt_idx" ON "contact_requests"("handledAt");
