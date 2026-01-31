import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState } from "react";

/* ---------------- LOADER ---------------- */
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  
  const searchQuery = url.searchParams.get("q") || "";
  const filterStatus = url.searchParams.get("status") || "all";
  const filterDate = url.searchParams.get("date") || "all";

  let whereCondition = { shop };

  // Apply status filter
  if (filterStatus !== "all") {
    whereCondition.isResolved = filterStatus === "resolved";
  }

  // Apply date filter
  if (filterDate !== "all") {
    const now = new Date();
    let fromDate = new Date();
    
    switch(filterDate) {
      case "today":
        fromDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        fromDate.setDate(now.getDate() - 7);
        break;
      case "month":
        fromDate.setMonth(now.getMonth() - 1);
        break;
    }
    
    whereCondition.createdAt = { gte: fromDate };
  }

  // Get all chat sessions
  let chatSessions = await prisma.chatSession.findMany({
    where: whereCondition,
    orderBy: { createdAt: "desc" },
    include: { 
      messages: {
        orderBy: { createdAt: "asc" }
      } 
    },
  });

  // Apply search filter if query exists
  if (searchQuery) {
    chatSessions = chatSessions.filter(session => {
      const emailMatch = session.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const sessionIdMatch = session.sessionId?.toLowerCase().includes(searchQuery.toLowerCase());
      const messageMatch = session.messages.some(msg => 
        msg.content?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return emailMatch || sessionIdMatch || messageMatch;
    });
  }

  const stats = {
    total: chatSessions.length,
    resolved: chatSessions.filter(s => s.isResolved).length,
    pending: chatSessions.filter(s => !s.isResolved).length,
    totalMessages: chatSessions.reduce((sum, s) => sum + s.messages.length, 0),
  };

  return json({
    chatSessions,
    stats,
    searchQuery,
    filterStatus,
    filterDate,
  });
}

/* ---------------- PAGE ---------------- */
export default function AdminSearch() {
  const data = useLoaderData();
  const [searchParams] = useSearchParams();
  const [selectedSession, setSelectedSession] = useState(null);
  const [searchInput, setSearchInput] = useState(data.searchQuery || "");

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Message Search</h1>
            <p style={styles.subtitle}>Search and view all conversations between users and admins</p>
          </div>
        </div>

        {/* STATS CARDS */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={{...styles.statIcon, background: '#dbeafe'}}>
              <svg fill="none" viewBox="0 0 24 24" stroke="#3b82f6" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Total Conversations</div>
              <div style={styles.statValue}>{data.stats.total}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{...styles.statIcon, background: '#d1fae5'}}>
              <svg fill="none" viewBox="0 0 24 24" stroke="#10b981" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Resolved</div>
              <div style={styles.statValue}>{data.stats.resolved}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{...styles.statIcon, background: '#fed7aa'}}>
              <svg fill="none" viewBox="0 0 24 24" stroke="#f97316" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Pending</div>
              <div style={styles.statValue}>{data.stats.pending}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{...styles.statIcon, background: '#e0e7ff'}}>
              <svg fill="none" viewBox="0 0 24 24" stroke="#6366f1" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Total Messages</div>
              <div style={styles.statValue}>{data.stats.totalMessages}</div>
            </div>
          </div>
        </div>

        {/* SEARCH AND FILTERS */}
        <div style={styles.searchSection}>
          <Form method="get" style={styles.searchForm}>
            <div style={styles.searchInputWrapper}>
              <svg style={styles.searchIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                name="q"
                placeholder="Search by email, session ID, or message content..."
                style={styles.searchInput}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  style={styles.clearBtn}
                  onClick={() => {
                    setSearchInput("");
                    window.location.href = "/admin/search";
                  }}
                >
                  <svg style={styles.clearIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div style={styles.filters}>
              <select name="status" defaultValue={data.filterStatus} style={styles.filterSelect}>
                <option value="all">All Status</option>
                <option value="resolved">Resolved</option>
                <option value="pending">Pending</option>
              </select>

              <select name="date" defaultValue={data.filterDate} style={styles.filterSelect}>
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>

              <button type="submit" style={styles.searchBtn}>
                <svg style={styles.btnIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
            </div>
          </Form>
        </div>

        {/* RESULTS */}
        <div style={styles.contentGrid}>
          {/* LEFT: SESSION LIST */}
          <div style={styles.sessionList}>
            <div style={styles.sessionListHeader}>
              <h2 style={styles.sectionTitle}>
                Conversations ({data.chatSessions.length})
              </h2>
            </div>

            {data.chatSessions.length > 0 ? (
              <div style={styles.sessions}>
                {data.chatSessions.map((session, index) => (
                  <div
                    key={session.sessionId}
                    style={{
                      ...styles.sessionCard,
                      ...(selectedSession?.sessionId === session.sessionId ? styles.sessionCardActive : {})
                    }}
                    onClick={() => setSelectedSession(session)}
                  >
                    <div style={styles.sessionHeader}>
                      <div style={{...styles.sessionAvatar, background: getAvatarColor(index)}}>
                        {session.email ? session.email.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div style={styles.sessionInfo}>
                        <div style={styles.sessionEmail}>
                          {session.email || `Anonymous User`}
                        </div>
                        <div style={styles.sessionMeta}>
                          <span style={styles.sessionId}>ID: {session.sessionId.substring(0, 8)}...</span>
                          <span style={styles.metaDot}>•</span>
                          <span>{session.messages.length} messages</span>
                        </div>
                      </div>
                      {session.isResolved ? (
                        <div style={{...styles.badge, background: '#d1fae5', color: '#065f46'}}>
                          Resolved
                        </div>
                      ) : (
                        <div style={{...styles.badge, background: '#fed7aa', color: '#9a3412'}}>
                          Pending
                        </div>
                      )}
                    </div>
                    <div style={styles.sessionDate}>
                      {new Date(session.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={styles.emptyIconSvg}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 style={styles.emptyTitle}>No conversations found</h3>
                <p style={styles.emptyText}>Try adjusting your search or filters</p>
              </div>
            )}
          </div>

          {/* RIGHT: MESSAGE DETAILS */}
          <div style={styles.messagePanel}>
            {selectedSession ? (
              <>
                <div style={styles.messagePanelHeader}>
                  <div style={styles.panelHeaderLeft}>
                    <div style={{...styles.panelAvatar, background: getAvatarColor(0)}}>
                      {selectedSession.email ? selectedSession.email.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <div style={styles.panelTitle}>
                        {selectedSession.email || 'Anonymous User'}
                      </div>
                      <div style={styles.panelSubtitle}>
                        Session: {selectedSession.sessionId}
                      </div>
                    </div>
                  </div>
                  <div>
                    {selectedSession.isResolved ? (
                      <div style={{...styles.statusBadgeLarge, background: '#d1fae5', color: '#065f46'}}>
                        <svg style={styles.badgeIconLarge} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Resolved
                      </div>
                    ) : (
                      <div style={{...styles.statusBadgeLarge, background: '#fed7aa', color: '#9a3412'}}>
                        <svg style={styles.badgeIconLarge} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        Pending
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.messagesContainer}>
                  {selectedSession.messages.map((message, idx) => (
                    <div
                      key={idx}
                      style={{
                        ...styles.messageItem,
                        ...(message.role === 'user' ? styles.messageUser : styles.messageAdmin)
                      }}
                    >
                      <div style={styles.messageHeader}>
                        <div style={styles.messageRole}>
                          {message.role === 'user' ? (
                            <>
                              <svg style={styles.roleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              User
                            </>
                          ) : (
                            <>
                              <svg style={styles.roleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                              Admin
                            </>
                          )}
                        </div>
                        <div style={styles.messageTime}>
                          {new Date(message.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div style={styles.messageContent}>
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={styles.emptyPanel}>
                <div style={styles.emptyPanelIcon}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={styles.emptyPanelIconSvg}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 style={styles.emptyPanelTitle}>Select a conversation</h3>
                <p style={styles.emptyPanelText}>Choose a conversation from the list to view messages</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- HELPER FUNCTIONS ---------------- */
function getAvatarColor(index) {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  return colors[index % colors.length];
}

/* ---------------- STYLES ---------------- */
const styles = {
  container: {
    minHeight: "100vh",
    background: "#f9fafb",
    padding: "32px 24px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  wrapper: {
    maxWidth: "1600px",
    margin: "0 auto",
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    margin: 0,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 20,
    marginBottom: 32,
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 20,
    display: "flex",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statIconSvg: {
    width: 24,
    height: 24,
    strokeWidth: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#6b7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#111827",
  },
  searchSection: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  searchForm: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  searchInputWrapper: {
    position: "relative",
    flex: 1,
  },
  searchIcon: {
    position: "absolute",
    left: 16,
    top: "50%",
    transform: "translateY(-50%)",
    width: 20,
    height: 20,
    color: "#9ca3af",
    strokeWidth: 2,
  },
  searchInput: {
    width: "100%",
    padding: "12px 48px 12px 48px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s",
  },
  clearBtn: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    transition: "background 0.2s",
  },
  clearIcon: {
    width: 18,
    height: 18,
    color: "#9ca3af",
    strokeWidth: 2,
  },
  filters: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  filterSelect: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    background: "#ffffff",
    cursor: "pointer",
    minWidth: 150,
  },
  searchBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 24px",
    background: "#3b82f6",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#ffffff",
    cursor: "pointer",
    transition: "background 0.2s",
    marginLeft: "auto",
  },
  btnIcon: {
    width: 18,
    height: 18,
    strokeWidth: 2,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "400px 1fr",
    gap: 24,
    alignItems: "start",
  },
  sessionList: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    overflow: "hidden",
    maxHeight: "calc(100vh - 450px)",
    display: "flex",
    flexDirection: "column",
  },
  sessionListHeader: {
    padding: 20,
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#111827",
    margin: 0,
  },
  sessions: {
    overflowY: "auto",
    flex: 1,
  },
  sessionCard: {
    padding: 16,
    borderBottom: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "background 0.2s",
    ":hover": {
      background: "#f9fafb",
    },
  },
  sessionCardActive: {
    background: "#eff6ff",
    borderLeft: "3px solid #3b82f6",
  },
  sessionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  sessionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
  },
  sessionEmail: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sessionMeta: {
    fontSize: 12,
    color: "#9ca3af",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  sessionId: {
    fontFamily: "monospace",
  },
  metaDot: {
    fontSize: 10,
  },
  badge: {
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    flexShrink: 0,
  },
  sessionDate: {
    fontSize: 12,
    color: "#9ca3af",
    marginLeft: 52,
  },
  messagePanel: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    minHeight: "calc(100vh - 450px)",
    display: "flex",
    flexDirection: "column",
  },
  messagePanelHeader: {
    padding: 20,
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#f9fafb",
  },
  panelHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  panelAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 700,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 2,
  },
  panelSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "monospace",
  },
  statusBadgeLarge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
  badgeIconLarge: {
    width: 18,
    height: 18,
  },
  messagesContainer: {
    padding: 24,
    overflowY: "auto",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  messageItem: {
    padding: 16,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
  },
  messageUser: {
    background: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  messageAdmin: {
    background: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  messageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  messageRole: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#374151",
  },
  roleIcon: {
    width: 14,
    height: 14,
    strokeWidth: 2,
  },
  messageTime: {
    fontSize: 11,
    color: "#9ca3af",
  },
  messageContent: {
    fontSize: 14,
    color: "#1f2937",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  emptyState: {
    padding: 60,
    textAlign: "center",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    margin: "0 auto 20px",
    background: "#f3f4f6",
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconSvg: {
    width: 32,
    height: 32,
    color: "#d1d5db",
    strokeWidth: 1.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#6b7280",
    margin: "0 0 8px 0",
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    margin: 0,
  },
  emptyPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: 60,
  },
  emptyPanelIcon: {
    width: 80,
    height: 80,
    background: "#f3f4f6",
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyPanelIconSvg: {
    width: 40,
    height: 40,
    color: "#d1d5db",
    strokeWidth: 1.5,
  },
  emptyPanelTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: "#6b7280",
    margin: "0 0 8px 0",
  },
  emptyPanelText: {
    fontSize: 15,
    color: "#9ca3af",
    margin: 0,
  },
};