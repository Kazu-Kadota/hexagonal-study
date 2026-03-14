-- CreateEnum
CREATE TYPE "Status" AS ENUM ('pending', 'created', 'cancelled');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('brl', 'usd', 'cad', 'eur');

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "Status" NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_id_idx" ON "payments"("id");
