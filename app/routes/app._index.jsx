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
        <div style={styles.headerSection}>
          <div style={styles.headerLeft}>
            <div style={styles.headerBadge}>
              <span style={styles.badgeDot}></span>
              <span>Live Analytics</span>
            </div>
            <h1 style={styles.pageTitle}>Dashboard Overview</h1>
            <p style={styles.pageSubtitle}>Monitor your chat performance and customer engagement metrics</p>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.dateRange}>
              <svg style={styles.dateIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Last 3 Days</span>
            </div>
            <button style={styles.refreshButton} onClick={() => window.location.reload()}>
              <svg style={styles.buttonIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* METRICS GRID */}
        <div style={styles.metricsContainer}>
          <MetricCard 
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
            title="Total Conversations" 
            value={data.totalConversations}
            trend="+12%"
            trendUp={true}
          />
          <MetricCard 
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            title="Resolved" 
            value={data.resolvedChats}
            subtitle={`${data.resolutionRate}% success rate`}
            trend="+8%"
            trendUp={true}
          />
          <MetricCard 
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            title="Pending" 
            value={data.pendingChats}
            subtitle="Awaiting response"
            trend="-3%"
            trendUp={false}
          />
          <MetricCard 
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>}
            title="Messages" 
            value={data.totalMessages}
            subtitle="Total exchanged"
            trend="+15%"
            trendUp={true}
          />
        </div>

        {/* MAIN CONTENT GRID */}
        <div style={styles.contentGrid}>
          {/* LEFT SIDE */}
          <div style={styles.leftSection}>
            {/* RESOLUTION ANALYTICS */}
            <div style={styles.analyticsCard}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitleRow}>
                  <svg style={styles.cardIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h2 style={styles.cardTitle}>Resolution Analytics</h2>
                </div>
                <span style={styles.viewAll}>View Details →</span>
              </div>

              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statTop}>
                    <span style={styles.statLabel}>Resolved</span>
                    <div style={styles.statBadge} data-type="success">
                      <svg style={styles.badgeIcon} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div style={styles.statNumber}>{data.resolvedChats}</div>
                  <div style={styles.statFooter}>
                    <span style={styles.statPercent}>{data.resolutionRate}%</span>
                    <span style={styles.statChange} data-positive="true">↑ 8%</span>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statTop}>
                    <span style={styles.statLabel}>Pending</span>
                    <div style={styles.statBadge} data-type="warning">
                      <svg style={styles.badgeIcon} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div style={styles.statNumber}>{data.pendingChats}</div>
                  <div style={styles.statFooter}>
                    <span style={styles.statPercent}>{100 - data.resolutionRate}%</span>
                    <span style={styles.statChange} data-positive="false">↓ 3%</span>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statTop}>
                    <span style={styles.statLabel}>Total</span>
                    <div style={styles.statBadge} data-type="info">
                      <svg style={styles.badgeIcon} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div style={styles.statNumber}>{data.totalConversations}</div>
                  <div style={styles.statFooter}>
                    <span style={styles.statPercent}>100%</span>
                    <span style={styles.statChange} data-positive="true">↑ 12%</span>
                  </div>
                </div>
              </div>

              <div style={styles.progressSection}>
                <div style={styles.progressTop}>
                  <span style={styles.progressLabel}>Overall Resolution Rate</span>
                  <span style={styles.progressPercent}>{data.resolutionRate}%</span>
                </div>
                <div style={styles.progressTrack}>
                  <div style={{...styles.progressBar, width: `${data.resolutionRate}%`}}>
                    <span style={styles.progressGlow}></span>
                  </div>
                </div>
                <div style={styles.progressMarkers}>
                  <span style={styles.progressMarker}>0%</span>
                  <span style={styles.progressMarker}>25%</span>
                  <span style={styles.progressMarker}>50%</span>
                  <span style={styles.progressMarker}>75%</span>
                  <span style={styles.progressMarker}>100%</span>
                </div>
              </div>
            </div>

            {/* PERFORMANCE METRICS */}
            <div style={styles.performanceCard}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitleRow}>
                  <svg style={styles.cardIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <h2 style={styles.cardTitle}>Performance Metrics</h2>
                </div>
              </div>

              <div style={styles.performanceList}>
                <div style={styles.performanceItem}>
                  <div style={styles.performanceLeft}>
                    <div style={styles.performanceIconWrapper}>
                      <svg style={styles.performanceIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div style={styles.performanceTitle}>Assisted Revenue</div>
                      <div style={styles.performanceSubtitle}>From chat conversions</div>
                    </div>
                  </div>
                  <div style={styles.performanceValue}>₹{data.assistedRevenue.toLocaleString()}</div>
                </div>

                <div style={styles.performanceItem}>
                  <div style={styles.performanceLeft}>
                    <div style={styles.performanceIconWrapper}>
                      <svg style={styles.performanceIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <div style={styles.performanceTitle}>Chat-to-Sales Rate</div>
                      <div style={styles.performanceSubtitle}>Conversion percentage</div>
                    </div>
                  </div>
                  <div style={styles.performanceValue}>{data.chatToSalesRate}%</div>
                </div>

                <div style={styles.performanceItem}>
                  <div style={styles.performanceLeft}>
                    <div style={styles.performanceIconWrapper}>
                      <svg style={styles.performanceIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <div style={styles.performanceTitle}>Avg Response Time</div>
                      <div style={styles.performanceSubtitle}>Fast support delivery</div>
                    </div>
                  </div>
                  <div style={styles.performanceValue}>{data.avgResponseTime}</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div style={styles.rightSection}>
            {/* RECENT ACTIVITY */}
            <div style={styles.activityCard}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitleRow}>
                  <svg style={styles.cardIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 style={styles.cardTitle}>Recent Activity</h2>
                </div>
                <span style={styles.activityCount}>{data.recentChats.length}</span>
              </div>

              <div style={styles.activityList}>
                {data.recentChats.length > 0 ? (
                  data.recentChats.map((chat, index) => (
                    <div key={chat.sessionId} style={styles.activityRow}>
                      <div style={styles.activityAvatar}>
                        {chat.email ? chat.email.charAt(0).toUpperCase() : (index + 1)}
                      </div>
                      <div style={styles.activityInfo}>
                        <div style={styles.activityName}>
                          {chat.email || `Customer ${index + 1}`}
                        </div>
                        <div style={styles.activityDetails}>
                          <span>{chat.messages.length} messages</span>
                          <span style={styles.activityDot}>•</span>
                          <span>{new Date(chat.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {chat.isResolved ? (
                        <div style={styles.statusBadge} data-status="resolved">
                          <span style={styles.statusDot}></span>
                          Resolved
                        </div>
                      ) : (
                        <div style={styles.statusBadge} data-status="pending">
                          <span style={styles.statusDot}></span>
                          Pending
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIconWrapper}>
                      <svg style={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p style={styles.emptyTitle}>No Activity Yet</p>
                    <p style={styles.emptyText}>Your recent conversations will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE SUGGESTIONS */}
        <div style={styles.featureSection}>
          <div style={styles.featureHeader}>
            <div style={styles.cardTitleRow}>
              <svg style={styles.cardIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h2 style={styles.cardTitle}>Feature Suggestions</h2>
            </div>
            <button 
              style={styles.addFeatureBtn}
              onClick={() => setShowFeatureForm(!showFeatureForm)}
            >
              <svg style={styles.buttonIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showFeatureForm ? "Close Form" : "New Suggestion"}
            </button>
          </div>

          {showFeatureForm && <FeatureForm onClose={() => setShowFeatureForm(false)} />}

          {data.featureSuggestions && data.featureSuggestions.length > 0 ? (
            <div style={styles.featureGrid}>
              {data.featureSuggestions.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          ) : !showFeatureForm ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIconWrapper}>
                <svg style={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p style={styles.emptyTitle}>No Suggestions Yet</p>
              <p style={styles.emptyText}>Share your ideas to help us improve the platform</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */
function MetricCard({ icon, title, value, subtitle, trend, trendUp }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricTop}>
        <div style={styles.metricIconBox}>{icon}</div>
        {trend && (
          <span style={{...styles.trendBadge, ...(trendUp ? styles.trendUp : styles.trendDown)}}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div style={styles.metricTitle}>{title}</div>
      <div style={styles.metricValue}>{value}</div>
      {subtitle && <div style={styles.metricSubtitle}>{subtitle}</div>}
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
    <form onSubmit={handleSubmit} style={styles.featureForm}>
      <div style={styles.formRow}>
        <div style={styles.formField}>
          <label style={styles.formLabel}>Title</label>
          <input 
            type="text"
            name="title" 
            placeholder="Enter feature title"
            style={styles.formInput}
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
          />
        </div>
        <div style={styles.formField}>
          <label style={styles.formLabel}>Category</label>
          <select 
            name="category" 
            style={styles.formSelect}
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
        <div style={styles.formField}>
          <label style={styles.formLabel}>Priority</label>
          <select 
            name="priority" 
            style={styles.formSelect}
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
      <div style={styles.formField}>
        <label style={styles.formLabel}>Description</label>
        <textarea 
          name="description" 
          placeholder="Describe your feature idea in detail..."
          style={styles.formTextarea}
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          required
        />
      </div>
      <div style={styles.formActions}>
        <button type="button" style={styles.formCancelBtn} onClick={onClose}>Cancel</button>
        <button type="submit" style={styles.formSubmitBtn}>Submit Suggestion</button>
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
        <button style={styles.featureDeleteBtn} onClick={handleDelete}>
          <svg style={styles.deleteIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <p style={styles.featureCardDesc}>{feature.description}</p>
      <div style={styles.featureCardFooter}>
        <span style={styles.featureTag} data-type="category">{feature.category}</span>
        <span style={styles.featureTag} data-type="priority">{feature.priority}</span>
        <span style={styles.featureTag} data-type="date">{new Date(feature.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(to bottom, #f8fafc 0%, #f1f5f9 100%)",
    padding: "32px 24px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  },
  wrapper: {
    maxWidth: "1440px",
    margin: "0 auto",
  },
  headerSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
    flexWrap: "wrap",
    gap: 24,
  },
  headerLeft: {
    flex: 1,
  },
  headerBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: "#3b82f6",
    marginBottom: 12,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#10b981",
    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  },
  pageTitle: {
    fontSize: 36,
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
    marginBottom: 8,
    letterSpacing: "-0.5px",
  },
  pageSubtitle: {
    fontSize: 16,
    color: "#64748b",
    margin: 0,
    lineHeight: 1.5,
  },
  headerRight: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  dateRange: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    color: "#475569",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  dateIcon: {
    width: 18,
    height: 18,
    strokeWidth: 2,
  },
  refreshButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    background: "#3b82f6",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    color: "#ffffff",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 2px 4px rgba(59, 130, 246, 0.3)",
  },
  buttonIcon: {
    width: 18,
    height: 18,
    strokeWidth: 2,
  },
  metricsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 20,
    marginBottom: 32,
  },
  metricCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
    transition: "all 0.3s ease",
  },
  metricTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  metricIconBox: {
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
    borderRadius: 12,
    color: "#475569",
  },
  trendBadge: {
    fontSize: 12,
    fontWeight: 700,
    padding: "5px 10px",
    borderRadius: 8,
  },
  trendUp: {
    color: "#10b981",
    background: "#d1fae5",
  },
  trendDown: {
    color: "#ef4444",
    background: "#fee2e2",
  },
  metricTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  metricValue: {
    fontSize: 36,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: 24,
    marginBottom: 32,
  },
  leftSection: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  rightSection: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  analyticsCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  cardIcon: {
    width: 22,
    height: 22,
    color: "#64748b",
    strokeWidth: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#0f172a",
    margin: 0,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: 500,
    color: "#3b82f6",
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    padding: 20,
    background: "#f8fafc",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  statTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  statBadge: {
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  badgeIcon: {
    width: 16,
    height: 16,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 8,
  },
  statFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statPercent: {
    fontSize: 13,
    fontWeight: 500,
    color: "#475569",
  },
  statChange: {
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 6,
  },
  progressSection: {
    paddingTop: 24,
    borderTop: "1px solid #e2e8f0",
  },
  progressTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: "#64748b",
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
  },
  progressTrack: {
    height: 10,
    background: "#e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)",
    borderRadius: 10,
    transition: "width 0.6s ease",
    position: "relative",
    overflow: "hidden",
  },
  progressGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)",
    animation: "shimmer 2s infinite",
  },
  progressMarkers: {
    display: "flex",
    justifyContent: "space-between",
  },
  progressMarker: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: 500,
  },
  performanceCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
  },
  performanceList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  performanceItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    background: "#f8fafc",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  performanceLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  performanceIconWrapper: {
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },
  performanceIcon: {
    width: 20,
    height: 20,
    color: "#64748b",
    strokeWidth: 2,
  },
  performanceTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 2,
  },
  performanceSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#0f172a",
  },
  activityCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
  },
  activityCount: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    color: "#475569",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  activityRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 16,
    background: "#f8fafc",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    transition: "all 0.2s",
  },
  activityAvatar: {
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "#ffffff",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 4,
  },
  activityDetails: {
    fontSize: 12,
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  activityDot: {
    fontSize: 8,
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  },
  emptyState: {
    textAlign: "center",
    padding: 60,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
    borderRadius: 16,
    margin: "0 auto 20px",
  },
  emptyIcon: {
    width: 32,
    height: 32,
    color: "#cbd5e1",
    strokeWidth: 1.5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#64748b",
    margin: "0 0 8px 0",
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    margin: 0,
  },
  featureSection: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
  },
  featureHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  addFeatureBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    background: "#3b82f6",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    color: "#ffffff",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 2px 4px rgba(59, 130, 246, 0.3)",
  },
  featureForm: {
    padding: 24,
    background: "#f8fafc",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    marginBottom: 24,
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  formField: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  formInput: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s",
    background: "#ffffff",
  },
  formSelect: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    background: "#ffffff",
    cursor: "pointer",
  },
  formTextarea: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical",
    minHeight: 100,
    background: "#ffffff",
  },
  formActions: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-end",
  },
  formCancelBtn: {
    padding: "10px 24px",
    background: "#ffffff",
    color: "#64748b",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  formSubmitBtn: {
    padding: "10px 24px",
    background: "#3b82f6",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 2px 4px rgba(59, 130, 246, 0.3)",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: 16,
  },
  featureCard: {
    padding: 20,
    background: "#f8fafc",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    transition: "all 0.2s",
  },
  featureCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  featureCardTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#0f172a",
    margin: 0,
    flex: 1,
  },
  featureDeleteBtn: {
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
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.6,
    margin: "0 0 14px 0",
  },
  featureCardFooter: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  featureTag: {
    fontSize: 11,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 8,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
};

// Add CSS for status badge colors
const statusStyles = `
  [data-status="resolved"] {
    background: #d1fae5;
    color: #065f46;
  }
  [data-status="resolved"] .statusDot {
    background: #10b981;
  }
  [data-status="pending"] {
    background: #fef3c7;
    color: #92400e;
  }
  [data-status="pending"] .statusDot {
    background: #f59e0b;
  }
  [data-type="success"] {
    background: #d1fae5;
    color: #065f46;
  }
  [data-type="warning"] {
    background: #fef3c7;
    color: #92400e;
  }
  [data-type="info"] {
    background: #dbeafe;
    color: #1e40af;
  }
  [data-positive="true"] {
    color: #10b981;
    background: #d1fae5;
  }
  [data-positive="false"] {
    color: #ef4444;
    background: #fee2e2;
  }
  [data-type="category"] {
    background: #dbeafe;
    color: #1e40af;
  }
  [data-type="priority"] {
    background: #fef3c7;
    color: #92400e;
  }
  [data-type="date"] {
    background: #e2e8f0;
    color: #64748b;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = statusStyles;
  document.head.appendChild(styleSheet);
}