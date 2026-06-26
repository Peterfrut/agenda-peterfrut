CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "actorId" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_category_createdAt_idx" ON "AuditLog"("category", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_actorEmail_createdAt_idx" ON "AuditLog"("actorEmail", "createdAt");
CREATE INDEX "AuditLog_targetType_createdAt_idx" ON "AuditLog"("targetType", "createdAt");
