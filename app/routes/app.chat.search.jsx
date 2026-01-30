// app/routes/app.chat.search.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";

const headers = { 
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const query = url.searchParams.get("query");
    const type = url.searchParams.get("type") || "all";

    console.log("Search request:", { shop, query, type });

    if (!shop || !query) {
      return json({ 
        success: false, 
        error: "Missing required parameters" 
      }, { status: 400, headers });
    }

    // ✅ Get shop credentials from database
    const shopData = await prisma.session.findFirst({
      where: { shop }
    });

    if (!shopData?.accessToken) {
      console.error("Shop not found or not authenticated:", shop);
      return json({ 
        success: false, 
        error: "Shop not authenticated" 
      }, { status: 401, headers });
    }

    const accessToken = shopData.accessToken;
    const results = {
      products: [],
      collections: [],
      pages: [],
      orders: []
    };

    // ✅ Helper function for GraphQL requests
    const makeGraphQLRequest = async (query) => {
      const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`);
      }

      return await response.json();
    };

    // ✅ Search Products using GraphQL
    if (type === "all" || type === "products") {
      try {
        const productsQuery = `
          query searchProducts($query: String!) {
            products(first: 10, query: $query) {
              edges {
                node {
                  id
                  title
                  handle
                  descriptionHtml
                  featuredImage {
                    url
                  }
                  priceRangeV2 {
                    minVariantPrice {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        `;

        const productsData = await makeGraphQLRequest(productsQuery.replace('$query', `"title:*${query}*"`));
        
        if (productsData?.data?.products?.edges) {
          results.products = productsData.data.products.edges.map(({ node }) => ({
            type: 'product',
            id: node.id,
            title: node.title,
            description: node.descriptionHtml?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
            image: node.featuredImage?.url || null,
            price: node.priceRangeV2?.minVariantPrice?.amount || 'N/A',
            currency: node.priceRangeV2?.minVariantPrice?.currencyCode || 'INR',
            url: `https://${shop.replace('.myshopify.com', '')}/products/${node.handle}`
          }));
        }
      } catch (error) {
        console.error("Products search error:", error);
      }
    }

    // ✅ Search Collections using GraphQL
    if (type === "all" || type === "collections") {
      try {
        const collectionsQuery = `
          query searchCollections($query: String!) {
            collections(first: 10, query: $query) {
              edges {
                node {
                  id
                  title
                  handle
                  descriptionHtml
                  image {
                    url
                  }
                  productsCount
                }
              }
            }
          }
        `;

        const collectionsData = await makeGraphQLRequest(collectionsQuery.replace('$query', `"title:*${query}*"`));
        
        if (collectionsData?.data?.collections?.edges) {
          results.collections = collectionsData.data.collections.edges.map(({ node }) => ({
            type: 'collection',
            id: node.id,
            title: node.title,
            description: node.descriptionHtml?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
            image: node.image?.url || null,
            productCount: node.productsCount || 0,
            url: `https://${shop.replace('.myshopify.com', '')}/collections/${node.handle}`
          }));
        }
      } catch (error) {
        console.error("Collections search error:", error);
      }
    }

    // ✅ Search Pages using GraphQL
    if (type === "all" || type === "pages") {
      try {
        const pagesQuery = `
          query searchPages($query: String!) {
            pages(first: 10, query: $query) {
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

        const pagesData = await makeGraphQLRequest(pagesQuery.replace('$query', `"title:*${query}*"`));
        
        if (pagesData?.data?.pages?.edges) {
          results.pages = pagesData.data.pages.edges.map(({ node }) => ({
            type: 'page',
            id: node.id,
            title: node.title,
            description: node.bodySummary?.substring(0, 150) || '',
            url: `https://${shop.replace('.myshopify.com', '')}/pages/${node.handle}`
          }));
        }
      } catch (error) {
        console.error("Pages search error:", error);
      }
    }

    // ✅ Search Orders using GraphQL
    if (type === "orders") {
      try {
        const ordersQuery = `
          query searchOrders($query: String!) {
            orders(first: 10, query: $query) {
              edges {
                node {
                  id
                  name
                  email
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  createdAt
                  displayFinancialStatus
                  displayFulfillmentStatus
                  lineItems(first: 10) {
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

        const ordersData = await makeGraphQLRequest(ordersQuery.replace('$query', `"name:*${query}* OR email:*${query}*"`));
        
        if (ordersData?.data?.orders?.edges) {
          results.orders = ordersData.data.orders.edges.map(({ node }) => ({
            type: 'order',
            id: node.id,
            orderNumber: node.name,
            email: node.email,
            total: node.totalPriceSet?.shopMoney?.amount || '0',
            currency: node.totalPriceSet?.shopMoney?.currencyCode || 'INR',
            date: node.createdAt,
            status: node.displayFinancialStatus || 'PENDING',
            fulfillment: node.displayFulfillmentStatus || null,
            items: node.lineItems?.edges?.map(({ node: item }) => ({
              title: item.title,
              quantity: item.quantity,
              image: item.image?.url || null
            })) || []
          }));
        }
      } catch (error) {
        console.error("Orders search error:", error);
      }
    }

    console.log("Search results count:", {
      products: results.products.length,
      collections: results.collections.length,
      pages: results.pages.length,
      orders: results.orders.length
    });

    return json({ success: true, results }, { headers });

  } catch (error) {
    console.error("Search Error:", error);
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 500, headers });
  }
};