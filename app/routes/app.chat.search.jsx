// app/routes/app.chat.search.jsx - UPDATED WITH PROPER CORS AND FIXED URLs

import { json } from "@remix-run/node";
import prisma from "../db.server";

const headers = { 
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to get Shopify access token from database
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
  // If shop is like "mystore.myshopify.com", we need to use it as is or get custom domain
  // For now, we'll keep the myshopify.com domain for admin links
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

  console.log("Search request:", { shop, query, type });

  if (!shop || !query) {
    return json({ error: "Missing shop or query" }, { status: 400, headers });
  }

  try {
    // Get shop credentials
    const { accessToken } = await getShopifyCredentials(shop);

    const results = {
      products: [],
      pages: [],
      orders: [],
      collections: []
    };

    // ✅ Search Products using GraphQL
    if (type === "all" || type === "products") {
      try {
        const productQuery = `
          query searchProducts($query: String!) {
            products(first: 10, query: $query) {
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
          { query: `title:*${query}*` }
        );
        
        if (productData.data?.products?.edges) {
          results.products = productData.data.products.edges.map(({ node }) => {
            // Use onlineStoreUrl if available, otherwise construct URL with myshopify.com
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
        }
      } catch (error) {
        console.error("Product search error:", error);
      }
    }

    // ✅ Search Pages using GraphQL
    if (type === "all" || type === "pages") {
      try {
        const pageQuery = `
          query searchPages($query: String!) {
            pages(first: 10, query: $query) {
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
          { query: `title:*${query}*` }
        );
        
        if (pageData.data?.pages?.edges) {
          results.pages = pageData.data.pages.edges.map(({ node }) => ({
            id: node.id,
            title: node.title,
            description: node.bodySummary?.substring(0, 150) || node.body?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
            url: getStoreUrl(shop, `/pages/${node.handle}`),
            type: "page"
          }));
        }
      } catch (error) {
        console.error("Page search error:", error);
      }
    }

    // ✅ Search Orders using GraphQL
    if (type === "all" || type === "orders") {
      try {
        const orderQuery = `
          query searchOrders($query: String!) {
            orders(first: 10, query: $query) {
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
          { query: `name:*${query}* OR email:*${query}*` }
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
        }
      } catch (error) {
        console.error("Order search error:", error);
      }
    }

    // ✅ Search Collections using GraphQL
    if (type === "all" || type === "collections") {
      try {
        const collectionQuery = `
          query searchCollections($query: String!) {
            collections(first: 10, query: $query) {
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
          { query: `title:*${query}*` }
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
        }
      } catch (error) {
        console.error("Collection search error:", error);
      }
    }

    return json({ success: true, results }, { headers });
  } catch (error) {
    console.error("Search Error:", error);
    return json({ 
      success: false,
      error: error.message,
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