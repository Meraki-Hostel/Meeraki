-- Push notifications for the mobile app.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "pushedAt" TIMESTAMP(3);

-- Notifications written before push existed must never be pushed.
UPDATE "Notification" SET "pushedAt" = "createdAt";

-- CreateIndex
CREATE INDEX "Notification_pushedAt_createdAt_idx" ON "Notification"("pushedAt", "createdAt");

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Device_platform" CHECK ("platform" IN ('ios', 'android'))
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_pushToken_key" ON "Device"("pushToken");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
