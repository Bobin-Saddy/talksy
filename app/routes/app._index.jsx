import { json } from "@remix-run/node";
import { useLoaderData, Form } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/* ---------------- LOADER ---------------- */
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Date range: last 3 days
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 3);

  const totalConversations = await prisma.chatSession.count({
    where: {
      shop,
      createdAt: { gte: fromDate },
    },
  });

  const totalMessages = await prisma.chatMessage.count({
    where: {
      session: { shop },
      createdAt: { gte: fromDate },
    },
  });

  const resolvedChats = await prisma.chatSession.count({
    where: {
      shop,
      messages: {
        some: {
          sender: "admin",
        },
      },
    },
  });

  const resolutionRate =
    totalConversations === 0
      ? 0
      : Math.round((resolvedChats / totalConversations) * 100);

  const recentChats = await prisma.chatSession.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { messages: true },
  });

  // Fake business metrics for now (you can connect orders later)
  const assistedRevenue = 0;
  const chatToSalesRate = 0;
  const salesShare = 0;

  // Setup checklist logic
  const hasChat = totalConversations > 0;
  const hasFaq = await prisma.faq.count({ where: { shop } }) > 0;
  const hasSettings = await prisma.chatSettings.findUnique({ where: { shop } });

  const completedSteps = [hasChat, hasFaq, hasSettings].filter(Boolean).length;

  return json({
    totalConversations,
    resolutionRate,
    assistedRevenue,
    chatToSalesRate,
    salesShare,
    recentChats,
    completedSteps,
  });
}

/* ---------------- PAGE ---------------- */
export default function ChatAnalytics() {
  const data = useLoaderData();

  return (
    <div style={{ padding: "24px", fontFamily: "system-ui", background: "#f6f6f7" }}>

      {/* ---------------- HEADER ---------------- */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Overview</h1>
          <button style={btnStyle}>🔄 Reload</button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 12, fontSize: 13 }}>
          <div style={pillStyle}>📅 Last 3 days</div>
          <div style={{ color: "#666" }}>Compare to: 24 Jan - 26 Jan 2026</div>
          <div style={{ marginLeft: "auto", color: "#888" }}>Updated now</div>
        </div>

        {/* ---------------- METRICS ---------------- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 16 }}>
          <Metric title="Total conversations" value={data.totalConversations} />
          <Metric title="Resolution rate" value={`${data.resolutionRate}%`} />
          <Metric title="Assisted revenue" value={`₹${data.assistedRevenue}`} />
          <Metric title="Chat-to-sales rate" value={`${data.chatToSalesRate}%`} />
          <Metric title="Total sales share contributed by Chaty" value={`${data.salesShare}%`} />
        </div>
      </div>

      {/* ---------------- SETUP SECTION ---------------- */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Set up live chat</h2>
        <p style={{ fontSize: 13, color: "#666" }}>Use this guide to start setup app on your store</p>

        <div style={{ marginTop: 8, fontSize: 13 }}>
          {data.completedSteps} of 3 tasks completed
        </div>

        <div style={{ background: "#eee", height: 8, borderRadius: 10, marginTop: 8 }}>
          <div
            style={{
              width: `${(data.completedSteps / 3) * 100}%`,
              height: "100%",
              background: "#5c6ac4",
              borderRadius: 10,
            }}
          />
        </div>

        <ul style={{ marginTop: 12, fontSize: 14 }}>
          <li>✅ Set up live chat</li>
          <li>✅ Set up AI assistant</li>
          <li>{data.completedSteps >= 3 ? "✅" : "⬜"} Set up FAQs</li>
        </ul>
      </div>

      {/* ---------------- FEATURE SUGGESTION ---------------- */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Suggest Features</h2>

        <Form method="post">
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13 }}>Title</div>
            <input placeholder="Name your feature" style={inputStyle} />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13 }}>Description</div>
            <textarea placeholder="How would this feature help you?" style={{ ...inputStyle, height: 100 }} />
          </div>

          <button style={{ ...btnStyle, marginTop: 12, width: "100%", background: "#1a0dab", color: "#fff" }}>
            Add idea
          </button>
        </Form>
      </div>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */
function Metric({ title, value }) {
  return (
    <div style={{ background: "#fafafa", padding: 14, borderRadius: 10 }}>
      <div style={{ fontSize: 13, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  border: "1px solid #e5e5e5",
};

const btnStyle = {
  padding: "6px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
};

const pillStyle = {
  padding: "4px 10px",
  border: "1px solid #ddd",
  borderRadius: 20,
  fontSize: 12,
};

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
};
