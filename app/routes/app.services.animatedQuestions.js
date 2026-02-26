// ═══════════════════════════════════════════════════════════════
//  Talksy — Animated Questions Service (ES Module)
//  File: app/services/animatedQuestions.js
//
//  ✅ ES Module syntax (import/export) — works with "type":"module"
//  ✅ No require() — no CommonJS
//
//  Yeh ek SERVICE file hai. Ishe apne Remix/React Router
//  route loader/action files mein import karo.
// ═══════════════════════════════════════════════════════════════

import prisma from "../db.server.js";

// ── Helper: Admin ko notify karo ────────────────────────────
async function notifyAdmin(shop, payload) {
  try {
    console.log(`[AQ] Admin notification for shop: ${shop}`, payload);
    // Apni existing FCM/push logic yahan call karo
  } catch (e) {
    console.error("[AQ] notifyAdmin error:", e.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  GET — Questions + Settings fetch karo
// ─────────────────────────────────────────────────────────────
export async function getAnimatedQuestions(shop, isAdmin = false) {
  const whereClause = isAdmin ? { shop } : { shop, isActive: true };

  const [questions, settings] = await Promise.all([
    prisma.animatedQuestion.findMany({
      where  : whereClause,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.animatedQuestionSettings.findUnique({ where: { shop } }),
  ]);

  return {
    success: true,
    questions,
    settings: settings || {
      enabled: true, maxVisible: 3, showDelay: 2000,
      autoHide: true, autoHideDelay: 8000,
    },
  };
}

// ─────────────────────────────────────────────────────────────
//  POST — Naya question create karo
// ─────────────────────────────────────────────────────────────
export async function createAnimatedQuestion({
  shop, text, icon = "💬", category = "general",
  animationType = "float", displayOrder = 0,
  isActive = true, defaultAnswer = null,
}) {
  if (!shop)         throw new Error("shop is required");
  if (!text?.trim()) throw new Error("text is required");

  const question = await prisma.animatedQuestion.create({
    data: {
      shop,
      text         : text.trim().substring(0, 80),
      icon,
      category,
      animationType,
      displayOrder : Number(displayOrder) || 0,
      isActive     : Boolean(isActive),
      defaultAnswer: defaultAnswer?.trim() || null,
    },
  });
  return { success: true, question };
}

// ─────────────────────────────────────────────────────────────
//  PUT — Existing question update karo
// ─────────────────────────────────────────────────────────────
export async function updateAnimatedQuestion(id, shop, fields) {
  if (!shop) throw new Error("shop is required");

  const existing = await prisma.animatedQuestion.findUnique({ where: { id } });
  if (!existing)              throw new Error("Question not found");
  if (existing.shop !== shop) throw new Error("Forbidden");

  const { text, icon, category, animationType, displayOrder, isActive, defaultAnswer } = fields;

  const updated = await prisma.animatedQuestion.update({
    where: { id },
    data: {
      ...(text          !== undefined && { text         : text.trim().substring(0, 80) }),
      ...(icon          !== undefined && { icon }),
      ...(category      !== undefined && { category }),
      ...(animationType !== undefined && { animationType }),
      ...(displayOrder  !== undefined && { displayOrder : Number(displayOrder) }),
      ...(isActive      !== undefined && { isActive     : Boolean(isActive) }),
      ...(defaultAnswer !== undefined && { defaultAnswer: defaultAnswer?.trim() || null }),
      updatedAt: new Date(),
    },
  });
  return { success: true, question: updated };
}

// ─────────────────────────────────────────────────────────────
//  DELETE — Question delete karo
// ─────────────────────────────────────────────────────────────
export async function deleteAnimatedQuestion(id, shop) {
  if (!shop) throw new Error("shop is required");

  const existing = await prisma.animatedQuestion.findUnique({ where: { id } });
  if (!existing)              throw new Error("Question not found");
  if (existing.shop !== shop) throw new Error("Forbidden");

  await prisma.animatedQuestion.delete({ where: { id } });
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
//  POST — Global settings save/update karo (upsert)
// ─────────────────────────────────────────────────────────────
export async function saveAnimatedQuestionSettings(shop, settings) {
  if (!shop || !settings) throw new Error("shop and settings are required");

  const {
    enabled = true, maxVisible = 3, showDelay = 2000,
    autoHide = true, autoHideDelay = 8000,
  } = settings;

  const saved = await prisma.animatedQuestionSettings.upsert({
    where : { shop },
    update: {
      enabled,
      maxVisible   : Number(maxVisible),
      showDelay    : Number(showDelay),
      autoHide,
      autoHideDelay: Number(autoHideDelay),
      updatedAt    : new Date(),
    },
    create: {
      shop, enabled,
      maxVisible   : Number(maxVisible),
      showDelay    : Number(showDelay),
      autoHide,
      autoHideDelay: Number(autoHideDelay),
    },
  });
  return { success: true, settings: saved };
}

// ─────────────────────────────────────────────────────────────
//  Analytics — Click track karo
// ─────────────────────────────────────────────────────────────
export async function trackQuestionClick(id) {
  try {
    await prisma.animatedQuestion.update({
      where: { id },
      data : { clickCount: { increment: 1 } },
    });
    return { success: true };
  } catch (_) { return { success: false }; }
}

// ─────────────────────────────────────────────────────────────
//  Analytics — Dismiss track karo
// ─────────────────────────────────────────────────────────────
export async function trackQuestionDismiss(id) {
  try {
    await prisma.animatedQuestion.update({
      where: { id },
      data : { dismissCount: { increment: 1 } },
    });
    return { success: true };
  } catch (_) { return { success: false }; }
}

// ─────────────────────────────────────────────────────────────
//  Message send karo + optional auto-reply
//  Apni existing /app/chat/message route mein is function ko
//  call karo ya sirf autoReply block wahan paste karo.
// ─────────────────────────────────────────────────────────────
export async function sendMessageWithAutoReply({
  sessionId, shop, message, fileUrl = null,
  email, fname, triggerPush = false,
  autoReply = null, questionId = null,
}) {
  if (!sessionId || !shop) throw new Error("sessionId and shop are required");

  // 1. User message save karo
  await prisma.chatMessage.create({
    data: {
      sessionId, shop,
      message  : message || "",
      fileUrl,
      sender   : "user",
      createdAt: new Date(),
    },
  });

  // 2. Auto-reply check
  if (autoReply && autoReply.trim().length > 0) {
    // Admin ne defaultAnswer set kiya — bot auto reply karega
    await new Promise((r) => setTimeout(r, 800));

    await prisma.chatMessage.create({
      data: {
        sessionId, shop,
        message  : autoReply.trim(),
        fileUrl  : null,
        sender   : "bot",
        createdAt: new Date(),
      },
    });

    await notifyAdmin(shop, {
      type: "animated_question_auto_replied",
      sessionId, email, fname,
      question: message, autoReply, questionId,
    });
  } else {
    // Admin manually reply karega
    if (triggerPush || questionId) {
      await notifyAdmin(shop, {
        type      : questionId ? "animated_question_clicked" : "new_message",
        sessionId, email, fname, message, questionId,
      });
    }
  }

  return { success: true };
}