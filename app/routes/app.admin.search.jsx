// app/routes/app.search-analytics.jsx - SIMPLIFIED SEARCH-ONLY PAGE

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
  const filterDate = url.searchParams.get("date") || "all";
  const filterSearchType = url.searchParams.get("searchType") || "all";

  // Get all search logs
  let searchWhereCondition = { shop };

  // Apply search type filter
  if (filterSearchType !== "all") {
    searchWhereCondition.searchType = filterSearchType;
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
    
    searchWhereCondition.createdAt = { gte: fromDate };
  }

  // Get search logs
  let searchLogs = await prisma.searchLog.findMany({
    where: searchWhereCondition,
    orderBy: { createdAt: "desc" },
    take: 200, // Increased limit
  });

  // Apply query filter if exists
  if (searchQuery) {
    searchLogs = searchLogs.filter(log => {
      const queryMatch = log.query?.toLowerCase().includes(searchQuery.toLowerCase());
      const emailMatch = log.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());
      const sessionMatch = log.sessionId?.toLowerCase().includes(searchQuery.toLowerCase());
      const nameMatch = (log.firstName + " " + log.lastName)?.toLowerCase().includes(searchQuery.toLowerCase());
      return queryMatch || emailMatch || sessionMatch || nameMatch;
    });
  }

  const stats = {
    totalSearches: searchLogs.length,
    frontendSearches: searchLogs.filter(s => s.searchType === "frontend").length,
    adminSearches: searchLogs.filter(s => s.searchType === "admin").length,
    uniqueUsers: [...new Set(searchLogs.filter(s => s.userEmail && s.userEmail !== 'anonymous').map(s => s.userEmail))].length,
    topSearches: getTopSearches(searchLogs),
  };

  return json({
    searchLogs,
    stats,
    searchQuery,
    filterDate,
    filterSearchType,
  });
}

function getTopSearches(logs) {
  const searchCounts = {};
  logs.forEach(log => {
    const query = log.query?.toLowerCase();
    if (query) {
      searchCounts[query] = (searchCounts[query] || 0) + 1;
    }
  });
  
  return Object.entries(searchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));
}

/* ---------------- PAGE ---------------- */
export default function SearchAnalytics() {
  const data = useLoaderData();
  const [searchParams] = useSearchParams();
  const [selectedLog, setSelectedLog] = useState(null);
  const [searchInput, setSearchInput] = useState(data.searchQuery || "");

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>🔍 Search Analytics</h1>
            <p style={styles.subtitle}>Track all user searches from the widget</p>
          </div>
        </div>

        {/* STATS CARDS */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={{...styles.statIcon, background: '#dbeafe'}}>
              <svg fill="none" viewBox="0 0 24 24" stroke="#3b82f6" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Total Searches</div>
              <div style={styles.statValue}>{data.stats.totalSearches}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{...styles.statIcon, background: '#d1fae5'}}>
              <svg fill="none" viewBox="0 0 24 24" stroke="#10b981" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Unique Users</div>
              <div style={styles.statValue}>{data.stats.uniqueUsers}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{...styles.statIcon, background: '#fef3c7'}}>
              <svg fill="none" viewBox="0 0 24 24" stroke="#f59e0b" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Widget Searches</div>
              <div style={styles.statValue}>{data.stats.frontendSearches}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{...styles.statIcon, background: '#e0e7ff'}}>
              <svg fill="none" viewBox="0 0 24 24" stroke="#6366f1" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Admin Searches</div>
              <div style={styles.statValue}>{data.stats.adminSearches}</div>
            </div>
          </div>
        </div>

        {/* TOP SEARCHES */}
        {data.stats.topSearches.length > 0 && (
          <div style={styles.topSearchesCard}>
            <h3 style={styles.topSearchesTitle}>📊 Top Search Queries</h3>
            <div style={styles.topSearchesList}>
              {data.stats.topSearches.map((item, idx) => (
                <div key={idx} style={styles.topSearchItem}>
                  <div style={styles.topSearchRank}>{idx + 1}</div>
                  <div style={styles.topSearchQuery}>"{item.query}"</div>
                  <div style={styles.topSearchCount}>{item.count} searches</div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                placeholder="Search by query, user email, name, or session ID..."
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
                    window.location.href = window.location.pathname;
                  }}
                >
                  <svg style={styles.clearIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div style={styles.filters}>
              <select name="searchType" defaultValue={data.filterSearchType} style={styles.filterSelect}>
                <option value="all">All Sources</option>
                <option value="frontend">Widget Searches</option>
                <option value="admin">Admin Searches</option>
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

        {/* SEARCH LOGS LIST */}
        <div style={styles.contentGrid}>
          <div style={styles.searchLogsList}>
            <div style={styles.sessionListHeader}>
              <h2 style={styles.sectionTitle}>
                Search Logs ({data.searchLogs.length})
              </h2>
            </div>

            {data.searchLogs.length > 0 ? (
              <div style={styles.sessions}>
                {data.searchLogs.map((log, index) => (
                  <div
                    key={log.id}
                    style={{
                      ...styles.searchLogCard,
                      ...(selectedLog?.id === log.id ? styles.sessionCardActive : {})
                    }}
                    onClick={() => setSelectedLog(log)}
                  >
                    <div style={styles.logHeader}>
                      <div style={styles.logIconWrapper}>
                        {log.searchType === 'frontend' ? (
                          <div style={{...styles.logIcon, background: '#dbeafe', color: '#3b82f6'}}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={styles.logIconSvg}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        ) : (
                          <div style={{...styles.logIcon, background: '#fef3c7', color: '#f59e0b'}}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={styles.logIconSvg}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div style={styles.logInfo}>
                        <div style={styles.logQuery}>
                          "{log.query}"
                        </div>
                        <div style={styles.logMeta}>
                          <span style={styles.logType}>
                            {log.searchType === 'frontend' ? '📱 Widget' : '🖥️ Admin'}
                          </span>
                          {log.userEmail && log.userEmail !== 'anonymous' && (
                            <>
                              <span style={styles.metaDot}>•</span>
                              <span>{log.firstName || ''} {log.lastName || ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={styles.logDate}>
                      {new Date(log.createdAt).toLocaleString()}
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
                <h3 style={styles.emptyTitle}>No search logs found</h3>
                <p style={styles.emptyText}>Try adjusting your filters or wait for users to search</p>
              </div>
            )}
          </div>

          {/* SEARCH LOG DETAILS */}
          <div style={styles.messagePanel}>
            {selectedLog ? (
              <>
                <div style={styles.messagePanelHeader}>
                  <div style={styles.panelHeaderLeft}>
                    <div style={{...styles.panelAvatar, background: '#3b82f6'}}>
                      <svg fill="none" viewBox="0 0 24 24" stroke="white" style={styles.panelAvatarIcon}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div>
                      <div style={styles.panelTitle}>
                        Search Details
                      </div>
                      <div style={styles.panelSubtitle}>
                        {new Date(selectedLog.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div>
                    {selectedLog.searchType === 'frontend' ? (
                      <div style={{...styles.statusBadgeLarge, background: '#dbeafe', color: '#1e40af'}}>
                        <svg style={styles.badgeIconLarge} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                        </svg>
                        Widget Search
                      </div>
                    ) : (
                      <div style={{...styles.statusBadgeLarge, background: '#fef3c7', color: '#92400e'}}>
                        <svg style={styles.badgeIconLarge} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Admin Search
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.detailsContainer}>
                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Search Query</div>
                    <div style={styles.detailValue}>"{selectedLog.query}"</div>
                  </div>

                  {(selectedLog.firstName || selectedLog.lastName) && (
                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>User Name</div>
                      <div style={styles.detailValue}>
                        {selectedLog.firstName || ''} {selectedLog.lastName || ''}
                      </div>
                    </div>
                  )}

                  {selectedLog.userEmail && (
                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>User Email</div>
                      <div style={styles.detailValue}>
                        {selectedLog.userEmail === 'anonymous' ? (
                          <span style={{color: '#9ca3af'}}>Anonymous User</span>
                        ) : (
                          selectedLog.userEmail
                        )}
                      </div>
                    </div>
                  )}

                  {selectedLog.sessionId && (
                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>Session ID</div>
                      <div style={{...styles.detailValue, fontFamily: 'monospace', fontSize: 13}}>
                        {selectedLog.sessionId}
                      </div>
                    </div>
                  )}

                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Search Type</div>
                    <div style={styles.detailValue}>
                      {selectedLog.searchType === 'frontend' ? '📱 Widget Search (Customer)' : '🖥️ Admin Dashboard Search'}
                    </div>
                  </div>

                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Timestamp</div>
                    <div style={styles.detailValue}>
                      {new Date(selectedLog.createdAt).toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={styles.emptyPanel}>
                <div style={styles.emptyPanelIcon}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={styles.emptyPanelIconSvg}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 style={styles.emptyPanelTitle}>Select a search log</h3>
                <p style={styles.emptyPanelText}>Choose a search from the list to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
  topSearchesCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  topSearchesTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 16,
    margin: 0,
  },
  topSearchesList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  topSearchItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    background: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  },
  topSearchRank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "#3b82f6",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  topSearchQuery: {
    flex: 1,
    fontSize: 15,
    fontWeight: 600,
    color: "#111827",
  },
  topSearchCount: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 500,
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
  searchLogsList: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    overflow: "hidden",
    maxHeight: "calc(100vh - 600px)",
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
  searchLogCard: {
    padding: 16,
    borderBottom: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  sessionCardActive: {
    background: "#eff6ff",
    borderLeft: "3px solid #3b82f6",
  },
  logHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  logIconWrapper: {
    flexShrink: 0,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logIconSvg: {
    width: 20,
    height: 20,
    strokeWidth: 2,
  },
  logInfo: {
    flex: 1,
    minWidth: 0,
  },
  logQuery: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  logMeta: {
    fontSize: 12,
    color: "#9ca3af",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  logType: {
    fontWeight: 600,
  },
  logDate: {
    fontSize: 12,
    color: "#9ca3af",
    marginLeft: 52,
  },
  metaDot: {
    fontSize: 10,
  },
  messagePanel: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    minHeight: "calc(100vh - 600px)",
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
  panelAvatarIcon: {
    width: 24,
    height: 24,
    strokeWidth: 2,
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
  detailsContainer: {
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  detailSection: {
    paddingBottom: 20,
    borderBottom: "1px solid #e5e7eb",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 15,
    color: "#111827",
    lineHeight: 1.6,
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