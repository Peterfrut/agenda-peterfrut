-- Allow identical ICS UIDs to exist in different room calendars.
DROP INDEX IF EXISTS "Booking_provider_externalId_key";

CREATE UNIQUE INDEX "Booking_provider_roomId_externalId_key"
ON "Booking"("provider", "roomId", "externalId");
