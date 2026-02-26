// ═══════════════════════════════════════════════════════════════
//  Talksy — Animated Questions Backend
//  File: routes/animatedQuestions.js
//
//  Mount in your main server.js:
//    const animatedQuestionsRouter = require('./routes/animatedQuestions');
//    app.use('/', animatedQuestionsRouter);
// ═══════════════════════════════════════════════════════════════

const express    = require('express');
const router     = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma     = new PrismaClient();

// ── Helper: send push notification to admin ──────────────────
// Replace this with your existing push/notification logic
async function notifyAdmin(shop, payload) {
  try {
    // Find all FCM tokens for admin of this shop
    // (Adjust based on how your admin push tokens are stored)
    const tokens = await prisma.fcmToken.findMany({
      where: { shop, email: { contains: 'admin' } }
    });
    // Fire-and-forget to your existing push endpoint
    // await sendFCMToTokens(tokens, payload);
    console.log(`[AQ] Admin notified for shop: ${shop}`, payload);
  } catch (e) {
    console.error('[AQ] notifyAdmin error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/animated-questions
//  Public — used by frontend widget to fetch active questions
//  Query: shop (required), admin=true (optional, returns all)
// ─────────────────────────────────────────────────────────────
router.get('/api/animated-questions', async (req, res) => {
  const { shop, admin } = req.query;
  if (!shop) return res.status(400).json({ error: 'shop is required' });

  try {
    const whereClause = admin === 'true'
      ? { shop }                        // admin panel: return all
      : { shop, isActive: true };       // widget: return only active

    const [questions, settings] = await Promise.all([
      prisma.animatedQuestion.findMany({
        where  : whereClause,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.animatedQuestionSettings.findUnique({
        where: { shop }
      }),
    ]);

    return res.json({
      success: true,
      questions,
      settings: settings || {
        enabled      : true,
        maxVisible   : 3,
        showDelay    : 2000,
        autoHide     : true,
        autoHideDelay: 8000,
      },
    });
  } catch (err) {
    console.error('[AQ] GET /api/animated-questions error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/animated-questions
//  Admin — create a new animated question
// ─────────────────────────────────────────────────────────────
router.post('/api/animated-questions', async (req, res) => {
  const {
    shop,
    text,
    icon          = '💬',
    category      = 'general',
    animationType = 'float',
    displayOrder  = 0,
    isActive      = true,
    defaultAnswer,
  } = req.body;

  if (!shop)        return res.status(400).json({ error: 'shop is required' });
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  try {
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

    return res.status(201).json({ success: true, question });
  } catch (err) {
    console.error('[AQ] POST /api/animated-questions error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
//  PUT /api/animated-questions/:id
//  Admin — update an existing animated question
// ─────────────────────────────────────────────────────────────
router.put('/api/animated-questions/:id', async (req, res) => {
  const { id } = req.params;
  const {
    shop,
    text,
    icon,
    category,
    animationType,
    displayOrder,
    isActive,
    defaultAnswer,
  } = req.body;

  if (!shop) return res.status(400).json({ error: 'shop is required' });

  try {
    // Verify question belongs to this shop
    const existing = await prisma.animatedQuestion.findUnique({ where: { id } });
    if (!existing)           return res.status(404).json({ error: 'Question not found' });
    if (existing.shop !== shop) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.animatedQuestion.update({
      where: { id },
      data : {
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

    return res.json({ success: true, question: updated });
  } catch (err) {
    console.error('[AQ] PUT /api/animated-questions/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
//  DELETE /api/animated-questions/:id
//  Admin — delete an animated question
// ─────────────────────────────────────────────────────────────
router.delete('/api/animated-questions/:id', async (req, res) => {
  const { id }   = req.params;
  const { shop } = req.body;

  if (!shop) return res.status(400).json({ error: 'shop is required' });

  try {
    const existing = await prisma.animatedQuestion.findUnique({ where: { id } });
    if (!existing)           return res.status(404).json({ error: 'Question not found' });
    if (existing.shop !== shop) return res.status(403).json({ error: 'Forbidden' });

    await prisma.animatedQuestion.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error('[AQ] DELETE /api/animated-questions/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/animated-questions/settings
//  Admin — save or update global display settings
// ─────────────────────────────────────────────────────────────
router.post('/api/animated-questions/settings', async (req, res) => {
  const { shop, settings } = req.body;
  if (!shop || !settings) return res.status(400).json({ error: 'shop and settings are required' });

  const {
    enabled       = true,
    maxVisible    = 3,
    showDelay     = 2000,
    autoHide      = true,
    autoHideDelay = 8000,
  } = settings;

  try {
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
        shop,
        enabled,
        maxVisible   : Number(maxVisible),
        showDelay    : Number(showDelay),
        autoHide,
        autoHideDelay: Number(autoHideDelay),
      },
    });

    return res.json({ success: true, settings: saved });
  } catch (err) {
    console.error('[AQ] POST /api/animated-questions/settings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/animated-questions/:id/click
//  Frontend — increment click counter (analytics)
// ─────────────────────────────────────────────────────────────
router.post('/api/animated-questions/:id/click', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.animatedQuestion.update({
      where: { id },
      data : { clickCount: { increment: 1 } },
    });
    return res.json({ success: true });
  } catch (err) {
    // Non-critical — don't break the user flow
    return res.json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/animated-questions/:id/dismiss
//  Frontend — increment dismiss counter (analytics)
// ─────────────────────────────────────────────────────────────
router.post('/api/animated-questions/:id/dismiss', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.animatedQuestion.update({
      where: { id },
      data : { dismissCount: { increment: 1 } },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────
//  POST /app/chat/message  (MODIFIED version with autoReply)
//
//  ⚠️  This replaces your EXISTING /app/chat/message route.
//  Copy only the autoReply block into your existing handler.
// ─────────────────────────────────────────────────────────────
router.post('/app/chat/message-with-autoreply', async (req, res) => {
  const {
    sessionId,
    shop,
    message,
    fileUrl     = null,
    email,
    fname,
    triggerPush = false,
    // ── NEW fields from animated question click ──
    autoReply   = null,   // string | null
    questionId  = null,   // string | null
  } = req.body;

  if (!sessionId || !shop) {
    return res.status(400).json({ error: 'sessionId and shop are required' });
  }

  try {
    // 1. Save the user's message (same as your existing logic)
    await prisma.chatMessage.create({
      data: {
        sessionId,
        shop,
        message : message || '',
        fileUrl,
        sender  : 'user',
        createdAt: new Date(),
      },
    });

    // 2. Auto-reply logic ─────────────────────────────────────
    if (autoReply && autoReply.trim().length > 0) {
      //
      // ✅ defaultAnswer was set by admin — send bot reply automatically
      //    Small delay (800ms) makes it feel natural
      //
      await new Promise(r => setTimeout(r, 800));

      await prisma.chatMessage.create({
        data: {
          sessionId,
          shop,
          message  : autoReply.trim(),
          fileUrl  : null,
          sender   : 'bot',
          createdAt: new Date(),
        },
      });

      // Still notify admin (they can follow up if needed)
      await notifyAdmin(shop, {
        type      : 'animated_question_auto_replied',
        sessionId,
        email,
        fname,
        question  : message,
        autoReply,
        questionId,
      });

    } else {
      //
      // ✅ No defaultAnswer — notify admin to reply manually
      //
      if (triggerPush || questionId) {
        await notifyAdmin(shop, {
          type      : questionId ? 'animated_question_clicked' : 'new_message',
          sessionId,
          email,
          fname,
          message,
          questionId,
        });
      }
    }
    // ─────────────────────────────────────────────────────────

    return res.json({ success: true });
  } catch (err) {
    console.error('[AQ] POST /app/chat/message error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;