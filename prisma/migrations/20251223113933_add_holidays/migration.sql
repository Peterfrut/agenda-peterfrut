-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "roomId" TEXT,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Holiday_roomId_date_idx" ON "Holiday"("roomId", "date");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");
