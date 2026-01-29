import { json } from "@remix-run/node";
import { useLoaderData, Form } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/* ---------------- LOADER ---------------- */
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 3);

  const totalConversations = await prisma.chatSession.count({
    where: { shop, createdAt: { gte: fromDate } },
  });

  const totalMessages = await prisma.chatMessage.count({
    where: { session: { shop }, createdAt: { gte: fromDate } },
  });

  const resolvedChats = await prisma.chatSession.count({
    where: { shop, isResolved: true, createdAt: { gte: fromDate } },
  });

  const pendingChats = await prisma.chatSession.count({
    where: { shop, isResolved: false, createdAt: { gte: fromDate } },
  });

  const resolutionRate = totalConversations === 0 ? 0 : Math.round((resolvedChats / totalConversations) * 100);

  const recentChats = await prisma.chatSession.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { messages: true },
  });

  const assistedRevenue = 0;
  const chatToSalesRate = 0;
  const salesShare = 0;

  const hasChat = totalConversations > 0;
  const hasFaq = await prisma.faq.count({ where: { shop } }) > 0;
  const hasSettings = await prisma.chatSettings.findUnique({ where: { shop } });
  const completedSteps = [hasChat, hasFaq, hasSettings].filter(Boolean).length;
  const avgResponseTime = "< 2 min";

  return json({
    totalConversations,
    totalMessages,
    resolvedChats,
    pendingChats,
    resolutionRate,
    assistedRevenue,
    chatToSalesRate,
    salesShare,
    recentChats,
    completedSteps,
    avgResponseTime,
  });
}

/* ---------------- PAGE ---------------- */
export default function ChatAnalytics() {
  const data = useLoaderData();

  return (
    <div style={{ padding: "32px", fontFamily: '"Inter", system-ui, sans-serif', background: "#f9fafb", minHeight: "100vh" }}>

      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* HEADER */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "#111827", margin: 0 }}>Analytics Dashboard</h1>
          <p style={{ fontSize: 15, color: "#6b7280", marginTop: 8 }}>Track your chat performance and customer engagement</p>
        </div>

        {/* TIME RANGE CARD */}
        <div style={{ ...card, marginBottom: 24, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={activePill}>📅 Last 3 days</div>
              <div style={{ fontSize: 14, color: "#6b7280" }}>vs. 24 Jan - 26 Jan 2026</div>
            </div>
            <button style={refreshBtn} onClick={() => window.location.reload()}>
              <span style={{ marginRight: 6 }}>🔄</span>
              Refresh Data
            </button>
          </div>
        </div>

        {/* MAIN METRICS GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginBottom: 24 }}>
          <MetricCard 
            icon="💬" 
            title="Total Conversations" 
            value={data.totalConversations} 
            color="#6366f1"
            subtitle="All chat sessions"
            bg="#eff6ff"
          />
          <MetricCard 
            icon="✅" 
            title="Resolved Chats" 
            value={data.resolvedChats} 
            color="#10b981"
            subtitle={`${data.resolutionRate}% resolution rate`}
            bg="#d1fae5"
          />
          <MetricCard 
            icon="⏳" 
            title="Pending Chats" 
            value={data.pendingChats} 
            color="#f59e0b"
            subtitle="Awaiting resolution"
            bg="#fef3c7"
          />
          <MetricCard 
            icon="📊" 
            title="Total Messages" 
            value={data.totalMessages} 
            color="#8b5cf6"
            subtitle="Across all chats"
            bg="#f3e8ff"
          />
        </div>

        {/* SECONDARY METRICS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 24 }}>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 32 }}>💰</div>
              <div>
                <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Assisted Revenue</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>₹{data.assistedRevenue}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>From chat conversions</div>
          </div>

          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 32 }}>🎯</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Chat-to-Sales Rate</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>{data.chatToSalesRate}%</div>
              </div>
            </div>
            <div style={{ ...progressBar, marginTop: 8 }}>
              <div style={{ ...progressFill, width: `${data.chatToSalesRate}%`, background: "#10b981" }} />
            </div>
          </div>

          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 32 }}>⚡</div>
              <div>
                <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Avg Response Time</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>{data.avgResponseTime}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Fast & efficient support</div>
          </div>
        </div>

        {/* RESOLUTION BREAKDOWN */}
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0, marginBottom: 20 }}>📊 Resolution Breakdown</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div style={{ padding: 20, background: "#d1fae5", borderRadius: 12, border: "2px solid #86efac" }}>
              <div style={{ fontSize: 11, color: "#065f46", fontWeight: 700, marginBottom: 8, letterSpacing: "0.5px" }}>RESOLVED</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#065f46" }}>{data.resolvedChats}</div>
              <div style={{ fontSize: 12, color: "#10b981", marginTop: 4 }}>{data.resolutionRate}% of total</div>
            </div>

            <div style={{ padding: 20, background: "#fef3c7", borderRadius: 12, border: "2px solid #fcd34d" }}>
              <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700, marginBottom: 8, letterSpacing: "0.5px" }}>PENDING</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#92400e" }}>{data.pendingChats}</div>
              <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 4 }}>
                {data.totalConversations > 0 ? Math.round((data.pendingChats / data.totalConversations) * 100) : 0}% of total
              </div>
            </div>

            <div style={{ padding: 20, background: "#ede9fe", borderRadius: 12, border: "2px solid #c4b5fd" }}>
              <div style={{ fontSize: 11, color: "#5b21b6", fontWeight: 700, marginBottom: 8, letterSpacing: "0.5px" }}>TOTAL</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#5b21b6" }}>{data.totalConversations}</div>
              <div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 4 }}>Last 3 days</div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>Resolution Progress</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>{data.resolutionRate}%</span>
            </div>
            <div style={{ ...progressBar, height: 10 }}>
              <div style={{ ...progressFill, width: `${data.resolutionRate}%`, background: "linear-gradient(90deg, #10b981 0%, #059669 100%)", height: 10, borderRadius: 10 }} />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24 }}>
          {/* SETUP PROGRESS */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>🚀 Setup Progress</h2>
                <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Complete these steps</p>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#6366f1" }}>
                {data.completedSteps}/3
              </div>
            </div>

            <div style={{ ...progressBar, height: 10, marginBottom: 16 }}>
              <div style={{ ...progressFill, width: `${(data.completedSteps / 3) * 100}%`, background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)", height: 10, borderRadius: 10 }} />
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <ChecklistItem completed={true} text="Set up live chat" />
              <ChecklistItem completed={true} text="Configure AI assistant" />
              <ChecklistItem completed={data.completedSteps >= 3} text="Add FAQ knowledge base" />
            </div>
          </div>

          {/* RECENT ACTIVITY */}
          <div style={card}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0, marginBottom: 16 }}>🕒 Recent Activity</h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.recentChats.length > 0 ? (
                data.recentChats.slice(0, 3).map((chat, index) => (
                  <div key={chat.sessionId} style={{ padding: 14, background: "#f9fafb", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e5e7eb" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>
                        {chat.email || `Customer ${index + 1}`}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                        {chat.messages.length} messages • {new Date(chat.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      {chat.isResolved ? (
                        <div style={{ background: "#d1fae5", color: "#065f46", fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 6 }}>✓ Resolved</div>
                      ) : (
                        <div style={{ background: "#fef3c7", color: "#92400e", fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 6 }}>⏳ Pending</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 13 }}>No recent activity</div>
              )}
            </div>
          </div>
        </div>

        {/* FEATURE SUGGESTION */}
        <div style={{ ...card, marginTop: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>💡 Suggest a Feature</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Help us improve by sharing your ideas</p>
          </div>

          <Form method="post">
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8 }}>Feature Title</label>
              <input name="title" placeholder="e.g., Video chat support" style={input} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8 }}>Description</label>
              <textarea name="description" placeholder="Describe how this feature would help your business..." style={{ ...input, height: 100, resize: "vertical" }} />
            </div>

            <button style={submitBtn}>
              <span style={{ marginRight: 8 }}>✨</span>
              Submit Idea
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */
function MetricCard({ icon, title, value, color, subtitle, bg }) {
  return (
    <div style={{ ...card, background: bg, border: `2px solid ${color}33`, padding: 20, transition: "transform 0.2s, box-shadow 0.2s", cursor: "default" }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.1)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {title}
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>
        {subtitle}
      </div>
    </div>
  );
}

function ChecklistItem({ completed, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: completed ? "#d1fae5" : "#f9fafb", borderRadius: 8, border: `1px solid ${completed ? "#86efac" : "#e5e7eb"}` }}>
      <div style={{ fontSize: 18 }}>{completed ? "✅" : "⬜"}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: completed ? "#065f46" : "#6b7280" }}>{text}</div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const card = {
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  border: "1px solid #e5e7eb",
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
};

const activePill = {
  padding: "8px 14px",
  background: "#6366f1",
  color: "#fff",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  border: "none",
};

const refreshBtn = {
  padding: "10px 16px",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  color: "#6b7280",
  cursor: "pointer",
  transition: "all 0.2s",
  display: "flex",
  alignItems: "center",
};

const progressBar = {
  background: "#e5e7eb",
  height: 8,
  borderRadius: 10,
  overflow: "hidden",
};

const progressFill = {
  height: "100%",
  borderRadius: 10,
  transition: "width 0.5s ease",
};

const input = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  fontSize: 14,
  fontFamily: "inherit",
  transition: "border-color 0.2s",
  outline: "none",
};

const submitBtn = {
  width: "100%",
  padding: "12px 20px",
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "transform 0.2s",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};