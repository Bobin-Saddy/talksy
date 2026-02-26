// ═══════════════════════════════════════════════════════════════
//  File: app/services/animatedQuestions.js
//  ✅ UPDATED: parentId support added in create/update/get
// ═══════════════════════════════════════════════════════════════

import prisma from "./db.server.js";

async function notifyAdmin(shop, payload) {
  try {
    console.log(`[AQ] Admin notification → shop: ${shop}`, payload);
  } catch (e) {
    console.error("[AQ] notifyAdmin error:", e.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  GET questions + settings
//  Widget ke liye: sirf parentId=null wale bubbles + unke children
// ─────────────────────────────────────────────────────────────
export async function getAnimatedQuestions(shop, isAdmin = false) {
  const whereClause = isAdmin
    ? { shop }
    : { shop, isActive: true };

  const [allQuestions, settings] = await Promise.all([
    prisma.animatedQuestion.findMany({
      where  : whereClause,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      // ✅ Select parentId so frontend can build parent→children map
      select : {
        id           : true,
        shop         : true,
        text         : true,
        icon         : true,
        category     : true,
        animationType: true,
        displayOrder : true,
        isActive     : true,
        defaultAnswer: true,
        parentId     : true,   // ✅ KEY FIELD
        clickCount   : true,
        dismissCount : true,
        createdAt    : true,
        updatedAt    : true,
      },
    }),
    prisma.animatedQuestionSettings.findUnique({ where: { shop } }),
  ]);

  return {
    success  : true,
    questions: allQuestions,   // flat list — parentId field se frontend grouping karega
    settings : settings || {
      enabled: true, maxVisible: 3, showDelay: 2000,
      autoHide: false, autoHideDelay: 8000,
    },
  };
}

// ─────────────────────────────────────────────────────────────
//  CREATE question (parent or child)
// ─────────────────────────────────────────────────────────────
export async function createAnimatedQuestion({
  shop, text, icon = "💬", category = "general",
  animationType = "float", displayOrder = 0,
  isActive = true, defaultAnswer = null,
  parentId = null,   // ✅ null = parent bubble, string = child chip
}) {
  if (!shop)         throw new Error("shop is required");
  if (!text?.trim()) throw new Error("text is required");

  // If parentId given, verify it exists and belongs to same shop
  if (parentId) {
    const parent = await prisma.animatedQuestion.findUnique({ where: { id: parentId } });
    if (!parent)              throw new Error("Parent question not found");
    if (parent.shop !== shop) throw new Error("Forbidden");
    // Prevent nesting children under children (only 1 level deep)
    if (parent.parentId)      throw new Error("Cannot nest children under a child question");
  }

  const question = await prisma.animatedQuestion.create({
    data: {
      shop,
      text         : text.trim().substring(0, 120),
      icon,
      category,
      animationType,
      displayOrder : Number(displayOrder) || 0,
      isActive     : Boolean(isActive),
      defaultAnswer: defaultAnswer?.trim() || null,
      parentId     : parentId || null,  // ✅
    },
  });
  return { success: true, question };
}

// ─────────────────────────────────────────────────────────────
//  UPDATE question
// ─────────────────────────────────────────────────────────────
export async function updateAnimatedQuestion(id, shop, fields) {
  if (!shop) throw new Error("shop is required");

  const existing = await prisma.animatedQuestion.findUnique({ where: { id } });
  if (!existing)              throw new Error("Question not found");
  if (existing.shop !== shop) throw new Error("Forbidden");

  const {
    text, icon, category, animationType,
    displayOrder, isActive, defaultAnswer, parentId,
  } = fields;

  const updated = await prisma.animatedQuestion.update({
    where: { id },
    data : {
      ...(text          !== undefined && { text         : text.trim().substring(0, 120) }),
      ...(icon          !== undefined && { icon }),
      ...(category      !== undefined && { category }),
      ...(animationType !== undefined && { animationType }),
      ...(displayOrder  !== undefined && { displayOrder : Number(displayOrder) }),
      ...(isActive      !== undefined && { isActive     : Boolean(isActive) }),
      ...(defaultAnswer !== undefined && { defaultAnswer: defaultAnswer?.trim() || null }),
      ...(parentId      !== undefined && { parentId     : parentId || null }),  // ✅
      updatedAt: new Date(),
    },
  });
  return { success: true, question: updated };
}

// ─────────────────────────────────────────────────────────────
//  DELETE question (children auto-delete via onDelete: Cascade)
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
//  UPSERT global settings
// ─────────────────────────────────────────────────────────────
export async function saveAnimatedQuestionSettings(shop, settings) {
  if (!shop || !settings) throw new Error("shop and settings are required");

  const {
    enabled = true, maxVisible = 3, showDelay = 2000,
    autoHide = false, autoHideDelay = 8000,
  } = settings;

  const saved = await prisma.animatedQuestionSettings.upsert({
    where : { shop },
    update: { enabled, maxVisible: Number(maxVisible), showDelay: Number(showDelay), autoHide, autoHideDelay: Number(autoHideDelay), updatedAt: new Date() },
    create: { shop, enabled, maxVisible: Number(maxVisible), showDelay: Number(showDelay), autoHide, autoHideDelay: Number(autoHideDelay) },
  });
  return { success: true, settings: saved };
}

// ─────────────────────────────────────────────────────────────
//  ANALYTICS
// ─────────────────────────────────────────────────────────────
export async function trackQuestionClick(id) {
  try {
    await prisma.animatedQuestion.update({ where: { id }, data: { clickCount: { increment: 1 } } });
    return { success: true };
  } catch (_) { return { success: false }; }
}

export async function trackQuestionDismiss(id) {
  try {
    await prisma.animatedQuestion.update({ where: { id }, data: { dismissCount: { increment: 1 } } });
    return { success: true };
  } catch (_) { return { success: false }; }
}

// ─────────────────────────────────────────────────────────────
//  SEND MESSAGE with auto-reply
// ─────────────────────────────────────────────────────────────
export async function sendMessageWithAutoReply({
  sessionId, shop, message, fileUrl = null,
  email, fname, autoReply = null, questionId = null,
}) {
  if (!sessionId || !shop) throw new Error("sessionId and shop are required");

  await prisma.chatMessage.create({
    data: {
      message  : message || "",
      fileUrl,
      sender   : "user",
      seenByAdmin: false,
      session  : { connect: { sessionId } },
    },
  });

  const replyText = autoReply?.trim() ||
    "Thanks for reaching out! Our team will get back to you shortly. 👋";

  await new Promise((r) => setTimeout(r, 800));

  await prisma.chatMessage.create({
    data: {
      message: replyText,
      sender : "bot",
      session: { connect: { sessionId } },
    },
  });

  if (questionId) {
    prisma.animatedQuestion.update({
      where: { id: questionId },
      data : { clickCount: { increment: 1 } },
    }).catch(() => {});
  }

  await notifyAdmin(shop, { type: "animated_question", sessionId, email, fname, message, autoReply, questionId });
  return { success: true };
}