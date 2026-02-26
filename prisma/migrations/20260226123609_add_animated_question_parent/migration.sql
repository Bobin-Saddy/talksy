-- AlterTable
ALTER TABLE "AnimatedQuestion" ADD COLUMN     "parentId" TEXT,
ALTER COLUMN "text" SET DATA TYPE VARCHAR(120);

-- CreateIndex
CREATE INDEX "AnimatedQuestion_shop_parentId_idx" ON "AnimatedQuestion"("shop", "parentId");

-- AddForeignKey
ALTER TABLE "AnimatedQuestion" ADD CONSTRAINT "AnimatedQuestion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AnimatedQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
