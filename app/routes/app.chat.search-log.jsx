// app/routes/app.chat.search-log.jsx

import { json } from "@remix-run/node";
import prisma from "../db.server";

const headers = { 
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Export loader to handle OPTIONS preflight via GET
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  
  // Return CORS headers for GET requests too
  return json({ 
    message: "Use POST to log searches" 
  }, { status: 200, headers });
};

// Handle POST requests
export const action = async ({ request }) => {
  // Handle OPTIONS in action as well
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