import { json } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState } from "react";

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

  // Get feature suggestions
  const featureSuggestions = await prisma.featureSuggestion.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 10,
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
    featureSuggestions,
  });
}

/* ---------------- ACTION ---------------- */
export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("_action");

  if (actionType === "addFeature") {
    const title = formData.get("title");
    const description = formData.get("description");
    const category = formData.get("category");
    const priority = formData.get("priority");

    await prisma.featureSuggestion.create({
      data: {
        shop,
        title,
        description,
        category,
        priority,
        status: "pending",
      },
    });

    return json({ success: true, message: "Feature suggestion submitted!" });
  }

  if (actionType === "deleteFeature") {
    const id = formData.get("id");
    await prisma.featureSuggestion.delete({
      where: { id },
    });
    return json({ success: true, message: "Feature deleted!" });
  }

  return json({ success: false });
}

/* ---------------- PAGE ---------------- */
export default function ChatAnalytics() {
  const data = useLoaderData();
  const [showFeatureForm, setShowFeatureForm] = useState(false);

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        {/* ANIMATED HEADER */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.headerBadge}>
              <span style={styles.pulsingDot}></span>
              Live Dashboard
            </div>
            <h1 style={styles.mainTitle}>Analytics Dashboard</h1>
            <p style={styles.subtitle}>
              Track your chat performance and customer engagement in real-time
            </p>
          </div>
          <div style={styles.headerStats}>
            <div style={styles.miniStat}>
              <div style={styles.miniStatValue}>{data.completedSteps}/3</div>
              <div style={styles.miniStatLabel}>Setup</div>
            </div>
            <div style={styles.divider}></div>
            <div style={styles.miniStat}>
              <div style={styles.miniStatValue}>{data.resolutionRate}%</div>
              <div style={styles.miniStatLabel}>Resolved</div>
            </div>
          </div>
        </div>

        {/* TIME RANGE CARD */}
        <div style={styles.timeCard}>
          <div style={styles.timeCardContent}>
            <div style={styles.timeLeft}>
              <div style={styles.activePill}>
                <span style={styles.calendarIcon}>📅</span>
                Last 3 days
              </div>
              <div style={styles.comparisonText}>vs. 24 Jan - 26 Jan 2026</div>
            </div>
            <button style={styles.refreshBtn} onClick={() => window.location.reload()}>
              <span style={styles.refreshIcon}>🔄</span>
              Refresh Data
            </button>
          </div>
        </div>

        {/* MAIN METRICS GRID - Enhanced */}
        <div style={styles.metricsGrid}>
          <MetricCard 
            icon="💬" 
            title="Total Conversations" 
            value={data.totalConversations} 
            color="#6366f1"
            subtitle="All chat sessions"
            bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            trend="+12%"
          />
          <MetricCard 
            icon="✅" 
            title="Resolved Chats" 
            value={data.resolvedChats} 
            color="#10b981"
            subtitle={`${data.resolutionRate}% resolution rate`}
            bg="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
            trend="+8%"
          />
          <MetricCard 
            icon="⏳" 
            title="Pending Chats" 
            value={data.pendingChats} 
            color="#f59e0b"
            subtitle="Awaiting resolution"
            bg="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            trend="-3%"
          />
          <MetricCard 
            icon="📊" 
            title="Total Messages" 
            value={data.totalMessages} 
            color="#8b5cf6"
            subtitle="Across all chats"
            bg="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            trend="+15%"
          />
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div style={styles.twoColumnGrid}>
          {/* LEFT COLUMN */}
          <div style={styles.leftColumn}>
            {/* RESOLUTION BREAKDOWN - Enhanced */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={styles.cardTitle}>
                    <span style={styles.cardIcon}>📊</span>
                    Resolution Breakdown
                  </h2>
                  <p style={styles.cardSubtitle}>Performance overview</p>
                </div>
              </div>
              
              <div style={styles.resolutionGrid}>
                <div style={styles.resolvedBox}>
                  <div style={styles.statLabel}>RESOLVED</div>
                  <div style={styles.statValue}>{data.resolvedChats}</div>
                  <div style={styles.statPercentage}>{data.resolutionRate}% of total</div>
                  <div style={styles.sparkline}>
                    {[65, 72, 68, 80, 85, 82, data.resolutionRate].map((v, i) => (
                      <div key={i} style={{...styles.sparkBar, height: `${v}%`}}></div>
                    ))}
                  </div>
                </div>

                <div style={styles.pendingBox}>
                  <div style={styles.statLabel}>PENDING</div>
                  <div style={styles.statValue}>{data.pendingChats}</div>
                  <div style={styles.statPercentage}>
                    {data.totalConversations > 0 ? Math.round((data.pendingChats / data.totalConversations) * 100) : 0}% of total
                  </div>
                  <div style={styles.sparkline}>
                    {[35, 28, 32, 20, 15, 18, 100 - data.resolutionRate].map((v, i) => (
                      <div key={i} style={{...styles.sparkBar, height: `${v}%`, background: "#f59e0b"}}></div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={styles.totalBox}>
                <div style={styles.totalContent}>
                  <div>
                    <div style={styles.totalLabel}>TOTAL CONVERSATIONS</div>
                    <div style={styles.totalValue}>{data.totalConversations}</div>
                  </div>
                  <div style={styles.progressCircle}>
                    <svg width="80" height="80">
                      <circle cx="40" cy="40" r="35" fill="none" stroke="#e5e7eb" strokeWidth="8"/>
                      <circle 
                        cx="40" 
                        cy="40" 
                        r="35" 
                        fill="none" 
                        stroke="#6366f1" 
                        strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 35 * data.resolutionRate / 100} ${2 * Math.PI * 35}`}
                        strokeLinecap="round"
                        transform="rotate(-90 40 40)"
                      />
                      <text x="40" y="45" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#6366f1">
                        {data.resolutionRate}%
                      </text>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* SECONDARY METRICS - Enhanced */}
            <div style={styles.secondaryMetrics}>
              <div style={styles.secondaryCard}>
                <div style={styles.secondaryIcon}>💰</div>
                <div style={styles.secondaryContent}>
                  <div style={styles.secondaryLabel}>Assisted Revenue</div>
                  <div style={styles.secondaryValue}>₹{data.assistedRevenue.toLocaleString()}</div>
                  <div style={styles.secondarySubtext}>From chat conversions</div>
                </div>
                <div style={styles.trendBadge}>
                  <span>📈</span> +0%
                </div>
              </div>

              <div style={styles.secondaryCard}>
                <div style={{...styles.secondaryIcon, background: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"}}>🎯</div>
                <div style={styles.secondaryContent}>
                  <div style={styles.secondaryLabel}>Chat-to-Sales</div>
                  <div style={styles.secondaryValue}>{data.chatToSalesRate}%</div>
                  <div style={styles.progressBar}>
                    <div style={{...styles.progressFill, width: `${data.chatToSalesRate}%`}} />
                  </div>
                </div>
                <div style={styles.trendBadge}>
                  <span>📊</span> 0%
                </div>
              </div>

              <div style={styles.secondaryCard}>
                <div style={{...styles.secondaryIcon, background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"}}>⚡</div>
                <div style={styles.secondaryContent}>
                  <div style={styles.secondaryLabel}>Avg Response Time</div>
                  <div style={styles.secondaryValue}>{data.avgResponseTime}</div>
                  <div style={styles.secondarySubtext}>Fast & efficient support</div>
                </div>
                <div style={{...styles.trendBadge, background: "#d1fae5", color: "#065f46"}}>
                  <span>⚡</span> Great
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={styles.rightColumn}>
            {/* SETUP PROGRESS - Enhanced */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={styles.cardTitle}>
                    <span style={styles.cardIcon}>🚀</span>
                    Setup Progress
                  </h2>
                  <p style={styles.cardSubtitle}>Complete your configuration</p>
                </div>
                <div style={styles.progressBadge}>
                  {data.completedSteps}/3
                </div>
              </div>

              <div style={styles.progressBarLarge}>
                <div style={{
                  ...styles.progressFillLarge, 
                  width: `${(data.completedSteps / 3) * 100}%`
                }} />
              </div>

              <div style={styles.checklistGrid}>
                <ChecklistItem completed={true} text="Set up live chat" icon="💬" />
                <ChecklistItem completed={true} text="Configure AI assistant" icon="🤖" />
                <ChecklistItem completed={data.completedSteps >= 3} text="Add FAQ knowledge base" icon="📚" />
              </div>

              {data.completedSteps < 3 && (
                <div style={styles.setupCTA}>
                  <button style={styles.ctaButton}>
                    Complete Setup →
                  </button>
                </div>
              )}
            </div>

            {/* RECENT ACTIVITY - Enhanced */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  <span style={styles.cardIcon}>🕒</span>
                  Recent Activity
                </h2>
              </div>
              
              <div style={styles.activityList}>
                {data.recentChats.length > 0 ? (
                  data.recentChats.slice(0, 5).map((chat, index) => (
                    <div key={chat.sessionId} style={styles.activityItem}>
                      <div style={styles.activityAvatar}>
                        {chat.email ? chat.email.charAt(0).toUpperCase() : index + 1}
                      </div>
                      <div style={styles.activityContent}>
                        <div style={styles.activityName}>
                          {chat.email || `Customer ${index + 1}`}
                        </div>
                        <div style={styles.activityMeta}>
                          {chat.messages.length} messages • {new Date(chat.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {chat.isResolved ? (
                        <div style={styles.resolvedBadge}>✓ Resolved</div>
                      ) : (
                        <div style={styles.pendingBadge}>⏳ Pending</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>📭</div>
                    <div style={styles.emptyText}>No recent activity</div>
                    <div style={styles.emptySubtext}>Chat sessions will appear here</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE SUGGESTIONS SECTION - Enhanced & Dynamic */}
        <div style={styles.featureSection}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>
                  <span style={styles.cardIcon}>💡</span>
                  Feature Suggestions
                </h2>
                <p style={styles.cardSubtitle}>Help us improve by sharing your ideas</p>
              </div>
              <button 
                style={styles.addButton}
                onClick={() => setShowFeatureForm(!showFeatureForm)}
              >
                {showFeatureForm ? "✕ Close" : "+ New Idea"}
              </button>
            </div>

            {showFeatureForm && (
              <FeatureForm onClose={() => setShowFeatureForm(false)} />
            )}

            {/* Feature List */}
            {data.featureSuggestions && data.featureSuggestions.length > 0 && (
              <div style={styles.featureList}>
                {data.featureSuggestions.map((feature) => (
                  <FeatureCard key={feature.id} feature={feature} />
                ))}
              </div>
            )}

            {(!data.featureSuggestions || data.featureSuggestions.length === 0) && !showFeatureForm && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>✨</div>
                <div style={styles.emptyText}>No suggestions yet</div>
                <div style={styles.emptySubtext}>Be the first to share your idea!</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- DYNAMIC FORM COMPONENT ---------------- */
function FeatureForm({ onClose }) {
  const fetcher = useFetcher();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "general",
    priority: "medium"
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append("_action", "addFeature");
    form.append("title", formData.title);
    form.append("description", formData.description);
    form.append("category", formData.category);
    form.append("priority", formData.priority);
    
    fetcher.submit(form, { method: "post" });
    
    setFormData({ title: "", description: "", category: "general", priority: "medium" });
    setTimeout(onClose, 500);
  };

  return (
    <div style={styles.featureForm}>
      <form onSubmit={handleSubmit}>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Feature Title *</label>
            <input 
              name="title" 
              placeholder="e.g., Video chat support"
              style={styles.input}
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Category *</label>
            <select 
              name="category" 
              style={styles.select}
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              <option value="general">General</option>
              <option value="chat">Chat Features</option>
              <option value="analytics">Analytics</option>
              <option value="integration">Integration</option>
              <option value="ui">User Interface</option>
              <option value="performance">Performance</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Priority *</label>
            <select 
              name="priority" 
              style={styles.select}
              value={formData.priority}
              onChange={(e) => setFormData({...formData, priority: e.target.value})}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Description *</label>
          <textarea 
            name="description" 
            placeholder="Describe how this feature would help your business..."
            style={styles.textarea}
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            required
          />
        </div>

        <div style={styles.formActions}>
          <button type="button" style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" style={styles.submitButton}>
            <span style={styles.buttonIcon}>✨</span>
            Submit Idea
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- FEATURE CARD COMPONENT ---------------- */
function FeatureCard({ feature }) {
  const fetcher = useFetcher();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this suggestion?")) {
      const form = new FormData();
      form.append("_action", "deleteFeature");
      form.append("id", feature.id);
      fetcher.submit(form, { method: "post" });
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      general: "#6b7280",
      chat: "#6366f1",
      analytics: "#8b5cf6",
      integration: "#10b981",
      ui: "#f59e0b",
      performance: "#ef4444"
    };
    return colors[category] || "#6b7280";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "#6b7280",
      medium: "#f59e0b",
      high: "#ef4444",
      critical: "#dc2626"
    };
    return colors[priority] || "#6b7280";
  };

  return (
    <div style={styles.featureCard}>
      <div style={styles.featureHeader}>
        <h3 style={styles.featureTitle}>{feature.title}</h3>
        <button style={styles.deleteButton} onClick={handleDelete}>
          🗑️
        </button>
      </div>
      <p style={styles.featureDescription}>{feature.description}</p>
      <div style={styles.featureMeta}>
        <span style={{...styles.categoryBadge, background: `${getCategoryColor(feature.category)}15`, color: getCategoryColor(feature.category)}}>
          {feature.category}
        </span>
        <span style={{...styles.priorityBadge, background: `${getPriorityColor(feature.priority)}15`, color: getPriorityColor(feature.priority)}}>
          {feature.priority}
        </span>
        <span style={styles.dateBadge}>
          {new Date(feature.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

/* ---------------- METRIC CARD COMPONENT ---------------- */
function MetricCard({ icon, title, value, color, subtitle, bg, trend }) {
  return (
    <div style={{...styles.metricCard, background: bg}}>
      <div style={styles.metricIcon}>{icon}</div>
      <div style={styles.metricContent}>
        <div style={styles.metricTitle}>{title}</div>
        <div style={styles.metricValue}>{value}</div>
        <div style={styles.metricFooter}>
          <span style={styles.metricSubtitle}>{subtitle}</span>
          {trend && <span style={styles.metricTrend}>{trend}</span>}
        </div>
      </div>
      <div style={styles.metricGlow}></div>
    </div>
  );
}

/* ---------------- CHECKLIST ITEM COMPONENT ---------------- */
function ChecklistItem({ completed, text, icon }) {
  return (
    <div style={completed ? styles.checklistItemCompleted : styles.checklistItem}>
      <div style={styles.checklistIcon}>
        {completed ? "✅" : "⬜"}
      </div>
      <div style={styles.checklistContent}>
        <div style={styles.checklistText}>{text}</div>
        <div style={styles.checklistEmoji}>{icon}</div>
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const styles = {
  container: {
    padding: "40px 24px",
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
    minHeight: "100vh",
  },
  maxWidth: {
    maxWidth: "1600px",
    margin: "0 auto",
  },
  header: {
    marginBottom: 32,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    background: "rgba(99, 102, 241, 0.1)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: "#6366f1",
    marginBottom: 12,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    background: "#10b981",
    borderRadius: "50%",
    animation: "pulse 2s infinite",
  },
  mainTitle: {
    fontSize: 42,
    fontWeight: 800,
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    margin: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    margin: 0,
  },
  headerStats: {
    display: "flex",
    gap: 24,
    alignItems: "center",
    background: "#fff",
    padding: "16px 24px",
    borderRadius: 16,
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
  },
  miniStat: {
    textAlign: "center",
  },
  miniStatValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "#111827",
  },
  miniStatLabel: {
    fontSize: 11,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 40,
    background: "#e5e7eb",
  },
  timeCard: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
    marginBottom: 24,
  },
  timeCardContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  timeLeft: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  activePill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
  },
  calendarIcon: {
    fontSize: 16,
  },
  comparisonText: {
    fontSize: 14,
    color: "#6b7280",
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    background: "#f9fafb",
    border: "2px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  refreshIcon: {
    fontSize: 14,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 24,
    marginBottom: 32,
  },
  metricCard: {
    position: "relative",
    padding: 28,
    borderRadius: 20,
    overflow: "hidden",
    transition: "transform 0.3s, box-shadow 0.3s",
    cursor: "pointer",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.1)",
  },
  metricGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "radial-gradient(circle at top right, rgba(255, 255, 255, 0.3), transparent)",
    pointerEvents: "none",
  },
  metricIcon: {
    fontSize: 48,
    marginBottom: 16,
    filter: "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15))",
  },
  metricContent: {
    position: "relative",
    zIndex: 1,
  },
  metricTitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 42,
    fontWeight: 800,
    color: "#fff",
    marginBottom: 8,
  },
  metricFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
  },
  metricTrend: {
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 8px",
    background: "rgba(255, 255, 255, 0.2)",
    borderRadius: 6,
    color: "#fff",
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr",
    gap: 24,
    marginBottom: 32,
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: 28,
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
    border: "1px solid #e5e7eb",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    margin: 0,
    marginTop: 6,
  },
  resolutionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 20,
  },
  resolvedBox: {
    padding: 24,
    background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
    borderRadius: 16,
    border: "2px solid #86efac",
  },
  pendingBox: {
    padding: 24,
    background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    borderRadius: 16,
    border: "2px solid #fcd34d",
  },
  statLabel: {
    fontSize: 10,
    color: "#065f46",
    fontWeight: 700,
    marginBottom: 12,
    letterSpacing: "1px",
  },
  statValue: {
    fontSize: 40,
    fontWeight: 800,
    color: "#065f46",
    marginBottom: 8,
  },
  statPercentage: {
    fontSize: 12,
    color: "#10b981",
    marginBottom: 12,
  },
  sparkline: {
    display: "flex",
    gap: 3,
    alignItems: "flex-end",
    height: 30,
  },
  sparkBar: {
    flex: 1,
    background: "#10b981",
    borderRadius: 2,
    minHeight: 4,
    transition: "height 0.3s",
  },
  totalBox: {
    padding: 24,
    background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
    borderRadius: 16,
    border: "2px solid #c4b5fd",
  },
  totalContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 11,
    color: "#5b21b6",
    fontWeight: 700,
    letterSpacing: "1px",
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 40,
    fontWeight: 800,
    color: "#5b21b6",
  },
  progressCircle: {
    filter: "drop-shadow(0 4px 8px rgba(99, 102, 241, 0.2))",
  },
  secondaryMetrics: {
    display: "grid",
    gap: 16,
  },
  secondaryCard: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: 20,
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  secondaryIcon: {
    width: 56,
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    borderRadius: 12,
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    flexShrink: 0,
  },
  secondaryContent: {
    flex: 1,
  },
  secondaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 600,
    marginBottom: 6,
  },
  secondaryValue: {
    fontSize: 28,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 4,
  },
  secondarySubtext: {
    fontSize: 11,
    color: "#9ca3af",
  },
  trendBadge: {
    padding: "6px 12px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 8,
    flexShrink: 0,
  },
  progressBar: {
    background: "#e5e7eb",
    height: 6,
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
    borderRadius: 10,
    transition: "width 0.5s ease",
  },
  progressBadge: {
    padding: "8px 16px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: 18,
    fontWeight: 800,
    borderRadius: 12,
  },
  progressBarLarge: {
    background: "#e5e7eb",
    height: 12,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
  },
  progressFillLarge: {
    height: "100%",
    background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
    borderRadius: 12,
    transition: "width 0.5s ease",
  },
  checklistGrid: {
    display: "grid",
    gap: 12,
  },
  checklistItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
    background: "#f9fafb",
    borderRadius: 12,
    border: "2px solid #e5e7eb",
    transition: "all 0.2s",
  },
  checklistItemCompleted: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
    background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
    borderRadius: 12,
    border: "2px solid #86efac",
    transition: "all 0.2s",
  },
  checklistIcon: {
    fontSize: 24,
  },
  checklistContent: {
    flex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checklistText: {
    fontSize: 14,
    fontWeight: 600,
    color: "#065f46",
  },
  checklistEmoji: {
    fontSize: 18,
  },
  setupCTA: {
    marginTop: 20,
    paddingTop: 20,
    borderTop: "1px solid #e5e7eb",
  },
  ctaButton: {
    width: "100%",
    padding: "14px 24px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 0.2s",
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  activityItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
    background: "#f9fafb",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    transition: "all 0.2s",
  },
  activityAvatar: {
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 4,
  },
  activityMeta: {
    fontSize: 12,
    color: "#6b7280",
  },
  resolvedBadge: {
    padding: "6px 12px",
    background: "#d1fae5",
    color: "#065f46",
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 8,
    flexShrink: 0,
  },
  pendingBadge: {
    padding: "6px 12px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 8,
    flexShrink: 0,
  },
  emptyState: {
    textAlign: "center",
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 600,
    color: "#6b7280",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9ca3af",
  },
  featureSection: {
    marginTop: 32,
  },
  addButton: {
    padding: "10px 20px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 0.2s",
  },
  featureForm: {
    padding: 24,
    background: "#f9fafb",
    borderRadius: 16,
    marginBottom: 24,
    border: "2px solid #e5e7eb",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "2px solid #e5e7eb",
    fontSize: 14,
    fontFamily: "inherit",
    transition: "border-color 0.2s",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "2px solid #e5e7eb",
    fontSize: 14,
    fontFamily: "inherit",
    transition: "border-color 0.2s",
    outline: "none",
    background: "#fff",
  },
  textarea: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "2px solid #e5e7eb",
    fontSize: 14,
    fontFamily: "inherit",
    transition: "border-color 0.2s",
    outline: "none",
    resize: "vertical",
    minHeight: 100,
  },
  formActions: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-end",
  },
  cancelButton: {
    padding: "12px 24px",
    background: "#fff",
    color: "#6b7280",
    border: "2px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  submitButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 24px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 0.2s",
  },
  buttonIcon: {
    fontSize: 16,
  },
  featureList: {
    display: "grid",
    gap: 16,
  },
  featureCard: {
    padding: 20,
    background: "#f9fafb",
    borderRadius: 12,
    border: "2px solid #e5e7eb",
    transition: "all 0.2s",
  },
  featureHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
  },
  deleteButton: {
    padding: "6px 10px",
    background: "transparent",
    border: "none",
    fontSize: 16,
    cursor: "pointer",
    opacity: 0.5,
    transition: "opacity 0.2s",
  },
  featureDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 1.6,
    marginBottom: 12,
  },
  featureMeta: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  categoryBadge: {
    padding: "4px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  priorityBadge: {
    padding: "4px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  dateBadge: {
    padding: "4px 12px",
    background: "#e5e7eb",
    color: "#6b7280",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  },
};