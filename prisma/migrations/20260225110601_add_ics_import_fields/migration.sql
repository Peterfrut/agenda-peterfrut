/*
  Warnings:

  - A unique constraint covering the columns `[provider,externalId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalSource" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Booking_roomId_date_idx" ON "Booking"("roomId", "date");

-- CreateIndex
CREATE INDEX "Booking_provider_idx" ON "Booking"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_provider_externalId_key" ON "Booking"("provider", "externalId");
