/*
  Warnings:

  - Changed the type of `currency` on the `orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Status" AS ENUM ('pending', 'created', 'cancelled');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('brl', 'usd', 'cad', 'eur');

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "currency",
ADD COLUMN     "currency" "Currency" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "Status" NOT NULL;
