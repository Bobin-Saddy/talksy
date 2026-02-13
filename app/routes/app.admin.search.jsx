// app/routes/app.search-analytics.jsx - WITH PLAN LIMIT ENFORCEMENT

import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getShopLimits } from "../planLimits.server";
import { useState } from "react";

async function getShopifyCredentials(shop) {
  const session = await prisma.session.findFirst({ where: { shop }, orderBy: { expires: "desc" } });
  if (!session) throw new Error("Shop not authenticated");
  return { accessToken: session.accessToken, shop: session.shop };
}

async function shopifyGraphQL(shop, accessToken, query, variables = {}) {
  const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`GraphQL failed: ${response.statusText}`);
  return response.json();
}

async function getSearchResultDetails(shop, accessToken, query) {
  const results = { products: [], collections: [], pages: [] };
  const storeUrl = shop.replace(".myshopify.com", "");
  try {
    const d = await shopifyGraphQL(shop, accessToken, `query($query:String!){products(first:5,query:$query){edges{node{id title description handle featuredImage{url} priceRangeV2{minVariantPrice{amount currencyCode}} onlineStoreUrl totalInventory status}}}}`, { query: `title:*${query}*` });
    if (d.data?.products?.edges) results.products = d.data.products.edges.map(({ node: n }) => ({ id: n.id, title: n.title, description: n.description?.substring(0, 150) || "", image: n.featuredImage?.url || null, price: n.priceRangeV2?.minVariantPrice?.amount || "0", currency: n.priceRangeV2?.minVariantPrice?.currencyCode || "USD", url: n.onlineStoreUrl || `https://${storeUrl}.myshopify.com/products/${n.handle}`, inventory: n.totalInventory || 0, type: "product" }));
  } catch (e) { console.error("Product error:", e); }
  try {
    const d = await shopifyGraphQL(shop, accessToken, `query($query:String!){collections(first:5,query:$query){edges{node{id title description handle image{url} productsCount}}}}`, { query: `title:*${query}*` });
    if (d.data?.collections?.edges) results.collections = d.data.collections.edges.map(({ node: n }) => ({ id: n.id, title: n.title, description: n.description?.substring(0, 150) || "", image: n.image?.url || null, productCount: n.productsCount || 0, url: `https://${storeUrl}.myshopify.com/collections/${n.handle}`, type: "collection" }));
  } catch (e) { console.error("Collection error:", e); }
  try {
    const d = await shopifyGraphQL(shop, accessToken, `query($query:String!){pages(first:5,query:$query){edges{node{id title handle bodySummary}}}}`, { query: `title:*${query}*` });
    if (d.data?.pages?.edges) results.pages = d.data.pages.edges.map(({ node: n }) => ({ id: n.id, title: n.title, description: n.bodySummary?.substring(0, 150) || "", url: `https://${storeUrl}.myshopify.com/pages/${n.handle}`, type: "page" }));
  } catch (e) { console.error("Page error:", e); }
  return results;
}

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("q") || "";
  const filterDate = url.searchParams.get("date") || "all";
  const selectedLogId = url.searchParams.get("logId") || null;

  const { limits, plan } = await getShopLimits(shop);
  const maxSearchUsers = limits.maxSearchUsers;

  let where = { shop, searchType: "frontend" };
  if (filterDate !== "all") {
    const now = new Date(), from = new Date();
    if (filterDate === "today") from.setHours(0, 0, 0, 0);
    else if (filterDate === "week") from.setDate(now.getDate() - 7);
    else if (filterDate === "month") from.setMonth(now.getMonth() - 1);
    where.createdAt = { gte: from };
  }

  let logs = await prisma.searchLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });

  if (searchQuery) {
    logs = logs.filter(l =>
      l.query?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.sessionId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.firstName + " " + l.lastName)?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // ✅ Determine which users are within the plan limit
  const allowedKeys = new Set();
  const allKeys = new Set();
  for (const log of logs) {
    const key = (log.userEmail && log.userEmail !== "anonymous") ? log.userEmail : (log.sessionId || `anon_${log.id}`);
    if (!allKeys.has(key)) {
      allKeys.add(key);
      if (maxSearchUsers === -1 || allowedKeys.size < maxSearchUsers) allowedKeys.add(key);
    }
  }

  const processedLogs = logs.map(log => {
    const key = (log.userEmail && log.userEmail !== "anonymous") ? log.userEmail : (log.sessionId || `anon_${log.id}`);
    return { ...log, isLocked: !allowedKeys.has(key) };
  });

  const stats = {
    totalSearches: logs.length,
    uniqueUsers: allKeys.size,
    topSearches: (() => {
      const c = {};
      logs.forEach(l => { if (l.query) c[l.query.toLowerCase()] = (c[l.query.toLowerCase()] || 0) + 1; });
      return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([q, n]) => ({ query: q, count: n }));
    })(),
  };

  let searchResults = null;
  const selLog = processedLogs.find(l => l.id === selectedLogId);
  if (selectedLogId && selLog && !selLog.isLocked) {
    try {
      const { accessToken } = await getShopifyCredentials(shop);
      searchResults = await getSearchResultDetails(shop, accessToken, selLog.query);
    } catch (e) { console.error("Search results error:", e); }
  }

  return json({ searchLogs: processedLogs, stats, searchQuery, filterDate, selectedLogId, searchResults, plan, maxSearchUsers, uniqueUserCount: allKeys.size });
}

export default function SearchAnalytics() {
  const data = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLog, setSelectedLog] = useState(data.searchLogs.find(l => l.id === data.selectedLogId) || null);
  const [searchInput, setSearchInput] = useState(data.searchQuery || "");

  const handleLogClick = (log) => {
    if (log.isLocked) { setSelectedLog(log); return; }
    setSelectedLog(log);
    setSearchParams({ logId: log.id });
  };

  const isOverLimit = data.maxSearchUsers !== -1 && data.uniqueUserCount > data.maxSearchUsers;
  const lockedCount = data.searchLogs.filter(l => l.isLocked).length;

  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* ✅ UPGRADE BANNER */}
        {isOverLimit && (
          <div style={S.banner}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 30 }}>🔒</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#9a3412", marginBottom: 3 }}>
                  Search limit reached — only <strong>{data.maxSearchUsers} users</strong> visible on your <strong>{data.plan}</strong> plan
                </div>
                <div style={{ fontSize: 13, color: "#c2410c" }}>
                  {data.uniqueUserCount - data.maxSearchUsers} user{data.uniqueUserCount - data.maxSearchUsers > 1 ? "s" : ""} hidden. Upgrade to <strong>Premium</strong> for unlimited access.
                </div>
              </div>
            </div>
            <a href="/app/subscription" style={S.bannerBtn}>⚡ Upgrade to Premium</a>
          </div>
        )}

        {/* HEADER */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={S.title}>🔍 Widget Search Analytics</h1>
          <p style={S.sub}>Track what users are searching for on your store</p>
        </div>

        {/* STATS */}
        <div style={S.statsGrid}>
          {[
            { label: "Total Searches", val: data.stats.totalSearches, bg: "linear-gradient(135deg,#667eea,#764ba2)", path: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
            { label: "Unique Users", val: `${data.stats.uniqueUsers}${data.maxSearchUsers !== -1 ? ` / ${data.maxSearchUsers}` : ""}`, bg: "linear-gradient(135deg,#f093fb,#f5576c)", path: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
            { label: "Avg / User", val: data.stats.uniqueUsers > 0 ? Math.round(data.stats.totalSearches / data.stats.uniqueUsers) : 0, bg: "linear-gradient(135deg,#4facfe,#00f2fe)", path: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
          ].map((s, i) => (
            <div key={i} style={S.statCard}>
              <div style={{ ...S.statIcon, background: s.bg }}>
                <svg fill="none" viewBox="0 0 24 24" stroke="white" style={{ width: 24, height: 24, strokeWidth: 2.5 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.path} /></svg>
              </div>
              <div>
                <div style={S.statLabel}>{s.label}</div>
                <div style={S.statVal}>{s.val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* TOP SEARCHES */}
        {data.stats.topSearches.length > 0 && (
          <div style={S.card}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 17, fontWeight: 700, color: "#111827" }}>📊 Top Search Queries</h3>
            {data.stats.topSearches.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#f9fafb", borderRadius: 9, border: "1px solid #e5e7eb", marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#cd7f32" : "#3b82f6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#111827" }}>"{item.query}"</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}><strong style={{ color: "#111827" }}>{item.count}</strong> searches</div>
              </div>
            ))}
          </div>
        )}

        {/* FILTER */}
        <div style={S.card}>
          <Form method="get" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 17, height: 17, color: "#9ca3af" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" name="q" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search by query, email, or name..." style={{ width: "100%", padding: "12px 44px", borderRadius: 9, border: "2px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", background: "#f9fafb", boxSizing: "border-box" }} />
              {searchInput && <button type="button" onClick={() => { setSearchInput(""); window.location.href = window.location.pathname; }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#f3f4f6", border: "none", cursor: "pointer", padding: 6, borderRadius: 6 }}><svg style={{ width: 15, height: 15, color: "#6b7280" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <select name="date" defaultValue={data.filterDate} style={{ padding: "10px 14px", borderRadius: 8, border: "2px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#f9fafb", cursor: "pointer", fontWeight: 600 }}>
                <option value="all">All Time</option><option value="today">Today</option><option value="week">Last 7 Days</option><option value="month">Last 30 Days</option>
              </select>
              <button type="submit" style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 22px", background: "linear-gradient(135deg,#667eea,#764ba2)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", marginLeft: "auto" }}>
                <svg style={{ width: 15, height: 15 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>Search
              </button>
            </div>
          </Form>
        </div>

        {/* CONTENT GRID */}
        <div style={S.grid}>

          {/* LEFT: LOG LIST */}
          <div style={S.logPanel}>
            <div style={{ padding: "16px 18px", borderBottom: "2px solid #e5e7eb", background: "linear-gradient(#f9fafb,#fff)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
                Search Logs ({data.searchLogs.length})
                {lockedCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#f97316", background: "#fff7ed", padding: "2px 8px", borderRadius: 6 }}>🔒 {lockedCount} locked</span>}
              </h2>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
              {data.searchLogs.length === 0 ? (
                <div style={{ padding: 50, textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                  <p style={{ color: "#6b7280", fontWeight: 600, margin: "0 0 4px 0" }}>No search logs found</p>
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>Searches from your widget will appear here</p>
                </div>
              ) : data.searchLogs.map(log => (
                <div key={log.id} onClick={() => handleLogClick(log)} style={{ ...S.logRow, ...(selectedLog?.id === log.id && !log.isLocked ? S.logRowActive : {}), ...(log.isLocked ? S.logRowLocked : {}) }}>
                  {log.isLocked ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 9, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 16 }}>🔒</span></div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#d1d5db", letterSpacing: "0.08em" }}>{log.query?.substring(0, 5) || "••"}••••</div>
                          <div style={{ fontSize: 11, color: "#e5e7eb", marginTop: 1 }}>Locked — Premium required</div>
                        </div>
                      </div>
                      <a href="/app/subscription" onClick={e => e.stopPropagation()} style={{ fontSize: 11, fontWeight: 700, color: "#f97316", padding: "4px 9px", border: "1.5px solid #fb923c", borderRadius: 6, background: "#fff7ed", textDecoration: "none" }}>Upgrade</a>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 9, background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg fill="none" viewBox="0 0 24 24" stroke="white" style={{ width: 18, height: 18, strokeWidth: 2.5 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{log.query}"</div>
                          <div style={{ fontSize: 11, marginTop: 2 }}>
                            {log.userEmail && log.userEmail !== "anonymous" ? <span style={{ color: "#3b82f6", fontWeight: 600 }}>{log.firstName || ""} {log.lastName || ""}</span> : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Anonymous</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginLeft: 48 }}>{new Date(log.createdAt).toLocaleString()}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: DETAIL */}
          <div style={S.detailPanel}>
            {selectedLog?.isLocked ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 60, textAlign: "center" }}>
                <div style={{ fontSize: 72, marginBottom: 20 }}>🔒</div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 12px 0" }}>Premium Plan Required</h3>
                <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.7, maxWidth: 380, margin: "0 0 28px 0" }}>
                  You've reached the <strong>{data.maxSearchUsers}-user</strong> limit on your <strong>{data.plan}</strong> plan.<br />
                  Upgrade to <strong>Premium</strong> for unlimited search analytics.
                </p>
                <a href="/app/subscription" style={{ display: "inline-block", padding: "13px 30px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", borderRadius: 11, fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 6px 20px rgba(249,115,22,.4)", marginBottom: 16 }}>⚡ Upgrade to Premium — Unlimited Access</a>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>✓ Unlimited users &nbsp;•&nbsp; ✓ Full history &nbsp;•&nbsp; ✓ Priority support</div>
              </div>
            ) : selectedLog ? (
              <>
                <div style={{ padding: "18px 22px", borderBottom: "2px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(#f9fafb,#fff)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="white" style={{ width: 22, height: 22, strokeWidth: 2.5 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Search: "{selectedLog.query}"</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{new Date(selectedLog.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ padding: 22, overflowY: "auto", flex: 1 }}>
                  <div style={{ marginBottom: 22, paddingBottom: 22, borderBottom: "2px solid #f3f4f6" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>👤 User Information</div>
                    {(selectedLog.firstName || selectedLog.lastName) && <div style={{ display: "flex", gap: 8, padding: 10, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 6 }}><span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, minWidth: 50 }}>Name:</span><span style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>{selectedLog.firstName} {selectedLog.lastName}</span></div>}
                    {selectedLog.userEmail && <div style={{ display: "flex", gap: 8, padding: 10, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}><span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, minWidth: 50 }}>Email:</span><span style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>{selectedLog.userEmail === "anonymous" ? <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Anonymous</span> : selectedLog.userEmail}</span></div>}
                  </div>
                  {data.searchResults ? (
                    <>
                      {data.searchResults.products.length > 0 && <Section title="Products" icon="🛍️" count={data.searchResults.products.length}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>{data.searchResults.products.map(p => <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}><div style={S.rCard}>{p.image ? <img src={p.image} alt={p.title} style={S.rImg} /> : <div style={S.rPlaceholder}>🛍️</div>}<div style={{ padding: 12 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.title}</div><div style={{ fontSize: 13, fontWeight: 800, background: "linear-gradient(135deg,#667eea,#764ba2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{p.currency} {parseFloat(p.price).toFixed(2)}</div>{p.inventory !== undefined && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>📦 {p.inventory} units</div>}<div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, marginTop: 5 }}>View →</div></div></div></a>)}</div></Section>}
                      {data.searchResults.collections.length > 0 && <Section title="Collections" icon="📁" count={data.searchResults.collections.length}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>{data.searchResults.collections.map(c => <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}><div style={S.rCard}>{c.image ? <img src={c.image} alt={c.title} style={S.rImg} /> : <div style={S.rPlaceholder}>📁</div>}<div style={{ padding: 12 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{c.title}</div><div style={{ fontSize: 11, color: "#6b7280" }}>📦 {c.productCount} products</div><div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, marginTop: 5 }}>View →</div></div></div></a>)}</div></Section>}
                      {data.searchResults.pages.length > 0 && <Section title="Pages" icon="📄" count={data.searchResults.pages.length}><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{data.searchResults.pages.map(p => <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}><div style={{ display: "flex", gap: 10, padding: 14, border: "2px solid #e5e7eb", borderRadius: 10, background: "#fff" }}><span style={{ fontSize: 28 }}>📄</span><div><div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{p.title}</div>{p.description && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{p.description}</div>}<div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 700 }}>View →</div></div></div></a>)}</div></Section>}
                      {!data.searchResults.products.length && !data.searchResults.collections.length && !data.searchResults.pages.length && <div style={{ textAlign: "center", padding: 44, background: "#f9fafb", borderRadius: 12 }}><div style={{ fontSize: 44, marginBottom: 12 }}>😕</div><div style={{ fontSize: 14, color: "#6b7280", fontWeight: 600 }}>No results found for "{selectedLog.query}"</div></div>}
                    </>
                  ) : <div style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>Loading results...</div>}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 50, textAlign: "center" }}>
                <div style={{ width: 70, height: 70, background: "linear-gradient(135deg,#f3f4f6,#e5e7eb)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 34, height: 34, color: "#d1d5db" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#6b7280", margin: "0 0 6px 0" }}>Select a search log</h3>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Click any search to see what results were found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, count, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{title} ({count})</span>
      </div>
      {children}
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "linear-gradient(135deg,#f5f7fa,#c3cfe2)", padding: 22, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' },
  wrap: { maxWidth: 1800, margin: "0 auto" },
  banner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, background: "linear-gradient(135deg,#fff7ed,#ffedd5)", border: "2px solid #fb923c", borderRadius: 13, padding: "14px 22px", marginBottom: 22 },
  bannerBtn: { padding: "9px 18px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", borderRadius: 9, fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(249,115,22,.35)" },
  title: { fontSize: 32, fontWeight: 800, margin: "0 0 4px 0", background: "linear-gradient(135deg,#667eea,#764ba2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  sub: { fontSize: 14, color: "#6b7280", margin: 0, fontWeight: 500 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16, marginBottom: 20 },
  statCard: { background: "#fff", borderRadius: 13, padding: 20, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 4px 6px -1px rgba(0,0,0,.08)" },
  statIcon: { width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statLabel: { fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" },
  statVal: { fontSize: 26, fontWeight: 800, color: "#111827" },
  card: { background: "#fff", borderRadius: 13, padding: 22, marginBottom: 20, boxShadow: "0 4px 6px -1px rgba(0,0,0,.08)" },
  grid: { display: "grid", gridTemplateColumns: "420px 1fr", gap: 20, alignItems: "start" },
  logPanel: { background: "#fff", borderRadius: 13, boxShadow: "0 4px 6px -1px rgba(0,0,0,.08)", overflow: "hidden", height: "calc(100vh - 420px)", minHeight: 520, display: "flex", flexDirection: "column", position: "sticky", top: 20 },
  logRow: { padding: 14, margin: "0 8px 4px 8px", borderRadius: 9, cursor: "pointer", border: "2px solid transparent", transition: "all .2s" },
  logRowActive: { background: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "2px solid #3b82f6" },
  logRowLocked: { cursor: "pointer", background: "#fafafa" },
  detailPanel: { background: "#fff", borderRadius: 13, boxShadow: "0 4px 6px -1px rgba(0,0,0,.08)", minHeight: "calc(100vh - 420px)", display: "flex", flexDirection: "column" },
  rCard: { border: "2px solid #e5e7eb", borderRadius: 11, overflow: "hidden", background: "#fff" },
  rImg: { width: "100%", height: 150, objectFit: "cover" },
  rPlaceholder: { width: "100%", height: 150, background: "linear-gradient(135deg,#f3f4f6,#e5e7eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 },
};