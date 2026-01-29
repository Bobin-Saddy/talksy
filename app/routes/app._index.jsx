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
    totalMessages,
    resolvedChats,
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
    <div style={{ padding: "32px", fontFamily: "system-ui", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", minHeight: "100vh" }}>

      {/* ---------------- HEADER ---------------- */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#fff", margin: 0 }}>Analytics Dashboard</h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", marginTop: 8 }}>Track your chat performance and customer engagement</p>
      </div>

      {/* ---------------- TIME RANGE CARD ---------------- */}
      <div style={{ ...glassCard, marginBottom: 24, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={activePillStyle}>📅 Last 3 days</div>
            <div style={{ fontSize: 14, color: "#666" }}>vs. 24 Jan - 26 Jan 2026</div>
          </div>
          <button style={reloadBtn}>
            <span style={{ marginRight: 6 }}>🔄</span>
            Refresh Data
          </button>
        </div>
      </div>

      {/* ---------------- MAIN METRICS GRID ---------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 24 }}>
        <MetricCard 
          icon="💬" 
          title="Total Conversations" 
          value={data.totalConversations} 
          color="#667eea"
          subtitle="All chat sessions"
        />
        <MetricCard 
          icon="✅" 
          title="Resolved Chats" 
          value={data.resolvedChats} 
          color="#48bb78"
          subtitle={`${data.resolutionRate}% resolution rate`}
        />
        <MetricCard 
          icon="💰" 
          title="Assisted Revenue" 
          value={`₹${data.assistedRevenue}`} 
          color="#ed8936"
          subtitle="From chat conversions"
        />
        <MetricCard 
          icon="📊" 
          title="Total Messages" 
          value={data.totalMessages} 
          color="#9f7aea"
          subtitle="Across all chats"
        />
      </div>

      {/* ---------------- SECONDARY METRICS ---------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 24 }}>
        <div style={glassCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 32 }}>🎯</div>
            <div>
              <div style={{ fontSize: 14, color: "#666", fontWeight: 500 }}>Chat-to-Sales Rate</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#1a202c" }}>{data.chatToSalesRate}%</div>
            </div>
          </div>
          <div style={progressBar}>
            <div style={{ ...progressFill, width: `${data.chatToSalesRate}%`, background: "#48bb78" }} />
          </div>
        </div>

        <div style={glassCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 32 }}>📈</div>
            <div>
              <div style={{ fontSize: 14, color: "#666", fontWeight: 500 }}>Sales Share by Chaty</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#1a202c" }}>{data.salesShare}%</div>
            </div>
          </div>
          <div style={progressBar}>
            <div style={{ ...progressFill, width: `${data.salesShare}%`, background: "#667eea" }} />
          </div>
        </div>
      </div>

      {/* ---------------- SETUP PROGRESS ---------------- */}
      <div style={{ ...glassCard, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a202c", margin: 0 }}>🚀 Setup Progress</h2>
            <p style={{ fontSize: 14, color: "#666", marginTop: 6 }}>Complete these steps to unlock full potential</p>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#667eea" }}>
            {data.completedSteps}/3
          </div>
        </div>

        <div style={{ ...progressBar, height: 12, marginBottom: 20 }}>
          <div
            style={{
              ...progressFill,
              width: `${(data.completedSteps / 3) * 100}%`,
              background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
              height: 12,
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <ChecklistItem completed={true} text="Set up live chat" />
          <ChecklistItem completed={true} text="Configure AI assistant" />
          <ChecklistItem completed={data.completedSteps >= 3} text="Add FAQ knowledge base" />
        </div>
      </div>

      {/* ---------------- FEATURE SUGGESTION ---------------- */}
      <div style={glassCard}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a202c", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            💡 Suggest a Feature
          </h2>
          <p style={{ fontSize: 14, color: "#666", marginTop: 6 }}>Help us improve by sharing your ideas</p>
        </div>

        <Form method="post">
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 8 }}>
              Feature Title
            </label>
            <input 
              name="title"
              placeholder="e.g., Video chat support" 
              style={modernInput} 
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 8 }}>
              Description
            </label>
            <textarea 
              name="description"
              placeholder="Describe how this feature would help your business..." 
              style={{ ...modernInput, height: 120, resize: "vertical" }} 
            />
          </div>

          <button style={submitBtn}>
            <span style={{ marginRight: 8 }}>✨</span>
            Submit Idea
          </button>
        </Form>
      </div>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */
function MetricCard({ icon, title, value, color, subtitle }) {
  return (
    <div style={{
      ...glassCard,
      background: "#fff",
      borderLeft: `4px solid ${color}`,
      transition: "transform 0.2s, box-shadow 0.2s",
      cursor: "default",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-4px)";
      e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.07)";
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 13, color: "#718096", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {title}
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: "#1a202c", marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#a0aec0" }}>
        {subtitle}
      </div>
    </div>
  );
}

function ChecklistItem({ completed, text }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: 12,
      background: completed ? "#f0fdf4" : "#f7fafc",
      borderRadius: 8,
      border: `2px solid ${completed ? "#86efac" : "#e2e8f0"}`,
    }}>
      <div style={{ fontSize: 20 }}>
        {completed ? "✅" : "⬜"}
      </div>
      <div style={{ 
        fontSize: 14, 
        fontWeight: 500, 
        color: completed ? "#166534" : "#64748b",
        textDecoration: completed ? "none" : "none"
      }}>
        {text}
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const glassCard = {
  background: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(10px)",
  borderRadius: 16,
  padding: 24,
  border: "1px solid rgba(255, 255, 255, 0.3)",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.07), 0 10px 20px rgba(0, 0, 0, 0.05)",
};

const activePillStyle = {
  padding: "8px 16px",
  background: "#667eea",
  color: "#fff",
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 600,
  border: "none",
};

const reloadBtn = {
  padding: "10px 20px",
  background: "#fff",
  border: "2px solid #e2e8f0",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  color: "#4a5568",
  cursor: "pointer",
  transition: "all 0.2s",
  display: "flex",
  alignItems: "center",
};

const progressBar = {
  background: "#e2e8f0",
  height: 8,
  borderRadius: 10,
  overflow: "hidden",
};

const progressFill = {
  height: "100%",
  borderRadius: 10,
  transition: "width 0.5s ease",
};

const modernInput = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 10,
  border: "2px solid #e2e8f0",
  fontSize: 14,
  fontFamily: "system-ui",
  transition: "border-color 0.2s",
  outline: "none",
};

const submitBtn = {
  width: "100%",
  padding: "14px 24px",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  transition: "transform 0.2s, box-shadow 0.2s",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};