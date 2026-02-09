// app/routes/app.chat.search.jsx - WITH IMPROVED PLAN LIMITS
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { canSearchUsers } from "../planLimits.server";

const headers = { 
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to get Shopify access token from database
async function getShopifyCredentials(shop) {
  console.log("🔍 Looking for session for shop:", shop);
  
  const session = await prisma.session.findFirst({
    where: { shop: shop },
    orderBy: { expires: 'desc' }
  });
  
  if (!session) {
    console.error("❌ No session found for shop:", shop);
    
    // Let's check what shops we have
    const allSessions = await prisma.session.findMany({
      select: { shop: true }
    });
    console.log("📋 Available shops in database:", allSessions.map(s => s.shop));
    
    throw new Error("Shop not authenticated");
  }
  
  console.log("✅ Session found for shop:", shop);
  
  return {
    accessToken: session.accessToken,
    shop: session.shop
  };
}

// Helper function to make GraphQL requests
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
    const errorText = await response.text();
    console.error("GraphQL Error:", errorText);
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  return response.json();
}

// Helper function to get proper store URL
function getStoreUrl(shop, path) {
  return `https://${shop}${path}`;
}

export const loader = async ({ request }) => {
  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const query = url.searchParams.get("query");
  const type = url.searchParams.get("type") || "all";

  console.log("🔍 Search request:", { shop, query, type });

  if (!shop || !query) {
    return json({ error: "Missing shop or query" }, { status: 400, headers });
  }

  try {
    // ✅ CHECK PLAN LIMITS FOR SEARCH
    const searchLimit = await canSearchUsers(shop, 10);
    
    console.log("📊 Search limit check:", searchLimit);
    
    if (!searchLimit.allowed) {
      console.log("⛔ Search not allowed - plan limit reached");
      return json(
        { 
          error: "PLAN_LIMIT_REACHED",
          message: "Search feature requires a Standard or Premium plan. Please upgrade to continue.",
          upgradeUrl: `https://${shop}/admin/apps/talksy/app/subscription`,
          currentPlan: "FREE",
          results: {
            products: [],
            pages: [],
            orders: [],
            collections: []
          }
        }, 
        { status: 403, headers }
      );
    }

    // Get shop credentials
    const { accessToken } = await getShopifyCredentials(shop);

    const results = {
      products: [],
      pages: [],
      orders: [],
      collections: []
    };

    // ✅ Use plan-limited search count
    const maxResults = searchLimit.limit;
    console.log("✅ Max results allowed:", maxResults);

    // ✅ Search Products using GraphQL
    if (type === "all" || type === "products") {
      try {
        const productQuery = `
          query searchProducts($query: String!, $first: Int!) {
            products(first: $first, query: $query) {
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
                  variants(first: 1) {
                    edges {
                      node {
                        price
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const productData = await shopifyGraphQL(
          shop, 
          accessToken, 
          productQuery, 
          { 
            query: `title:*${query}*`,
            first: maxResults 
          }
        );
        
        if (productData.data?.products?.edges) {
          results.products = productData.data.products.edges.map(({ node }) => {
            let productUrl = node.onlineStoreUrl;
            if (!productUrl) {
              productUrl = getStoreUrl(shop, `/products/${node.handle}`);
            }
            
            return {
              id: node.id,
              title: node.title,
              description: node.description?.substring(0, 150) || '',
              image: node.featuredImage?.url || null,
              price: node.variants?.edges?.[0]?.node?.price || node.priceRangeV2?.minVariantPrice?.amount || "N/A",
              currency: node.priceRangeV2?.minVariantPrice?.currencyCode || "USD",
              url: productUrl,
              type: "product"
            };
          });
          console.log(`✅ Found ${results.products.length} products`);
        }
      } catch (error) {
        console.error("❌ Product search error:", error);
      }
    }

    // ✅ Search Pages using GraphQL
    if (type === "all" || type === "pages") {
      try {
        const pageQuery = `
          query searchPages($query: String!, $first: Int!) {
            pages(first: $first, query: $query) {
              edges {
                node {
                  id
                  title
                  handle
                  body
                  bodySummary
                }
              }
            }
          }
        `;

        const pageData = await shopifyGraphQL(
          shop, 
          accessToken, 
          pageQuery, 
          { 
            query: `title:*${query}*`,
            first: maxResults 
          }
        );
        
        if (pageData.data?.pages?.edges) {
          results.pages = pageData.data.pages.edges.map(({ node }) => ({
            id: node.id,
            title: node.title,
            description: node.bodySummary?.substring(0, 150) || node.body?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
            url: getStoreUrl(shop, `/pages/${node.handle}`),
            type: "page"
          }));
          console.log(`✅ Found ${results.pages.length} pages`);
        }
      } catch (error) {
        console.error("❌ Page search error:", error);
      }
    }

    // ✅ Search Orders using GraphQL
    if (type === "all" || type === "orders") {
      try {
        const orderQuery = `
          query searchOrders($query: String!, $first: Int!) {
            orders(first: $first, query: $query) {
              edges {
                node {
                  id
                  name
                  email
                  createdAt
                  displayFinancialStatus
                  displayFulfillmentStatus
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  lineItems(first: 3) {
                    edges {
                      node {
                        title
                        quantity
                        image {
                          url
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const orderData = await shopifyGraphQL(
          shop, 
          accessToken, 
          orderQuery, 
          { 
            query: `name:*${query}* OR email:*${query}*`,
            first: maxResults 
          }
        );
        
        if (orderData.data?.orders?.edges) {
          results.orders = orderData.data.orders.edges.map(({ node }) => ({
            id: node.id,
            orderNumber: node.name,
            email: node.email,
            total: node.totalPriceSet?.shopMoney?.amount || "0",
            currency: node.totalPriceSet?.shopMoney?.currencyCode || "USD",
            status: node.displayFinancialStatus,
            fulfillment: node.displayFulfillmentStatus,
            date: node.createdAt,
            items: node.lineItems?.edges?.map(({ node: item }) => ({
              title: item.title,
              quantity: item.quantity,
              image: item.image?.url || null
            })) || [],
            type: "order"
          }));
          console.log(`✅ Found ${results.orders.length} orders`);
        }
      } catch (error) {
        console.error("❌ Order search error:", error);
      }
    }

    // ✅ Search Collections using GraphQL
    if (type === "all" || type === "collections") {
      try {
        const collectionQuery = `
          query searchCollections($query: String!, $first: Int!) {
            collections(first: $first, query: $query) {
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

        const collectionData = await shopifyGraphQL(
          shop, 
          accessToken, 
          collectionQuery, 
          { 
            query: `title:*${query}*`,
            first: maxResults 
          }
        );
        
        if (collectionData.data?.collections?.edges) {
          results.collections = collectionData.data.collections.edges.map(({ node }) => ({
            id: node.id,
            title: node.title,
            description: node.description?.substring(0, 150) || '',
            image: node.image?.url || null,
            productCount: node.productsCount || 0,
            url: getStoreUrl(shop, `/collections/${node.handle}`),
            type: "collection"
          }));
          console.log(`✅ Found ${results.collections.length} collections`);
        }
      } catch (error) {
        console.error("❌ Collection search error:", error);
      }
    }

    const totalResults = 
      results.products.length + 
      results.pages.length + 
      results.orders.length + 
      results.collections.length;

    console.log(`✅ Search completed successfully - Total results: ${totalResults}`);
    
    return json({ 
      success: true, 
      results,
      planInfo: {
        searchLimit: searchLimit.planLimit === -1 ? "Unlimited" : searchLimit.planLimit,
        maxResultsPerQuery: maxResults,
        totalResultsReturned: totalResults,
      }
    }, { headers });
    
  } catch (error) {
    console.error("❌ Search Error:", error);
    
    return json({ 
      success: false,
      error: error.message,
      hint: "Make sure your Shopify app is installed and authenticated. Check the logs for available shops.",
      results: {
        products: [],
        pages: [],
        orders: [],
        collections: []
      }
    }, { status: 500, headers });
  }
};

// Also export action to handle POST if needed
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  
  // Redirect POST requests to use GET
  return loader({ request });
};