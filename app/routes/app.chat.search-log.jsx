// app/routes/app.chat.search-log.jsx

import { json } from "@remix-run/node";
import prisma from "../db.server";

const headers = { 
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle OPTIONS preflight
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const body = await request.json();
    const { 
      shop, 
      query, 
      searchType, 
      userEmail, 
      sessionId, 
      firstName, 
      lastName 
    } = body;
    
    console.log("📝 Logging search:", { shop, query, searchType, userEmail });
    
    if (!shop || !query || !searchType) {
      return json({ 
        success: false, 
        error: "Missing required fields (shop, query, searchType)" 
      }, { status: 400, headers });
    }

    // Create the search log entry
    const searchLog = await prisma.searchLog.create({
      data: {
        shop,
        query,
        searchType, // "frontend" for widget searches, "admin" for admin searches
        userEmail: userEmail || 'anonymous',
        sessionId: sessionId || null,
        firstName: firstName || null,
        lastName: lastName || null,
        createdAt: new Date()
      }
    });
    
    console.log("✅ Search log created:", searchLog.id);
    
    return json({ success: true, logId: searchLog.id }, { headers });
  } catch (error) {
    console.error("❌ Search log error:", error);
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 500, headers });
  }
};