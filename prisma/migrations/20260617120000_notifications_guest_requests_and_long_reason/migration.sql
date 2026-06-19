ALTER TABLE "public"."Booking" ADD COLUMN "longReason" TEXT;

ALTER TABLE "public"."User" ADD COLUMN "lastSeenReleaseAt" TIMESTAMP(3);

CREATE TABLE "public"."BookingChangeRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "requestedDate" TEXT,
    "requestedStartTime" TEXT,
    "requestedEndTime" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BookingChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingChangeRequest_bookingId_idx" ON "public"."BookingChangeRequest"("bookingId");
CREATE INDEX "BookingChangeRequest_requesterId_createdAt_idx" ON "public"."BookingChangeRequest"("requesterId", "createdAt");
CREATE INDEX "BookingChangeRequest_requesterEmail_createdAt_idx" ON "public"."BookingChangeRequest"("requesterEmail", "createdAt");
CREATE INDEX "BookingChangeRequest_status_createdAt_idx" ON "public"."BookingChangeRequest"("status", "createdAt");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "public"."Notification"("userId", "readAt", "createdAt");

ALTER TABLE "public"."BookingChangeRequest"
ADD CONSTRAINT "BookingChangeRequest_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."BookingChangeRequest"
ADD CONSTRAINT "BookingChangeRequest_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."Notification"
ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
