// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.email.unseen.jsx
//
//  PURPOSE: Send email to admin when user message is unseen
//           for more than 1 minute.
//
//  HOW IT WORKS:
//  1. app.chat.message.jsx calls this after saving message
//  2. This route sets a 1-minute timer per session
//  3. After 1 min, checks if admin has seen the message
//  4. If NOT seen → sends email via nodemailer
//  5. If timer already running for this session → skips (debounce)
//
//  SETUP: Add these env vars to Railway:
//    SMTP_HOST     = smtp.gmail.com (or your provider)
//    SMTP_PORT     = 587
//    SMTP_USER     = your-email@gmail.com
//    SMTP_PASS     = your-app-password (Gmail App Password)
//    ADMIN_EMAIL   = admin@yourstore.com (who receives the email)
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import prisma from "../db.server";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const corsHeaders = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers: corsHeaders });

// ── Per-session email timer map ────────────────────────────
// Prevents duplicate emails for rapid messages in same session
const emailTimers = new Map();

// ── Nodemailer transporter (lazy init) ────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  try {
    const nodemailer = require("nodemailer");
    _transporter = nodemailer.createTransport({
      host  : process.env.SMTP_HOST || "smtp.gmail.com",
      port  : parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth  : {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log("✅ Email transporter ready");
    return _transporter;
  } catch (err) {
    console.error("❌ Nodemailer init error:", err.message);
    return null;
  }
}

// ── Build email HTML ───────────────────────────────────────
function buildEmailHtml({ displayName, email, messages, shop, sessionId, shopUrl }) {
  const msgRows = messages.map(m => {
    const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (m.fileUrl) {
      return `
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #f0f0f0;">
            <div style="font-size:12px;color:#888;margin-bottom:4px;">${time}</div>
            <div style="background:#f8f9fa;border-radius:10px;padding:12px;display:inline-block;">
              📷 <em>Image</em>
            </div>
          </td>
        </tr>`;
    }
    return `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #f0f0f0;">
          <div style="font-size:12px;color:#888;margin-bottom:4px;">${time}</div>
          <div style="background:#f8f9fa;border-radius:10px;padding:12px;color:#1e293b;font-size:15px;line-height:1.5;">${m.message}</div>
        </td>
      </tr>`;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
            <table width="100%">
              <tr>
                <td>
                  <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-bottom:4px;">Talksy Chat</div>
                  <div style="color:#fff;font-size:22px;font-weight:700;">💬 Unread message from ${displayName}</div>
                </td>
                <td align="right">
                  <img src="https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png"
                       width="52" height="52" style="border-radius:12px;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <!-- Alert banner -->
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:14px;color:#9a3412;">
              ⏰ This message has been waiting for a reply for over <strong>1 minute</strong>. Reply now to keep your customer happy!
            </div>

            <!-- Customer info -->
            <table width="100%" style="background:#f8f9fa;border-radius:10px;margin-bottom:24px;" cellpadding="12" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#888;padding-bottom:4px;">Customer</td>
              </tr>
              <tr>
                <td style="font-size:16px;font-weight:600;color:#1e293b;padding-top:0;">${displayName}</td>
              </tr>
              ${email ? `<tr><td style="font-size:13px;color:#6366f1;padding-top:0;">${email}</td></tr>` : ""}
              <tr>
                <td style="font-size:12px;color:#aaa;padding-top:4px;">Shop: ${shop}</td>
              </tr>
            </table>

            <!-- Messages -->
            <div style="font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
              Unread Messages
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${msgRows}
            </table>

            <!-- CTA button -->
            <div style="text-align:center;margin-top:32px;">
              <a href="${shopUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.2px;">
                💬 Reply Now
              </a>
            </div>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              This is an automated alert from <strong>Talksy</strong> — the Shopify live chat app.<br>
              You're receiving this because you have unseen customer messages.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Core: check unseen and send email ─────────────────────
async function checkAndSendEmail({ shop, sessionId, adminEmail }) {
  try {
    // Get session with unseen user messages
    const session = await prisma.chatSession.findUnique({
      where : { sessionId },
      select: {
        email    : true,
        firstName: true,
        lastName : true,
        isResolved: true,
        messages : {
          where  : { sender: "user", seenByAdmin: false },
          orderBy: { createdAt: "asc" },
          select : { id: true, message: true, fileUrl: true, createdAt: true },
        },
      },
    });

    if (!session) { console.log(`[Email] Session not found: ${sessionId}`); return; }
    if (session.isResolved) { console.log(`[Email] Session resolved — skip`); return; }
    if (!session.messages || session.messages.length === 0) {
      console.log(`[Email] No unseen messages for ${sessionId} — admin already read them`);
      return;
    }

    const transporter = getTransporter();
    if (!transporter) { console.error("[Email] No transporter — check SMTP env vars"); return; }

    const displayName = [session.firstName, session.lastName].filter(Boolean).join(" ") || "Customer";
    const shopDomain  = shop.replace(".myshopify.com", "");
    const shopUrl     = `https://admin.shopify.com/store/${shopDomain}/apps/talksy`;

    const html = buildEmailHtml({
      displayName,
      email    : session.email,
      messages : session.messages,
      shop,
      sessionId,
      shopUrl,
    });

    // Plain text fallback
    const textLines = session.messages.map(m => m.fileUrl ? "📷 [Image]" : m.message).join("\n");
    const text = `Unread message from ${displayName} (${session.email || shop})\n\n${textLines}\n\nReply: ${shopUrl}`;

    await transporter.sendMail({
      from   : `"Talksy Alerts" <${process.env.SMTP_USER}>`,
      to     : adminEmail,
      subject: `💬 Unread message from ${displayName} — ${shop}`,
      html,
      text,
    });

    console.log(`✅ Unseen email sent → ${adminEmail} for session ${sessionId} (${session.messages.length} messages)`);

  } catch (err) {
    console.error(`❌ Email send error for ${sessionId}:`, err.message);
  }
}

// ── Action ─────────────────────────────────────────────────
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { shop, sessionId, displayName, userMessage } = await request.json();

    if (!shop || !sessionId) {
      return json({ success: false, error: "shop and sessionId required" }, { status: 400, headers: corsHeaders });
    }

    // Get admin email from DB (ShopSettings or env fallback)
    let adminEmail = process.env.ADMIN_EMAIL || null;
    try {
      const settings = await prisma.shopSettings.findUnique({
        where : { shop },
        select: { adminEmail: true },
      });
      if (settings?.adminEmail) adminEmail = settings.adminEmail;
    } catch (_) {
      // ShopSettings may not have adminEmail field — use env var
    }

    if (!adminEmail) {
      console.warn(`[Email] No adminEmail for ${shop} — set ADMIN_EMAIL env var or add to ShopSettings`);
      return json({ success: false, error: "No admin email configured" }, { headers: corsHeaders });
    }

    // Debounce: if timer already running for this session, cancel and restart
    // (handles rapid messages — only one email per session per minute)
    if (emailTimers.has(sessionId)) {
      clearTimeout(emailTimers.get(sessionId));
      console.log(`[Email] Timer reset for session ${sessionId}`);
    }

    // Set 1-minute timer
    const timer = setTimeout(async () => {
      emailTimers.delete(sessionId);
      await checkAndSendEmail({ shop, sessionId, adminEmail });
    }, 60 * 1000); // 60 seconds

    emailTimers.set(sessionId, timer);
    console.log(`[Email] 1-min timer started for session ${sessionId}`);

    return json({ success: true, scheduled: true }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ app.email.unseen error:", error);
    return json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
};