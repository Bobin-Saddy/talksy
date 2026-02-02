// app/routes/app.search-analytics.jsx - IMPROVED WITH PRODUCT DETAILS

import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState } from "react";

/* ---------------- HELPER FUNCTIONS ---------------- */
async function getShopifyCredentials(shop) {
  const session = await prisma.session.findFirst({
    where: { shop: shop },
    orderBy: { expires: 'desc' }
  });
  
  if (!session) {
    throw new Error("Shop not authenticated");
  }
  
  return {
    accessToken: session.accessToken,
    shop: session.shop
  };
}

async function shopifyGraphQL(shop, accessToken, query, variables = {}) {
  const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  return response.json();
}

async function getSearchResultDetails(shop, accessToken, query) {
  const results = {
    products: [],
    collections: [],
    pages: []
  };

  // Search Products
  try {
    const productQuery = `
      query searchProducts($query: String!) {
        products(first: 5, query: $query) {
          edges {
            node {
              id
              title
              description
              handle
              featuredImage {
                url
                altText
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              onlineStoreUrl
              totalInventory
              status
            }
          }
        }
      }
    `;

    const productData = await shopifyGraphQL(shop, accessToken, productQuery, { query: `title:*${query}*` });
    
    if (productData.data?.products?.edges) {
      results.products = productData.data.products.edges.map(({ node }) => ({
        id: node.id,
        title: node.title,
        description: node.description?.substring(0, 150) || '',
        image: node.featuredImage?.url || null,
        price: node.priceRangeV2?.minVariantPrice?.amount || "0",
        currency: node.priceRangeV2?.minVariantPrice?.currencyCode || "USD",
        url: node.onlineStoreUrl || `https://${shop.replace('.myshopify.com', '')}/products/${node.handle}`,
        inventory: node.totalInventory || 0,
        status: node.status,
        type: "product"
      }));
    }
  } catch (error) {
    console.error("Product search error:", error);
  }

  // Search Collections
  try {
    const collectionQuery = `
      query searchCollections($query: String!) {
        collections(first: 5, query: $query) {
          edges {
            node {
              id
              title
              description
              handle
              image {
                url
                altText
              }
              productsCount
            }
          }
        }
      }
    `;

    const collectionData = await shopifyGraphQL(shop, accessToken, collectionQuery, { query: `title:*${query}*` });
    
    if (collectionData.data?.collections?.edges) {
      results.collections = collectionData.data.collections.edges.map(({ node }) => ({
        id: node.id,
        title: node.title,
        description: node.description?.substring(0, 150) || '',
        image: node.image?.url || null,
        productCount: node.productsCount || 0,
        url: `https://${shop.replace('.myshopify.com', '')}/collections/${node.handle}`,
        type: "collection"
      }));
    }
  } catch (error) {
    console.error("Collection search error:", error);
  }

  // Search Pages
  try {
    const pageQuery = `
      query searchPages($query: String!) {
        pages(first: 5, query: $query) {
          edges {
            node {
              id
              title
              handle
              bodySummary
            }
          }
        }
      }
    `;

    const pageData = await shopifyGraphQL(shop, accessToken, pageQuery, { query: `title:*${query}*` });
    
    if (pageData.data?.pages?.edges) {
      results.pages = pageData.data.pages.edges.map(({ node }) => ({
        id: node.id,
        title: node.title,
        description: node.bodySummary?.substring(0, 150) || '',
        url: `https://${shop.replace('.myshopify.com', '')}/pages/${node.handle}`,
        type: "page"
      }));
    }
  } catch (error) {
    console.error("Page search error:", error);
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

  // Get all search logs (only frontend)
  let searchWhereCondition = { 
    shop,
    searchType: "frontend" // Only show widget searches
  };

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
    take: 200,
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
    uniqueUsers: [...new Set(searchLogs.filter(s => s.userEmail && s.userEmail !== 'anonymous').map(s => s.userEmail))].length,
    topSearches: getTopSearches(searchLogs),
  };

  // Get detailed results for selected log
  let searchResults = null;
  if (selectedLogId) {
    const selectedLog = searchLogs.find(log => log.id === selectedLogId);
    if (selectedLog) {
      try {
        const { accessToken } = await getShopifyCredentials(shop);
        searchResults = await getSearchResultDetails(shop, accessToken, selectedLog.query);
      } catch (error) {
        console.error("Error fetching search results:", error);
      }
    }
  }

  return json({
    searchLogs,
    stats,
    searchQuery,
    filterDate,
    selectedLogId,
    searchResults,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLog, setSelectedLog] = useState(
    data.searchLogs.find(log => log.id === data.selectedLogId) || null
  );
  const [searchInput, setSearchInput] = useState(data.searchQuery || "");

  const handleLogClick = (log) => {
    setSelectedLog(log);
    setSearchParams({ logId: log.id });
  };

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>🔍 Widget Search Analytics</h1>
            <p style={styles.subtitle}>Track what users are searching for on your store</p>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div style={styles.statLabel}>Avg. Searches/User</div>
              <div style={styles.statValue}>
                {data.stats.uniqueUsers > 0 ? Math.round(data.stats.totalSearches / data.stats.uniqueUsers) : 0}
              </div>
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
                    onClick={() => handleLogClick(log)}
                  >
                    <div style={styles.logHeader}>
                      <div style={styles.logIconWrapper}>
                        <div style={{...styles.logIcon, background: '#dbeafe', color: '#3b82f6'}}>
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={styles.logIconSvg}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      <div style={styles.logInfo}>
                        <div style={styles.logQuery}>
                          "{log.query}"
                        </div>
                        <div style={styles.logMeta}>
                          {log.userEmail && log.userEmail !== 'anonymous' ? (
                            <span>{log.firstName || ''} {log.lastName || ''}</span>
                          ) : (
                            <span style={{color: '#9ca3af'}}>Anonymous</span>
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
                <p style={styles.emptyText}>Searches from your widget will appear here</p>
              </div>
            )}
          </div>

          {/* SEARCH LOG DETAILS WITH RESULTS */}
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
                        Search: "{selectedLog.query}"
                      </div>
                      <div style={styles.panelSubtitle}>
                        {new Date(selectedLog.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.detailsContainer}>
                  {/* User Info */}
                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>User Information</div>
                    <div style={styles.userInfoGrid}>
                      {(selectedLog.firstName || selectedLog.lastName) && (
                        <div style={styles.infoItem}>
                          <span style={styles.infoLabel}>Name:</span>
                          <span style={styles.infoValue}>
                            {selectedLog.firstName || ''} {selectedLog.lastName || ''}
                          </span>
                        </div>
                      )}
                      {selectedLog.userEmail && (
                        <div style={styles.infoItem}>
                          <span style={styles.infoLabel}>Email:</span>
                          <span style={styles.infoValue}>
                            {selectedLog.userEmail === 'anonymous' ? (
                              <span style={{color: '#9ca3af'}}>Anonymous User</span>
                            ) : (
                              selectedLog.userEmail
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Search Results */}
                  {data.searchResults && (
                    <>
                      {/* Products */}
                      {data.searchResults.products.length > 0 && (
                        <div style={styles.resultsSection}>
                          <div style={styles.resultsSectionHeader}>
                            <span style={styles.resultsIcon}>🛍️</span>
                            <span style={styles.resultsTitle}>Products Found ({data.searchResults.products.length})</span>
                          </div>
                          <div style={styles.resultsGrid}>
                            {data.searchResults.products.map((product) => (
                              <div key={product.id} style={styles.resultCard}>
                                {product.image ? (
                                  <img src={product.image} alt={product.title} style={styles.resultImage} />
                                ) : (
                                  <div style={styles.resultImagePlaceholder}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="#d1d5db">
                                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                                <div style={styles.resultContent}>
                                  <div style={styles.resultTitle}>{product.title}</div>
                                  <div style={styles.resultPrice}>
                                    {product.currency} {parseFloat(product.price).toFixed(2)}
                                  </div>
                                  {product.inventory !== undefined && (
                                    <div style={styles.resultMeta}>
                                      Stock: {product.inventory} units
                                    </div>
                                  )}
                                  <a 
                                    href={product.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={styles.resultLink}
                                  >
                                    View Product →
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Collections */}
                      {data.searchResults.collections.length > 0 && (
                        <div style={styles.resultsSection}>
                          <div style={styles.resultsSectionHeader}>
                            <span style={styles.resultsIcon}>📁</span>
                            <span style={styles.resultsTitle}>Collections Found ({data.searchResults.collections.length})</span>
                          </div>
                          <div style={styles.resultsGrid}>
                            {data.searchResults.collections.map((collection) => (
                              <div key={collection.id} style={styles.resultCard}>
                                {collection.image ? (
                                  <img src={collection.image} alt={collection.title} style={styles.resultImage} />
                                ) : (
                                  <div style={styles.resultImagePlaceholder}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="#d1d5db">
                                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                  </div>
                                )}
                                <div style={styles.resultContent}>
                                  <div style={styles.resultTitle}>{collection.title}</div>
                                  <div style={styles.resultMeta}>
                                    {collection.productCount} products
                                  </div>
                                  {collection.description && (
                                    <div style={styles.resultDescription}>
                                      {collection.description}
                                    </div>
                                  )}
                                  <a 
                                    href={collection.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={styles.resultLink}
                                  >
                                    View Collection →
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pages */}
                      {data.searchResults.pages.length > 0 && (
                        <div style={styles.resultsSection}>
                          <div style={styles.resultsSectionHeader}>
                            <span style={styles.resultsIcon}>📄</span>
                            <span style={styles.resultsTitle}>Pages Found ({data.searchResults.pages.length})</span>
                          </div>
                          <div style={styles.pagesListWrapper}>
                            {data.searchResults.pages.map((page) => (
                              <div key={page.id} style={styles.pageItem}>
                                <div style={styles.pageIcon}>📄</div>
                                <div style={styles.pageContent}>
                                  <div style={styles.pageTitle}>{page.title}</div>
                                  {page.description && (
                                    <div style={styles.pageDescription}>{page.description}</div>
                                  )}
                                  <a 
                                    href={page.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={styles.pageLink}
                                  >
                                    View Page →
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No Results */}
                      {data.searchResults.products.length === 0 && 
                       data.searchResults.collections.length === 0 && 
                       data.searchResults.pages.length === 0 && (
                        <div style={styles.noResults}>
                          <div style={styles.noResultsIcon}>😕</div>
                          <div style={styles.noResultsText}>
                            No matching products, collections, or pages found for "{selectedLog.query}"
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
                <p style={styles.emptyPanelText}>Click on any search to see what results were found</p>
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
  },
  logDate: {
    fontSize: 12,
    color: "#9ca3af",
    marginLeft: 52,
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
  },
  detailsContainer: {
    padding: 24,
    overflowY: "auto",
    flex: 1,
  },
  detailSection: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottom: "1px solid #e5e7eb",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 12,
  },
  userInfoGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  infoItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: 500,
    minWidth: 60,
  },
  infoValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: 600,
  },
  resultsSection: {
    marginBottom: 32,
  },
  resultsSectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "2px solid #e5e7eb",
  },
  resultsIcon: {
    fontSize: 24,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111827",
  },
  resultsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 16,
  },
  resultCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    transition: "all 0.2s",
    cursor: "pointer",
    background: "#fff",
  },
  resultImage: {
    width: "100%",
    height: 160,
    objectFit: "cover",
  },
  resultImagePlaceholder: {
    width: "100%",
    height: 160,
    background: "#f3f4f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  resultContent: {
    padding: 12,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 8,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  resultPrice: {
    fontSize: 16,
    fontWeight: 700,
    color: "#3b82f6",
    marginBottom: 4,
  },
  resultMeta: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
  },
  resultDescription: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  resultLink: {
    fontSize: 13,
    color: "#3b82f6",
    textDecoration: "none",
    fontWeight: 600,
    display: "inline-block",
    marginTop: 4,
  },
  pagesListWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  pageItem: {
    display: "flex",
    gap: 12,
    padding: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
  },
  pageIcon: {
    fontSize: 32,
    flexShrink: 0,
  },
  pageContent: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 6,
  },
  pageDescription: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
  },
  pageLink: {
    fontSize: 13,
    color: "#3b82f6",
    textDecoration: "none",
    fontWeight: 600,
  },
  noResults: {
    textAlign: "center",
    padding: 40,
  },
  noResultsIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 15,
    color: "#6b7280",
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