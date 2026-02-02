-- AlterTable
ALTER TABLE "SearchLog" ADD COLUMN "firstName" TEXT;
ALTER TABLE "SearchLog" ADD COLUMN "lastName" TEXT;
ALTER TABLE "SearchLog" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "SearchLog" ADD COLUMN "userEmail" TEXT;

-- CreateIndex
CREATE INDEX "SearchLog_searchType_idx" ON "SearchLog"("searchType");
