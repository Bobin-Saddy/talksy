// api/chat-analytics-shopify.js
// Complete version with Shopify integration

import { PrismaClient } from '@prisma/client';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';

const prisma = new PrismaClient();

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_orders', 'read_customers'],
  hostName: process.env.SHOPIFY_APP_URL,
  apiVersion: ApiVersion.October23,
  isEmbeddedApp: true,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { dateRange = 'Last 3 days', shop, session } = req.body;
    
    if (!shop) {
      return res.status(400).json({ message: 'Shop parameter is required' });
    }

    // Calculate date range
    const { startDate, endDate } = getDateRange(dateRange);

    // 1. Get total conversations
    const totalConversations = await prisma.chatSession.count({
      where: {
        shop,
        createdAt: { gte: startDate, lte: endDate }
      }
    });

    // 2. Get all sessions with messages
    const sessions = await prisma.chatSession.findMany({
      where: {
        shop,
        createdAt: { gte: startDate, lte: endDate }
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // 3. Calculate resolution rate
    const resolvedSessions = sessions.filter(session => 
      session.messages.some(msg => msg.sender === 'admin')
    ).length;
    const resolutionRate = totalConversations > 0 
      ? Math.round((resolvedSessions / totalConversations) * 100) 
      : 0;

    // 4. Get customer emails from chat sessions
    const customerEmails = [...new Set(
      sessions
        .filter(s => s.email)
        .map(s => s.email.toLowerCase())
    )];

    // 5. Fetch orders from Shopify
    let assistedRevenue = 0;
    let ordersFromChatCustomers = 0;
    let totalOrders = 0;
    let totalRevenue = 0;

    if (session) {
      try {
        const client = new shopify.clients.Rest({ session });
        
        // Get all orders in the date range
        const ordersResponse = await client.get({
          path: 'orders',
          query: {
            created_at_min: startDate.toISOString(),
            created_at_max: endDate.toISOString(),
            status: 'any',
            limit: 250
          }
        });

        const orders = ordersResponse.body.orders || [];
        totalOrders = orders.length;

        // Calculate total revenue
        totalRevenue = orders.reduce((sum, order) => 
          sum + parseFloat(order.total_price || 0), 0
        );

        // Calculate assisted revenue (from customers who chatted)
        const assistedOrders = orders.filter(order => 
          order.email && customerEmails.includes(order.email.toLowerCase())
        );

        ordersFromChatCustomers = assistedOrders.length;
        assistedRevenue = assistedOrders.reduce((sum, order) => 
          sum + parseFloat(order.total_price || 0), 0
        );

      } catch (shopifyError) {
        console.error('Shopify API error:', shopifyError);
        // Continue with zero values if Shopify API fails
      }
    }

    // 6. Calculate metrics
    const chatToSalesRate = customerEmails.length > 0
      ? Math.round((ordersFromChatCustomers / customerEmails.length) * 100)
      : 0;

    const totalSalesShare = totalRevenue > 0
      ? Math.round((assistedRevenue / totalRevenue) * 100)
      : 0;

    // 7. Return analytics
    res.status(200).json({
      totalConversations,
      resolutionRate,
      assistedRevenue: Math.round(assistedRevenue),
      chatToSalesRate,
      totalSalesShare,
      dateRange,
      startDate,
      endDate,
      metadata: {
        totalOrders,
        ordersFromChatCustomers,
        totalRevenue: Math.round(totalRevenue),
        uniqueChatCustomers: customerEmails.length
      }
    });

  } catch (error) {
    console.error('Error calculating analytics:', error);
    res.status(500).json({ 
      message: 'Error calculating analytics',
      error: error.message 
    });
  }
}

// Helper function to get date range
function getDateRange(rangeString) {
  const endDate = new Date();
  const startDate = new Date();
  
  switch(rangeString) {
    case 'Last 3 days':
      startDate.setDate(endDate.getDate() - 3);
      break;
    case 'Last 7 days':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'Last 30 days':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case 'This month':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'Last month':
      startDate.setMonth(endDate.getMonth() - 1);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(0); // Last day of previous month
      break;
    default:
      startDate.setDate(endDate.getDate() - 3);
  }
  
  return { startDate, endDate };
}

// Alternative: If using Next.js App Router (app directory)
// export async function POST(request) {
//   const body = await request.json();
//   // ... same logic as above
//   return Response.json(data);
// }