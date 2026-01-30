import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "react-router";
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
    take: 10,
    include: { messages: true },
  });

  const featureSuggestions = await prisma.featureSuggestion.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const assistedRevenue = 0;
  const chatToSalesRate = 0;
  const avgResponseTime = "< 2 min";

  return json({
    totalConversations,
    totalMessages,
    resolvedChats,
    pendingChats,
    resolutionRate,
    assistedRevenue,
    chatToSalesRate,
    recentChats,
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
      <div style={styles.wrapper}>
        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Analytics Dashboard</h1>
            <p style={styles.subtitle}>Last 3 days performance overview</p>
          </div>
          <button style={styles.refreshBtn} onClick={() => window.location.reload()}>
            <svg style={styles.btnIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* MAIN METRICS */}
        <div style={styles.metricsGrid}>
          <MetricCard 
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
            title="Total Conversations" 
            value={data.totalConversations}
            change="+12%"
            changeType="positive"
          />
          <MetricCard 
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            title="Resolved Chats" 
            value={data.resolvedChats}
            subtitle={`${data.resolutionRate}% resolution rate`}
            change="+8%"
            changeType="positive"
          />
          <MetricCard 
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            title="Pending Chats" 
            value={data.pendingChats}
            subtitle="Awaiting resolution"
            change="-3%"
            changeType="negative"
          />
          <MetricCard 
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>}
            title="Total Messages" 
            value={data.totalMessages}
            subtitle="Across all chats"
            change="+15%"
            changeType="positive"
          />
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div style={styles.gridLayout}>
          {/* LEFT COLUMN */}
          <div style={styles.leftCol}>
            {/* RESOLUTION OVERVIEW */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                <svg style={styles.titleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Resolution Overview
              </h2>

              <div style={styles.statsRow}>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Resolved</div>
                  <div style={styles.statValue}>{data.resolvedChats}</div>
                  <div style={styles.statPercent}>{data.resolutionRate}%</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Pending</div>
                  <div style={styles.statValue}>{data.pendingChats}</div>
                  <div style={styles.statPercent}>
                    {data.totalConversations > 0 ? 100 - data.resolutionRate : 0}%
                  </div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Total</div>
                  <div style={styles.statValue}>{data.totalConversations}</div>
                  <div style={styles.statPercent}>100%</div>
                </div>
              </div>

              <div style={styles.progressSection}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressLabel}>Resolution Progress</span>
                  <span style={styles.progressValue}>{data.resolutionRate}%</span>
                </div>
                <div style={styles.progressBar}>
                  <div style={{...styles.progressFill, width: `${data.resolutionRate}%`}} />
                </div>
              </div>
            </div>

            {/* PERFORMANCE METRICS */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                <svg style={styles.titleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Performance Metrics
              </h2>

              <div style={styles.metricsList}>
                <div style={styles.metricRow}>
                  <div style={styles.metricLeft}>
                    <svg style={styles.metricIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <div style={styles.metricTitle}>Assisted Revenue</div>
                      <div style={styles.metricSubtitle}>From chat conversions</div>
                    </div>
                  </div>
                  <div style={styles.metricValue}>₹{data.assistedRevenue}</div>
                </div>

                <div style={styles.metricRow}>
                  <div style={styles.metricLeft}>
                    <svg style={styles.metricIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <div>
                      <div style={styles.metricTitle}>Chat-to-Sales Rate</div>
                      <div style={styles.metricSubtitle}>Conversion percentage</div>
                    </div>
                  </div>
                  <div style={styles.metricValue}>{data.chatToSalesRate}%</div>
                </div>

                <div style={styles.metricRow}>
                  <div style={styles.metricLeft}>
                    <svg style={styles.metricIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div>
                      <div style={styles.metricTitle}>Avg Response Time</div>
                      <div style={styles.metricSubtitle}>Fast support delivery</div>
                    </div>
                  </div>
                  <div style={styles.metricValue}>{data.avgResponseTime}</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={styles.rightCol}>
            {/* RECENT ACTIVITY */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                <svg style={styles.titleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent Activity
              </h2>

              <div style={styles.activityList}>
                {data.recentChats.length > 0 ? (
                  data.recentChats.map((chat, index) => (
                    <div key={chat.sessionId} style={styles.activityItem}>
                      <div style={styles.activityAvatar}>
                        {chat.email ? chat.email.charAt(0).toUpperCase() : (index + 1)}
                      </div>
                      <div style={styles.activityContent}>
                        <div style={styles.activityName}>
                          {chat.email || `Customer ${index + 1}`}
                        </div>
                        <div style={styles.activityMeta}>
                          {chat.messages.length} messages · {new Date(chat.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {chat.isResolved ? (
                        <span style={styles.badgeResolved}>Resolved</span>
                      ) : (
                        <span style={styles.badgePending}>Pending</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={styles.emptyState}>
                    <svg style={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p style={styles.emptyText}>No recent activity</p>
                    <p style={styles.emptySubtext}>Chat sessions will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE SUGGESTIONS */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>
              <svg style={styles.titleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Feature Suggestions
            </h2>
            <button 
              style={styles.addBtn}
              onClick={() => setShowFeatureForm(!showFeatureForm)}
            >
              <svg style={styles.btnIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showFeatureForm ? "Close" : "Add Idea"}
            </button>
          </div>

          {showFeatureForm && <FeatureForm onClose={() => setShowFeatureForm(false)} />}

          {data.featureSuggestions && data.featureSuggestions.length > 0 ? (
            <div style={styles.featureList}>
              {data.featureSuggestions.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          ) : !showFeatureForm ? (
            <div style={styles.emptyState}>
              <svg style={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p style={styles.emptyText}>No suggestions yet</p>
              <p style={styles.emptySubtext}>Share your ideas to help us improve</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */
function MetricCard({ icon, title, value, subtitle, change, changeType }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricCardTop}>
        <div style={styles.iconWrapper}>{icon}</div>
        {change && (
          <span style={changeType === 'positive' ? styles.changePositive : styles.changeNegative}>
            {change}
          </span>
        )}
      </div>
      <div style={styles.metricCardTitle}>{title}</div>
      <div style={styles.metricCardValue}>{value}</div>
      {subtitle && <div style={styles.metricCardSubtitle}>{subtitle}</div>}
    </div>
  );
}

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
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Title</label>
          <input 
            type="text"
            name="title" 
            placeholder="Feature title"
            style={styles.input}
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Category</label>
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
            <option value="ui">UI/UX</option>
            <option value="performance">Performance</option>
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Priority</label>
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
        <label style={styles.label}>Description</label>
        <textarea 
          name="description" 
          placeholder="Describe your feature idea..."
          style={styles.textarea}
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          required
        />
      </div>
      <div style={styles.formActions}>
        <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
        <button type="submit" style={styles.submitBtn}>Submit Idea</button>
      </div>
    </form>
  );
}

function FeatureCard({ feature }) {
  const fetcher = useFetcher();

  const handleDelete = () => {
    if (confirm("Delete this suggestion?")) {
      const form = new FormData();
      form.append("_action", "deleteFeature");
      form.append("id", feature.id);
      fetcher.submit(form, { method: "post" });
    }
  };

  return (
    <div style={styles.featureCard}>
      <div style={styles.featureCardHeader}>
        <h3 style={styles.featureCardTitle}>{feature.title}</h3>
        <button style={styles.deleteBtn} onClick={handleDelete}>
          <svg style={styles.deleteIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <p style={styles.featureCardDesc}>{feature.description}</p>
      <div style={styles.featureCardFooter}>
        <span style={styles.categoryTag}>{feature.category}</span>
        <span style={styles.priorityTag}>{feature.priority}</span>
        <span style={styles.dateTag}>{new Date(feature.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const styles = {
  container: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  wrapper: {
    maxWidth: "1400px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
    flexWrap: "wrap",
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    margin: 0,
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    color: "#475569",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  btnIcon: {
    width: 16,
    height: 16,
    strokeWidth: 2,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 20,
    marginBottom: 32,
  },
  metricCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 24,
    transition: "box-shadow 0.2s",
  },
  metricCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    borderRadius: 10,
    color: "#475569",
  },
  changePositive: {
    fontSize: 12,
    fontWeight: 600,
    color: "#10b981",
    background: "#d1fae5",
    padding: "4px 8px",
    borderRadius: 6,
  },
  changeNegative: {
    fontSize: 12,
    fontWeight: 600,
    color: "#ef4444",
    background: "#fee2e2",
    padding: "4px 8px",
    borderRadius: 6,
  },
  metricCardTitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 500,
    marginBottom: 8,
  },
  metricCardValue: {
    fontSize: 32,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  metricCardSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
  },
  gridLayout: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr",
    gap: 24,
    marginBottom: 24,
  },
  leftCol: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  rightCol: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 24,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#0f172a",
    margin: 0,
    marginBottom: 24,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  titleIcon: {
    width: 20,
    height: 20,
    color: "#64748b",
    strokeWidth: 2,
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  statBox: {
    padding: 20,
    background: "#f8fafc",
    borderRadius: 10,
    textAlign: "center",
    border: "1px solid #e2e8f0",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 500,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  statValue: {
    fontSize: 32,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  statPercent: {
    fontSize: 13,
    color: "#475569",
    fontWeight: 500,
  },
  progressSection: {
    paddingTop: 20,
    borderTop: "1px solid #e2e8f0",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 500,
  },
  progressValue: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 600,
  },
  progressBar: {
    height: 8,
    background: "#e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#3b82f6",
    borderRadius: 10,
    transition: "width 0.5s ease",
  },
  metricsList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    background: "#f8fafc",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },
  metricLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  metricIcon: {
    width: 20,
    height: 20,
    color: "#64748b",
    strokeWidth: 2,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: "#0f172a",
    marginBottom: 2,
  },
  metricSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 700,
    color: "#0f172a",
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
    padding: 14,
    background: "#f8fafc",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },
  activityAvatar: {
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#e2e8f0",
    color: "#475569",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: 500,
    color: "#0f172a",
    marginBottom: 2,
  },
  activityMeta: {
    fontSize: 12,
    color: "#94a3b8",
  },
  badgeResolved: {
    fontSize: 11,
    fontWeight: 600,
    color: "#065f46",
    background: "#d1fae5",
    padding: "5px 10px",
    borderRadius: 6,
  },
  badgePending: {
    fontSize: 11,
    fontWeight: 600,
    color: "#92400e",
    background: "#fef3c7",
    padding: "5px 10px",
    borderRadius: 6,
  },
  emptyState: {
    textAlign: "center",
    padding: 48,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    color: "#cbd5e1",
    margin: "0 auto 16px",
    strokeWidth: 1.5,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: 500,
    color: "#64748b",
    margin: "0 0 4px 0",
  },
  emptySubtext: {
    fontSize: 13,
    color: "#94a3b8",
    margin: 0,
  },
  addBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  form: {
    padding: 20,
    background: "#f8fafc",
    borderRadius: 10,
    marginBottom: 20,
    border: "1px solid #e2e8f0",
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
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s",
  },
  select: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    background: "#fff",
    transition: "border-color 0.2s",
  },
  textarea: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical",
    minHeight: 80,
    transition: "border-color 0.2s",
  },
  formActions: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
  },
  cancelBtn: {
    padding: "10px 20px",
    background: "#fff",
    color: "#64748b",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  submitBtn: {
    padding: "10px 20px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  featureCard: {
    padding: 16,
    background: "#f8fafc",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },
  featureCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  featureCardTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#0f172a",
    margin: 0,
  },
  deleteBtn: {
    padding: 6,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#94a3b8",
    transition: "color 0.2s",
  },
  deleteIcon: {
    width: 18,
    height: 18,
    strokeWidth: 2,
  },
  featureCardDesc: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.5,
    margin: "0 0 12px 0",
  },
  featureCardFooter: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  categoryTag: {
    fontSize: 11,
    fontWeight: 600,
    color: "#3b82f6",
    background: "#dbeafe",
    padding: "4px 10px",
    borderRadius: 6,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  priorityTag: {
    fontSize: 11,
    fontWeight: 600,
    color: "#f59e0b",
    background: "#fef3c7",
    padding: "4px 10px",
    borderRadius: 6,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  dateTag: {
    fontSize: 11,
    fontWeight: 500,
    color: "#64748b",
    background: "#e2e8f0",
    padding: "4px 10px",
    borderRadius: 6,
  },
};