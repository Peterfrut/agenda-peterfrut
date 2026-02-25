-- DropIndex
DROP INDEX "Booking_provider_idx";

-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'confirmed';
