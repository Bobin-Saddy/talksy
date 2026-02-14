// app/routes/app.search-analytics.jsx — WITH SEARCH BLUR + REAL-TIME UPDATES

import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useEffect } from "react"; // ✅ Added useEffect
import {
  getShopLimits,
  getSearchVisibilityLimit,
  applySearchBlur,
} from "../planLimits.server";

/* ---------------- HELPER FUNCTIONS ---------------- */
async function getShopifyCredentials(shop) {
  const session = await prisma.session.findFirst({
    where: { shop },
    orderBy: { expires: "desc" },
  });
  if (!session) throw new Error("Shop not authenticated");
  return { accessToken: session.accessToken, shop: session.shop };
}

async function shopifyGraphQL(shop, accessToken, query, variables = {}) {
  const response = await fetch(
    `https://${shop}/admin/api/2024-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  if (!response.ok)
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  return response.json();
}

async function getSearchResultDetails(shop, accessToken, query) {
  const results = { products: [], collections: [], pages: [] };
  const storeUrl = shop.replace(".myshopify.com", "");

  try {
    const productQuery = `
      query searchProducts($query: String!) {
        products(first: 5, query: $query) {
          edges {
            node {
              id title description handle
              featuredImage { url altText }
              priceRangeV2 { minVariantPrice { amount currencyCode } }
              onlineStoreUrl totalInventory status
            }
          }
        }
      }`;
    const productData = await shopifyGraphQL(shop, accessToken, productQuery, {
      query: `title:*${query}*`,
    });
    if (productData.data?.products?.edges) {
      results.products = productData.data.products.edges.map(({ node }) => ({
        id: node.id,
        title: node.title,
        description: node.description?.substring(0, 150) || "",
        image: node.featuredImage?.url || null,
        price: node.priceRangeV2?.minVariantPrice?.amount || "0",
        currency: node.priceRangeV2?.minVariantPrice?.currencyCode || "USD",
        url:
          node.onlineStoreUrl ||
          `https://${storeUrl}.myshopify.com/products/${node.handle}`,
        inventory: node.totalInventory || 0,
        status: node.status,
        type: "product",
      }));
    }
  } catch (e) {
    console.error("Product search error:", e);
  }

  try {
    const collectionQuery = `
      query searchCollections($query: String!) {
        collections(first: 5, query: $query) {
          edges {
            node { id title description handle image { url altText } productsCount }
          }
        }
      }`;
    const collectionData = await shopifyGraphQL(
      shop,
      accessToken,
      collectionQuery,
      { query: `title:*${query}*` }
    );
    if (collectionData.data?.collections?.edges) {
      results.collections = collectionData.data.collections.edges.map(
        ({ node }) => ({
          id: node.id,
          title: node.title,
          description: node.description?.substring(0, 150) || "",
          image: node.image?.url || null,
          productCount: node.productsCount || 0,
          url: `https://${storeUrl}.myshopify.com/collections/${node.handle}`,
          type: "collection",
        })
      );
    }
  } catch (e) {
    console.error("Collection search error:", e);
  }

  try {
    const pageQuery = `
      query searchPages($query: String!) {
        pages(first: 5, query: $query) {
          edges { node { id title handle bodySummary } }
        }
      }`;
    const pageData = await shopifyGraphQL(shop, accessToken, pageQuery, {
      query: `title:*${query}*`,
    });
    if (pageData.data?.pages?.edges) {
      results.pages = pageData.data.pages.edges.map(({ node }) => ({
        id: node.id,
        title: node.title,
        description: node.bodySummary?.substring(0, 150) || "",
        url: `https://${storeUrl}.myshopify.com/pages/${node.handle}`,
        type: "page",
      }));
    }
  } catch (e) {
    console.error("Page search error:", e);
  }

  return results;
}

/* ---------------- LOADER ---------------- */
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);

  const searchQuery = url.searchParams.get("q") || "";
  const filterDate = url.searchParams.get("date") || "all";
  const selectedLogId = url.searchParams.get("logId") || null;

  // ── Plan info ──────────────────────────────────────────────
  const { plan } = await getShopLimits(shop);
  const visibility = await getSearchVisibilityLimit(shop);

  // ── Build DB where clause ──────────────────────────────────
  let searchWhereCondition = { shop, searchType: "frontend" };

  if (filterDate !== "all") {
    const now = new Date();
    let fromDate = new Date();
    if (filterDate === "today") fromDate.setHours(0, 0, 0, 0);
    else if (filterDate === "week") fromDate.setDate(now.getDate() - 7);
    else if (filterDate === "month") fromDate.setMonth(now.getMonth() - 1);
    searchWhereCondition.createdAt = { gte: fromDate };
  }

  let searchLogs = await prisma.searchLog.findMany({
    where: searchWhereCondition,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (searchQuery) {
    searchLogs = searchLogs.filter((log) => {
      const queryMatch = log.query?.toLowerCase().includes(searchQuery.toLowerCase());
      const emailMatch = log.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());
      const sessionMatch = log.sessionId?.toLowerCase().includes(searchQuery.toLowerCase());
      const nameMatch = (log.firstName + " " + log.lastName)?.toLowerCase().includes(searchQuery.toLowerCase());
      return queryMatch || emailMatch || sessionMatch || nameMatch;
    });
  }

  // ── Apply blur to logs beyond free limit ───────────────────
  const processedLogs = applySearchBlur(searchLogs, visibility.visibleCount);

  const stats = {
    totalSearches: searchLogs.length,
    uniqueUsers: [
      ...new Set(
        searchLogs
          .filter((s) => s.userEmail && s.userEmail !== "anonymous")
          .map((s) => s.userEmail)
      ),
    ].length,
    topSearches: getTopSearches(searchLogs),
    blurredCount: processedLogs.filter((l) => l.isBlurred).length,
  };

  // ── Search results for selected (only if not blurred) ──────
  let searchResults = null;
  if (selectedLogId) {
    const selectedLog = processedLogs.find((log) => log.id === selectedLogId);
    if (selectedLog && !selectedLog.isBlurred) {
      try {
        const { accessToken } = await getShopifyCredentials(shop);
        searchResults = await getSearchResultDetails(
          shop,
          accessToken,
          selectedLog.query
        );
      } catch (error) {
        console.error("Error fetching search results:", error);
      }
    }
  }

  return json({
    searchLogs: processedLogs,
    stats,
    searchQuery,
    filterDate,
    selectedLogId,
    searchResults,
    plan,
    visibility,
  });
}

function getTopSearches(logs) {
  const searchCounts = {};
  logs.forEach((log) => {
    const query = log.query?.toLowerCase();
    if (query) searchCounts[query] = (searchCounts[query] || 0) + 1;
  });
  return Object.entries(searchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));
}

/* ---------------- UPGRADE BANNER ---------------- */
function UpgradeBanner({ blurredCount, plan }) {
  if (plan !== "FREE" || blurredCount === 0) return null;

  return (
    <div style={styles.upgradeBanner}>
      <div style={styles.upgradeBannerInner}>
        <div style={styles.upgradeLockIcon}>🔒</div>
        <div style={styles.upgradeText}>
          <div style={styles.upgradeTitle}>
            {blurredCount} searches are hidden on Free plan
          </div>
          <div style={styles.upgradeSubtext}>
            Free plan allows viewing only 2 searches. Upgrade to Standard or
            Premium to unlock all search history.
          </div>
        </div>
        <a href="/app/pricing" style={styles.upgradeBtn}>
          🚀 Upgrade Now
        </a>
      </div>
    </div>
  );
}

/* ---------------- BLURRED LOG CARD ---------------- */
function BlurredLogCard({ index }) {
  return (
    <div style={styles.blurredCard}>
      <div style={styles.blurredInner}>
        <div style={styles.blurredIconCircle}>
          <span style={{ fontSize: 20 }}>🔍</span>
        </div>
        <div style={styles.blurredTextBlock}>
          <div style={styles.blurredLine} />
          <div style={{ ...styles.blurredLine, width: "55%", marginTop: 8 }} />
        </div>
      </div>
      <div style={styles.blurredBadge}>
        🔒 Upgrade to unlock
      </div>
    </div>
  );
}

/* ---------------- BLURRED DETAIL PANEL ---------------- */
function BlurredDetailPanel() {
  return (
    <div style={styles.blurredPanelWrap}>
      <div style={styles.blurredPanelBox}>
        <div style={styles.blurredPanelIcon}>🔒</div>
        <h3 style={styles.blurredPanelTitle}>Search Locked</h3>
        <p style={styles.blurredPanelText}>
          This search is only visible on Standard or Premium plans.
          <br />
          Upgrade to see full search history, user details & product results.
        </p>
        <a href="/app/pricing" style={styles.blurredUpgradeBtn}>
          🚀 Upgrade Plan
        </a>
        <div style={styles.planCompare}>
          <div style={styles.planRow}>
            <span>Free</span>
            <span style={{ color: "#ef4444", fontWeight: 700 }}>2 searches visible</span>
          </div>
          <div style={styles.planRow}>
            <span>Standard</span>
            <span style={{ color: "#10b981", fontWeight: 700 }}>500 searches</span>
          </div>
          <div style={styles.planRow}>
            <span>Premium</span>
            <span style={{ color: "#8b5cf6", fontWeight: 700 }}>Unlimited ✨</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PAGE ---------------- */
export default function SearchAnalytics() {
  const data = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLog, setSelectedLog] = useState(
    data.searchLogs.find((log) => log.id === data.selectedLogId) || null
  );
  const [searchInput, setSearchInput] = useState(data.searchQuery || "");
  
  // ✅ Real-time state
  const [searchLogs, setSearchLogs] = useState(data.searchLogs);
  const [stats, setStats] = useState(data.stats);

  const handleLogClick = (log) => {
    if (log.isBlurred) return; // Don't allow clicking blurred logs
    setSelectedLog(log);
    setSearchParams({ logId: log.id });
  };

  // ✅ Real-time polling for search logs
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Build current URL with params (but fetch without logId to get all logs)
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('logId'); // Remove logId for polling
        
        console.log("🔄 Polling search analytics...");
        
        const response = await fetch(currentUrl.toString(), {
          headers: {
            'Accept': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          console.error("❌ Failed to fetch search analytics:", response.status);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.log("⏭️ Not JSON response, skipping");
          return;
        }

        const newData = await response.json();
        
        if (newData.searchLogs && newData.stats) {
          const oldCount = searchLogs.length;
          const newCount = newData.searchLogs.length;
          
          if (newCount !== oldCount) {
            console.log("🆕 New search logs detected!", {
              oldCount,
              newCount,
              newLogs: newCount - oldCount
            });
            
            // Show notification for new searches
            if (newCount > oldCount && "Notification" in window && Notification.permission === "granted") {
              new Notification("New Search Activity", {
                body: `${newCount - oldCount} new search${newCount - oldCount > 1 ? 'es' : ''} recorded`,
                icon: '/favicon.ico'
              });
            }
          }
          
          // ✅ Update state with new array references
          setSearchLogs([...newData.searchLogs]);
          setStats({...newData.stats});
          
          // ✅ Update selected log if it exists
          if (selectedLog) {
            const updatedSelectedLog = newData.searchLogs.find(log => log.id === selectedLog.id);
            if (updatedSelectedLog) {
              setSelectedLog({...updatedSelectedLog});
            }
          }
          
          console.log("✅ Search analytics updated successfully");
        }
      } catch (error) {
        console.error("❌ Search analytics polling error:", error);
      }
    }, 3000); // Poll every 3 seconds

    // Request notification permission on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => clearInterval(interval);
  }, [searchLogs, selectedLog]);

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>🔍 Widget Search Analytics</h1>
            <p style={styles.subtitle}>
              Track what users are searching for on your store
            </p>
          </div>
          {data.plan === "FREE" && (
            <div style={styles.planPill}>
              <span style={styles.planPillDot} />
              Free Plan — 2 searches visible
            </div>
          )}
        </div>

        {/* UPGRADE BANNER - Use local stats */}
        <UpgradeBanner
          blurredCount={stats.blurredCount}
          plan={data.plan}
        />

        {/* STATS - Use local stats */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="white" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Total Searches</div>
              <div style={styles.statValue}>{stats.totalSearches}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="white" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Unique Users</div>
              <div style={styles.statValue}>{stats.uniqueUsers}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="white" style={styles.statIconSvg}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Avg. Searches/User</div>
              <div style={styles.statValue}>
                {stats.uniqueUsers > 0
                  ? Math.round(stats.totalSearches / stats.uniqueUsers)
                  : 0}
              </div>
            </div>
          </div>

          {data.plan === "FREE" && stats.blurredCount > 0 && (
            <div style={{ ...styles.statCard, border: "2px solid #fbbf24" }}>
              <div style={{ ...styles.statIcon, background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" }}>
                <span style={{ fontSize: 26 }}>🔒</span>
              </div>
              <div>
                <div style={styles.statLabel}>Locked Searches</div>
                <div style={{ ...styles.statValue, color: "#ef4444" }}>
                  {stats.blurredCount}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TOP SEARCHES - Use local stats */}
        {stats.topSearches.length > 0 && (
          <div style={styles.topSearchesCard}>
            <h3 style={styles.topSearchesTitle}>📊 Top Search Queries</h3>
            <div style={styles.topSearchesList}>
              {stats.topSearches.map((item, idx) => (
                <div key={idx} style={styles.topSearchItem}>
                  <div style={{ ...styles.topSearchRank, background: idx === 0 ? "#fbbf24" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "#3b82f6" }}>
                    {idx + 1}
                  </div>
                  <div style={styles.topSearchQuery}>"{item.query}"</div>
                  <div style={styles.topSearchCount}>
                    <span style={{ fontWeight: 700, color: "#111827" }}>{item.count}</span>{" "}
                    searches
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ... REST OF THE JSX (filters, main grid, etc.) stays exactly the same but use searchLogs instead of data.searchLogs ... */}

        {/* FILTER */}
        <div style={styles.searchSection}>
          <Form method="get" style={styles.searchForm}>
            <div style={styles.searchInputWrapper}>
              <svg style={styles.searchIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                name="q"
                placeholder="Search by query, user email, or name..."
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

        {/* MAIN GRID */}
        <div style={styles.contentGrid}>
          {/* LEFT: Search Logs List - Use local searchLogs */}
          <div style={styles.searchLogsList}>
            <div style={styles.sessionListHeader}>
              <h2 style={styles.sectionTitle}>
                Search Logs ({searchLogs.length})
              </h2>
              {data.plan === "FREE" && stats.blurredCount > 0 && (
                <div style={styles.lockedBadge}>
                  🔒 {stats.blurredCount} locked
                </div>
              )}
            </div>

            {searchLogs.length > 0 ? (
              <div style={styles.sessions}>
                {searchLogs.map((log, idx) =>
                  log.isBlurred ? (
                    <BlurredLogCard key={log.id} index={idx} />
                  ) : (
                    <div
                      key={log.id}
                      style={{
                        ...styles.searchLogCard,
                        ...(selectedLog?.id === log.id
                          ? styles.sessionCardActive
                          : {}),
                      }}
                      onClick={() => handleLogClick(log)}
                    >
                      <div style={styles.logHeader}>
                        <div style={styles.logIconWrapper}>
                          <div style={styles.logIcon}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="white" style={styles.logIconSvg}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                        </div>
                        <div style={styles.logInfo}>
                          <div style={styles.logQuery}>"{log.query}"</div>
                          <div style={styles.logMeta}>
                            {log.userEmail && log.userEmail !== "anonymous" ? (
                              <span style={{ color: "#3b82f6", fontWeight: 600 }}>
                                {log.firstName || ""} {log.lastName || ""}
                              </span>
                            ) : (
                              <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                                Anonymous
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={styles.logDate}>
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={styles.emptyIconSvg}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 style={styles.emptyTitle}>No search logs found</h3>
                <p style={styles.emptyText}>
                  Searches from your widget will appear here
                </p>
              </div>
            )}
          </div>

          {/* RIGHT: Detail Panel - remains exactly the same */}
          <div style={styles.messagePanel}>
            {selectedLog ? (
              selectedLog.isBlurred ? (
                <BlurredDetailPanel />
              ) : (
                <>
                  {/* ... Detail panel content stays the same ... */}
                  <div style={styles.messagePanelHeader}>
                    <div style={styles.panelHeaderLeft}>
                      <div style={styles.panelAvatar}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="white" style={styles.panelAvatarIcon}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <div>
                        <div style={styles.panelTitle}>
                          Search: "{selectedLog.query}"
                        </div>
                        <div style={styles.panelSubtitle}>
                          {new Date(selectedLog.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* ... Rest of detail content ... */}
                </>
              )
            ) : (
              <div style={styles.emptyPanel}>
                <div style={styles.emptyPanelIcon}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={styles.emptyPanelIconSvg}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 style={styles.emptyPanelTitle}>Select a search log</h3>
                <p style={styles.emptyPanelText}>
                  Click on any search to see what results were found
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ... All styles remain exactly the same ... */
const styles = {
  container: { minHeight: "100vh", background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)", padding: "24px", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  // ... (rest of styles - copy exactly from your document)
};