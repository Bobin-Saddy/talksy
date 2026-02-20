// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.email.unseen.jsx
//
//  EMAIL PROVIDER: ZeptoMail (Zoho) — HTTP API, no SMTP ports
//  Already configured with digittrix.com domain ✅
//
//  Railway env vars needed:
//    ZEPTO_API_KEY  = wSsVR61/+Ub0Wqx1nz...  (your existing key)
//    ZEPTO_FROM     = talksy@digittrix.com
//    ADMIN_EMAIL    = harsh@digittrix.com
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers: corsHeaders });

// ── Per-session email timer ────────────────────────────────
const emailTimers = new Map();

// ── Send via ZeptoMail HTTP API ────────────────────────────
async function sendViaZepto({ to, toName, subject, html, text }) {
  const apiKey  = process.env.ZEPTO_API_KEY;
  const fromAddr = process.env.ZEPTO_FROM || "talksy@digittrix.com";

  if (!apiKey) {
    console.error("[Email] ZEPTO_API_KEY not set in Railway env vars");
    return false;
  }

  const response = await fetch("https://api.zeptomail.com/v1.1/email", {
    method : "POST",
    headers: {
      "Accept"       : "application/json",
      "Content-Type" : "application/json",
      "Authorization": `Zoho-enczapikey ${apiKey}`,
    },
    body: JSON.stringify({
      from: { address: fromAddr, name: "Talksy" },
      to  : [{ email_address: { address: to, name: toName || "Admin" } }],
      subject,
      htmlbody: html,
      textbody : text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ZeptoMail error ${response.status}: ${err}`);
  }

  const result = await response.json();
  console.log(`✅ Email sent via ZeptoMail to ${to}`);
  return true;
}

// ── Build email HTML ───────────────────────────────────────
function buildEmailHtml({ displayName, email, messages, shop, shopUrl }) {
  const msgRows = messages.map(m => {
    const time    = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const content = m.fileUrl
      ? `<div style="background:#f8f9fa;border-radius:10px;padding:12px;color:#666;">📷 <em>Image attachment</em></div>`
      : `<div style="background:#f8f9fa;border-radius:10px;padding:12px;color:#1e293b;font-size:15px;line-height:1.5;">${m.message}</div>`;
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <div style="font-size:11px;color:#aaa;margin-bottom:4px;">${time}</div>
          ${content}
        </td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-bottom:6px;">Talksy Chat Notification</div>
                <div style="color:#fff;font-size:22px;font-weight:700;">💬 ${displayName} is waiting for a reply</div>
              </td>
              <td align="right" style="vertical-align:top;">
                <img src="https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png"
                     width="52" height="52" style="border-radius:12px;display:block;" />
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px 40px;">

          <!-- Alert -->
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
            <div style="font-size:14px;color:#9a3412;">
              ⏰ This message has been waiting <strong>over 1 minute</strong> without a reply.
            </div>
          </div>

          <!-- Customer info -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:10px;margin-bottom:24px;">
            <tr>
              <td style="padding:16px 20px;">
                <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Customer</div>
                <div style="font-size:17px;font-weight:700;color:#1e293b;">${displayName}</div>
                ${email ? `<div style="font-size:13px;color:#6366f1;margin-top:2px;">${email}</div>` : ""}
                <div style="font-size:12px;color:#aaa;margin-top:4px;">${shop}</div>
              </td>
            </tr>
          </table>

          <!-- Messages -->
          <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
            Unread Messages (${messages.length})
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${msgRows}
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin-top:32px;">
            <a href="${shopUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:700;font-size:16px;">
              💬 Reply Now
            </a>
          </div>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #eee;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;">
            Automated alert from <strong>Talksy</strong> — Shopify Live Chat<br>
            Customer message was unseen for 1+ minute.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Check unseen and send email ────────────────────────────
async function checkAndSendEmail({ shop, sessionId, adminEmail }) {
  try {
    const session = await prisma.chatSession.findUnique({
      where : { sessionId },
      select: {
        email     : true,
        firstName : true,
        lastName  : true,
        isResolved: true,
        messages  : {
          where  : { sender: "user", seenByAdmin: false },
          orderBy: { createdAt: "asc" },
          select : { id: true, message: true, fileUrl: true, createdAt: true },
        },
      },
    });

    if (!session)              { console.log(`[Email] Session not found: ${sessionId}`); return; }
    if (session.isResolved)    { console.log(`[Email] Session resolved — skip`); return; }
    if (!session.messages?.length) { console.log(`[Email] No unseen messages — admin already read`); return; }

    const displayName = [session.firstName, session.lastName].filter(Boolean).join(" ") || "Customer";
    const shopDomain  = shop.replace(".myshopify.com", "");
    const shopUrl     = `https://admin.shopify.com/store/${shopDomain}/apps/talksy`;
    const textLines   = session.messages.map(m => m.fileUrl ? "📷 [Image]" : m.message).join("\n");

    await sendViaZepto({
      to     : adminEmail,
      toName : "Admin",
      subject: `💬 ${displayName} is waiting — ${session.messages.length} unread message${session.messages.length > 1 ? "s" : ""}`,
      html   : buildEmailHtml({ displayName, email: session.email, messages: session.messages, shop, shopUrl }),
      text   : `${displayName} sent a message that hasn't been replied to:\n\n${textLines}\n\nReply: ${shopUrl}`,
    });

  } catch (err) {
    console.error(`❌ Email error for ${sessionId}:`, err.message);
  }
}

// ── Action ─────────────────────────────────────────────────
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { shop, sessionId } = await request.json();

    if (!shop || !sessionId) {
      return json({ success: false, error: "shop and sessionId required" }, { status: 400, headers: corsHeaders });
    }

    // Get admin email
    let adminEmail = process.env.ADMIN_EMAIL || null;
    try {
      const settings = await prisma.shopSettings.findUnique({
        where : { shop },
        select: { adminEmail: true },
      });
      if (settings?.adminEmail) adminEmail = settings.adminEmail;
    } catch (_) {}

    if (!adminEmail) {
      console.warn(`[Email] No adminEmail for ${shop} — set ADMIN_EMAIL in Railway`);
      return json({ success: false, error: "No admin email configured" }, { headers: corsHeaders });
    }

    // Debounce — reset timer on each new message
    if (emailTimers.has(sessionId)) clearTimeout(emailTimers.get(sessionId));

    const timer = setTimeout(async () => {
      emailTimers.delete(sessionId);
      await checkAndSendEmail({ shop, sessionId, adminEmail });
    }, 60 * 1000); // 1 minute

    emailTimers.set(sessionId, timer);
    console.log(`[Email] 1-min timer started for session ${sessionId}`);

    return json({ success: true, scheduled: true }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ app.email.unseen error:", error);
    return json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
};