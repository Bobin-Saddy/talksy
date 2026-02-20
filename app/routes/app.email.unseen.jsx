// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.email.unseen.jsx
//
//  PLAN-BASED EMAIL DELAY:
//    FREE     → 30 minutes (sent from app.chat.message)
//    STANDARD → 5 minutes
//    PREMIUM  → 1 minute
//
//  The delay is passed as `delayMs` from app.chat.message.jsx
//  so this route doesn't need to know the plan itself.
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

// ── Send via ZeptoMail ─────────────────────────────────────
async function sendViaZepto({ to, toName, subject, html, text }) {
  const apiKey   = process.env.ZEPTO_API_KEY;
  const fromAddr = process.env.ZEPTO_FROM || "talksy@digittrix.com";

  if (!apiKey) {
    console.error("[Email] ZEPTO_API_KEY not set");
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
      from    : { address: fromAddr, name: "Talksy" },
      to      : [{ email_address: { address: to, name: toName || "Admin" } }],
      subject,
      htmlbody: html,
      textbody: text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ZeptoMail error ${response.status}: ${err}`);
  }

  console.log(`✅ Email sent via ZeptoMail to ${to}`);
  return true;
}

// ── Get admin info from DB ─────────────────────────────────
async function getAdminInfo(shop) {
  let adminEmail = process.env.ADMIN_EMAIL || null;
  let adminName  = "Admin";

  try {
    const settings = await prisma.shopSettings.findUnique({
      where : { shop },
      select: { adminEmail: true, adminName: true, shopName: true },
    });
    if (settings?.adminEmail) adminEmail = settings.adminEmail;
    if (settings?.adminName)  adminName  = settings.adminName;
    else if (settings?.shopName) adminName = settings.shopName;
  } catch (_) {}

  return { adminEmail, adminName };
}

// ── Build email HTML ───────────────────────────────────────
function buildEmailHtml({ adminName, customerName, customerEmail, messages, shop, shopUrl, delayLabel }) {
  const msgRows = messages.map(m => {
    const time    = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const content = m.fileUrl
      ? `<div style="background:#f8f9fa;border-radius:10px;padding:12px;color:#666;font-style:italic;">📷 Image attachment</div>`
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

      <tr>
        <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-bottom:6px;">Talksy Chat Notification</div>
                <div style="color:#fff;font-size:22px;font-weight:700;">💬 Hi ${adminName}, ${customerName} is waiting!</div>
              </td>
              <td align="right" style="vertical-align:top;">
                <img src="https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png"
                     width="52" height="52" style="border-radius:12px;display:block;" />
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:32px 40px;">

          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
            <div style="font-size:14px;color:#9a3412;">
              ⏰ <strong>${customerName}</strong> sent a message <strong>${delayLabel} ago</strong> and is still waiting for your reply.
            </div>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:10px;margin-bottom:24px;">
            <tr>
              <td style="padding:16px 20px;">
                <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Customer</div>
                <div style="font-size:17px;font-weight:700;color:#1e293b;">${customerName}</div>
                ${customerEmail ? `<div style="font-size:13px;color:#6366f1;margin-top:2px;">${customerEmail}</div>` : ""}
                <div style="font-size:12px;color:#aaa;margin-top:4px;">${shop}</div>
              </td>
            </tr>
          </table>

          <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
            Unread Messages (${messages.length})
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${msgRows}
          </table>

          <div style="text-align:center;margin-top:32px;">
            <a href="${shopUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:700;font-size:16px;">
              💬 Reply Now
            </a>
          </div>

        </td>
      </tr>

      <tr>
        <td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #eee;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;">
            Automated alert from <strong>Talksy</strong> — Shopify Live Chat<br>
            Customer message was unseen for ${delayLabel}.
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
async function checkAndSendEmail({ shop, sessionId, adminEmail, adminName, delayMs }) {
  try {
    const session = await prisma.chatSession.findUnique({
      where : { sessionId },
      select: {
        email     : true,
        firstName : true,
        lastName  : true,
        isResolved: true,
        messages  : {
          where  : { sender: "user", seenByAdmin: false }, // ✅ only unseen
          orderBy: { createdAt: "asc" },
          select : { id: true, message: true, fileUrl: true, createdAt: true },
        },
      },
    });

    if (!session)                  { console.log(`[Email] Session not found: ${sessionId}`); return; }
    if (session.isResolved)        { console.log(`[Email] Session resolved — skip`); return; }
    if (!session.messages?.length) { console.log(`[Email] All messages already seen — no email sent ✅`); return; }

    const customerName = [session.firstName, session.lastName].filter(Boolean).join(" ") || "Customer";
    const shopDomain   = shop.replace(".myshopify.com", "");
    const shopUrl      = `https://admin.shopify.com/store/${shopDomain}/apps/talksy`;
    const textLines    = session.messages.map(m => m.fileUrl ? "📷 [Image]" : m.message).join("\n");

    // Human-readable delay label for email body
    const delayMin   = Math.round(delayMs / 60000);
    const delayLabel = delayMin >= 60
      ? `${Math.round(delayMin / 60)} hour${delayMin >= 120 ? "s" : ""}`
      : `${delayMin} minute${delayMin > 1 ? "s" : ""}`;

    await sendViaZepto({
      to     : adminEmail,
      toName : adminName,
      subject: `💬 Hi ${adminName}, ${customerName} is waiting — ${session.messages.length} unread message${session.messages.length > 1 ? "s" : ""}`,
      html   : buildEmailHtml({ adminName, customerName, customerEmail: session.email, messages: session.messages, shop, shopUrl, delayLabel }),
      text   : `Hi ${adminName},\n\n${customerName} sent a message ${delayLabel} ago with no reply:\n\n${textLines}\n\nReply: ${shopUrl}`,
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
    const { shop, sessionId, delayMs } = await request.json();

    if (!shop || !sessionId) {
      return json({ success: false, error: "shop and sessionId required" }, { status: 400, headers: corsHeaders });
    }

    // Validate delay — default to 30 min if missing
    const resolvedDelay = (typeof delayMs === "number" && delayMs > 0)
      ? delayMs
      : 30 * 60 * 1000;

    const { adminEmail, adminName } = await getAdminInfo(shop);
    if (!adminEmail) {
      console.warn(`[Email] No adminEmail for ${shop}`);
      return json({ success: false, error: "No admin email configured" }, { headers: corsHeaders });
    }

    // Debounce — reset timer on rapid messages
    if (emailTimers.has(sessionId)) clearTimeout(emailTimers.get(sessionId));

    const delayMin = Math.round(resolvedDelay / 60000);
    const timer = setTimeout(async () => {
      emailTimers.delete(sessionId);
      await checkAndSendEmail({ shop, sessionId, adminEmail, adminName, delayMs: resolvedDelay });
    }, resolvedDelay);

    emailTimers.set(sessionId, timer);
    console.log(`[Email] Timer set — session: ${sessionId}, delay: ${delayMin} min, admin: ${adminEmail}`);

    return json({ success: true, scheduled: true, delayMin }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ app.email.unseen error:", error);
    return json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
};