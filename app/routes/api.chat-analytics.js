// api/chat-analytics.js (or route handler for Next.js App Router)
// Place this in your API routes directory

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { dateRange, shop } = req.body;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch(dateRange) {
      case 'Last 3 days':
        startDate.setDate(now.getDate() - 3);
        break;
      case 'Last 7 days':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'Last 30 days':
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setDate(now.getDate() - 3);
    }

    // Get total conversations in date range
    const totalConversations = await prisma.chatSession.count({
      where: {
        ...(shop && { shop }), // Filter by shop if provided
        createdAt: {
          gte: startDate,
          lte: now
        }
      }
    });

    // Get all sessions with their messages
    const sessions = await prisma.chatSession.findMany({
      where: {
        ...(shop && { shop }),
        createdAt: {
          gte: startDate,
          lte: now
        }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    // Calculate resolution rate (sessions with at least one admin response)
    const resolvedSessions = sessions.filter(session => 
      session.messages.some(msg => msg.sender === 'admin')
    ).length;
    
    const resolutionRate = totalConversations > 0 
      ? Math.round((resolvedSessions / totalConversations) * 100) 
      : 0;

    // Calculate chat-to-sales rate
    // You'll need to integrate with Shopify Orders API or have an orders table
    // For now, this is a placeholder calculation
    const chatToSalesRate = await calculateChatToSalesRate(sessions, shop, startDate, now);

    // Calculate assisted revenue
    // This requires integration with Shopify Orders API
    const assistedRevenue = await calculateAssistedRevenue(sessions, shop, startDate, now);

    // Calculate total sales share contributed by chat
    const totalSalesShare = await calculateTotalSalesShare(shop, startDate, now);

    res.status(200).json({
      totalConversations,
      resolutionRate,
      assistedRevenue,
      chatToSalesRate,
      totalSalesShare,
      dateRange,
      startDate,
      endDate: now
    });

  } catch (error) {
    console.error('Error calculating analytics:', error);
    res.status(500).json({ 
      message: 'Error calculating analytics',
      error: error.message 
    });
  }
}

// Helper function to calculate chat-to-sales conversion
async function calculateChatToSalesRate(sessions, shop, startDate, endDate) {
  // This is a placeholder. You'll need to:
  // 1. Check if customers who chatted made purchases
  // 2. Use Shopify API to fetch orders
  
  try {
    // Get unique customer emails from chat sessions
    const customerEmails = sessions
      .filter(s => s.email)
      .map(s => s.email);

    if (customerEmails.length === 0) return 0;

    // Here you would integrate with Shopify Orders API
    // Example pseudo-code:
    // const orders = await shopify.order.list({
    //   created_at_min: startDate,
    //   created_at_max: endDate,
    //   email: customerEmails
    // });
    
    // For now, return 0 as placeholder
    return 0;
    
  } catch (error) {
    console.error('Error calculating chat-to-sales rate:', error);
    return 0;
  }
}

// Helper function to calculate assisted revenue
async function calculateAssistedRevenue(sessions, shop, startDate, endDate) {
  // This is a placeholder. You'll need to:
  // 1. Get orders from customers who chatted
  // 2. Sum the total revenue
  
  try {
    // Get unique customer emails
    const customerEmails = sessions
      .filter(s => s.email)
      .map(s => s.email);

    if (customerEmails.length === 0) return 0;

    // Here you would integrate with Shopify Orders API
    // Example pseudo-code:
    // const orders = await shopify.order.list({
    //   created_at_min: startDate,
    //   created_at_max: endDate,
    //   email: customerEmails
    // });
    // 
    // const totalRevenue = orders.reduce((sum, order) => 
    //   sum + parseFloat(order.total_price), 0
    // );
    
    return 0; // Placeholder
    
  } catch (error) {
    console.error('Error calculating assisted revenue:', error);
    return 0;
  }
}

// Helper function to calculate total sales share
async function calculateTotalSalesShare(shop, startDate, endDate) {
  // This is a placeholder. You'll need to:
  // 1. Get total shop revenue for the period
  // 2. Get revenue from customers who chatted
  // 3. Calculate percentage
  
  try {
    // Here you would integrate with Shopify Orders API
    // Example pseudo-code:
    // const allOrders = await shopify.order.list({
    //   created_at_min: startDate,
    //   created_at_max: endDate
    // });
    //
    // const totalRevenue = allOrders.reduce((sum, order) => 
    //   sum + parseFloat(order.total_price), 0
    // );
    //
    // const assistedRevenue = calculateAssistedRevenue(...);
    // const share = (assistedRevenue / totalRevenue) * 100;
    
    return 0; // Placeholder
    
  } catch (error) {
    console.error('Error calculating total sales share:', error);
    return 0;
  }
}