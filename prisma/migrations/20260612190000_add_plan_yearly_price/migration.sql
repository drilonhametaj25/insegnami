-- Prezzo annuale per piano (12 mesi al prezzo di 10, 2 mesi gratis):
-- popolato dalla sync Stripe (lib/billing/stripe-sync.ts), null in dev billing.
ALTER TABLE "plans" ADD COLUMN "stripeYearlyPriceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "plans_stripeYearlyPriceId_key" ON "plans"("stripeYearlyPriceId");
