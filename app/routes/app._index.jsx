import { json } from "@remix-run/node";
import { useLoaderData } from "react-router";
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
    take: 10,
    include: { messages: true },
  });

  // Count total searches from frontend
  const totalSearches = await prisma.searchLog.count({
    where: { shop, createdAt: { gte: fromDate } },
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
    totalSearches,
  });
}

/* ---------------- PAGE ---------------- */
export default function ChatAnalytics() {
  const data = useLoaderData();

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

        {/* METRICS GRID - CORRECTED LAYOUT */}
        <div style={styles.metricsContainer}>
          <MetricCard 
            icon={
              <div style={{...styles.colorfulIcon, background: '#10b981'}}>
                <svg fill="none" viewBox="0 0 24 24" stroke="white" style={styles.iconSvg}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            }
            title="Total Conversations" 
            value={data.totalConversations}
            trend="+16.45%"
            trendUp={true}
            subtitle="0% success rate"
          />
          <MetricCard 
            icon={
              <div style={{...styles.colorfulIcon, background: '#3b82f6'}}>
                <svg fill="none" viewBox="0 0 24 24" stroke="white" style={styles.iconSvg}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            }
            title="Resolved" 
            value={data.resolvedChats}
            subtitle="0% success rate"
            trend="-3.75%"
            trendUp={false}
          />
          <MetricCard 
            icon={
              <div style={{...styles.colorfulIcon, background: '#f97316'}}>
                <svg fill="none" viewBox="0 0 24 24" stroke="white" style={styles.iconSvg}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            }
            title="Pending" 
            value={data.pendingChats}
            subtitle="Awaiting response"
            trend="+3%"
            trendUp={true}
          />
          <MetricCard 
            icon={
              <div style={{...styles.colorfulIcon, background: '#06b6d4'}}>
                <svg fill="none" viewBox="0 0 24 24" stroke="white" style={styles.iconSvg}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
            }
            title="Messages" 
            value={data.totalMessages}
            subtitle="Total exchanged"
            trend="+6%"
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
                    <span style={styles.statTrend} data-positive="true">↑ +16.45%</span>
                  </div>
                  <div style={styles.statNumber}>{data.resolvedChats}</div>
                  <div style={styles.statFooter}>
                    <span style={styles.statPercent}>0%</span>
                    <div style={{...styles.statBadge, background: '#3b82f6'}}>
                      <svg style={styles.badgeIcon} fill="white" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statTop}>
                    <span style={styles.statLabel}>Pending</span>
                    <span style={styles.statTrend} data-positive="false">↓ -3.75%</span>
                  </div>
                  <div style={styles.statNumber}>{data.pendingChats}</div>
                  <div style={styles.statFooter}>
                    <span style={styles.statPercent}>100%</span>
                    <div style={{...styles.statBadge, background: '#f97316'}}>
                      <svg style={styles.badgeIcon} fill="white" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statTop}>
                    <span style={styles.statLabel}>Total</span>
                    <span style={styles.statTrend} data-positive="true">↑ +3%</span>
                  </div>
                  <div style={styles.statNumber}>{data.totalConversations}</div>
                  <div style={styles.statFooter}>
                    <span style={styles.statPercent}>100%</span>
                    <div style={{...styles.statBadge, background: '#06b6d4'}}>
                      <svg style={styles.badgeIcon} fill="white" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statTop}>
                    <span style={styles.statLabel}>Total Search</span>
                    <span style={styles.statTrend} data-positive="true">↑ +3%</span>
                  </div>
                  <div style={styles.statNumber}>{data.totalSearches || 0}</div>
                  <div style={styles.statFooter}>
                    <span style={styles.statPercent}>100%</span>
                    <div style={{...styles.statBadge, background: '#a855f7'}}>
                      <svg style={styles.badgeIcon} fill="white" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
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
                    <div style={{...styles.performanceIconWrapper, background: '#3b82f6'}}>
                      <svg style={styles.performanceIcon} fill="none" viewBox="0 0 24 24" stroke="white">
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
                    <div style={{...styles.performanceIconWrapper, background: '#10b981'}}>
                      <svg style={styles.performanceIcon} fill="none" viewBox="0 0 24 24" stroke="white">
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
                    <div style={{...styles.performanceIconWrapper, background: '#06b6d4'}}>
                      <svg style={styles.performanceIcon} fill="none" viewBox="0 0 24 24" stroke="white">
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
                <span style={styles.viewAll}>View All →</span>
              </div>

              <div style={styles.activityList}>
                {data.recentChats.length > 0 ? (
                  data.recentChats.map((chat, index) => {
                    const colors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                    const bgColor = colors[index % colors.length];
                    return (
                      <div key={chat.sessionId} style={styles.activityRow}>
                        <div style={{...styles.activityAvatar, background: bgColor}}>
                          {chat.email ? chat.email.charAt(0).toUpperCase() : (index + 1)}
                        </div>
                        <div style={styles.activityInfo}>
                          <div style={styles.activityName}>
                            {chat.email || `Customer ${index + 1}`}
                          </div>
                          <div style={styles.activityDetails}>
                            <span>{chat.messages.length} messages</span>
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
                    );
                  })
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
      </div>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */
function MetricCard({ icon, title, value, subtitle, trend, trendUp }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricHeader}>
        <div style={styles.metricTitle}>{title}</div>
        {trend && (
          <span style={{...styles.trendBadge, color: trendUp ? '#10b981' : '#ef4444'}}>
            {trend}
          </span>
        )}
      </div>
      <div style={styles.metricValue}>{value}</div>
      {subtitle && <div style={styles.metricSubtitle}>{subtitle}</div>}
      <div style={styles.metricIconBottom}>{icon}</div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const styles = {
  container: {
    minHeight: "100vh",
    background: "#f9fafb",
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
    border: "1px solid #e5e7eb",
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
    fontSize: 28,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
    marginBottom: 8,
    letterSpacing: "-0.5px",
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#6b7280",
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
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  },
  dateIcon: {
    width: 16,
    height: 16,
    strokeWidth: 2,
  },
  refreshButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    background: "#3b82f6",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#ffffff",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 1px 2px rgba(59, 130, 246, 0.5)",
  },
  buttonIcon: {
    width: 16,
    height: 16,
    strokeWidth: 2,
  },
  metricsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  metricCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    position: "relative",
  },
  metricHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  trendBadge: {
    fontSize: 12,
    fontWeight: 600,
  },
  metricTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "#6b7280",
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 12,
  },
  metricIconBottom: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  colorfulIcon: {
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    flexShrink: 0,
  },
  iconSvg: {
    width: 24,
    height: 24,
    strokeWidth: 2,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: 24,
    marginBottom: 24,
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
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  cardIcon: {
    width: 20,
    height: 20,
    color: "#6b7280",
    strokeWidth: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#111827",
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
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    padding: 16,
    background: "#f9fafb",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
  },
  statTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  statTrend: {
    fontSize: 11,
    fontWeight: 600,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 8,
  },
  statFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statPercent: {
    fontSize: 12,
    fontWeight: 500,
    color: "#6b7280",
  },
  statBadge: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  badgeIcon: {
    width: 18,
    height: 18,
  },
  progressSection: {
    paddingTop: 20,
    borderTop: "1px solid #e5e7eb",
  },
  progressTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#6b7280",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
  },
  progressTrack: {
    height: 8,
    background: "#e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)",
    borderRadius: 8,
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
    color: "#9ca3af",
    fontWeight: 500,
  },
  performanceCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  performanceList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  performanceItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    background: "#f9fafb",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
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
    borderRadius: 10,
  },
  performanceIcon: {
    width: 22,
    height: 22,
    strokeWidth: 2,
  },
  performanceTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 2,
  },
  performanceSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
  },
  activityCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  activityRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 14,
    background: "#f9fafb",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
  },
  activityAvatar: {
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 4,
  },
  activityDetails: {
    fontSize: 12,
    color: "#9ca3af",
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 6,
    fontSize: 11,
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
    background: "#f9fafb",
    borderRadius: 16,
    margin: "0 auto 20px",
  },
  emptyIcon: {
    width: 32,
    height: 32,
    color: "#d1d5db",
    strokeWidth: 1.5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#6b7280",
    margin: "0 0 8px 0",
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    margin: 0,
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
  [data-positive="true"] {
    color: #10b981;
  }
  [data-positive="false"] {
    color: #ef4444;
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