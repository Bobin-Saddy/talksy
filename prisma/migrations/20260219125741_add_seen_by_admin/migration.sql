-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatSessionId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("sessionId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("chatSessionId", "createdAt", "fileType", "fileUrl", "id", "message", "sender") SELECT "chatSessionId", "createdAt", "fileType", "fileUrl", "id", "message", "sender" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_chatSessionId_idx" ON "ChatMessage"("chatSessionId");
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
