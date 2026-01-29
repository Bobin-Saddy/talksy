import { json } from "@remix-run/node";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/* ---------------- LOADER ---------------- */
export async function loader({ request }) {
  // 🔐 Ensure Shopify login
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // 📊 Fetch analytics data
  const totalChats = await prisma.chatSession.count({
    where: { shop },
  });

  const totalMessages = await prisma.chatMessage.count({
    where: {
      session: {
        shop,
      },
    },
  });

  const userMessages = await prisma.chatMessage.count({
    where: {
      sender: "user",
      session: {
        shop,
      },
    },
  });

  const adminMessages = await prisma.chatMessage.count({
    where: {
      sender: "admin",
      session: {
        shop,
      },
    },
  });

  const recentChats = await prisma.chatSession.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      messages: true,
    },
  });

  return json({
    totalChats,
    totalMessages,
    userMessages,
    adminMessages,
    recentChats,
  });
}

/* ---------------- PAGE ---------------- */
export default function ChatAnalytics() {
  const {
    totalChats,
    totalMessages,
    userMessages,
    adminMessages,
    recentChats,
  } = useLoaderData();

  return (
    <div style={{ padding: "24px", fontFamily: "system-ui" }}>

      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "600" }}>
          Chat Analytics
        </h1>
        <p style={{ color: "#666" }}>
          Overview of customer conversations
        </p>
      </div>

      {/* Stats Boxes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>

        <StatBox title="Total Chats" value={totalChats} />
        <StatBox title="Total Messages" value={totalMessages} />
        <StatBox title="User Messages" value={userMessages} />
        <StatBox title="Admin Messages" value={adminMessages} />

      </div>

      {/* Recent Chats */}
      <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: "8px", padding: "16px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>
          Recent Conversations
        </h2>

        {recentChats.length === 0 ? (
          <p>No chats yet.</p>
        ) : (
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                <th>Session ID</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Total Messages</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {recentChats.map((chat) => (
                <tr key={chat.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{chat.sessionId}</td>
                  <td>{chat.firstName || "-"} {chat.lastName || ""}</td>
                  <td>{chat.email || "-"}</td>
                  <td>{chat.messages.length}</td>
                  <td>{new Date(chat.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

/* ---------------- SMALL COMPONENT ---------------- */
function StatBox({ title, value }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e5e5",
      borderRadius: "8px",
      padding: "16px"
    }}>
      <div style={{ fontSize: "13px", color: "#666" }}>{title}</div>
      <div style={{ fontSize: "28px", fontWeight: "600", marginTop: "4px" }}>
        {value}
      </div>
    </div>
  );
}
