import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

// --- ICONS ---
const Icons = {
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  User: ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  const sessions = await prisma.chatSession.findMany({
    where: { shop: shop },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" }
  });
  return json({ sessions, currentShop: shop });
};

export default function NeuralChatAdmin() {
  const { sessions, currentShop } = useLoaderData();
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [accentColor] = useState("#8b5e3c"); 
  const [searchTerm, setSearchTerm] = useState("");
  const [notifStatus, setNotifStatus] = useState("default");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const audioRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  // 1. Initial Setup
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    if ("Notification" in window) {
      setNotifStatus(Notification.permission);
    }
  }, []);

  // 2. Notification Permission Handler
  const requestNotifPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(permission => {
        setNotifStatus(permission);
        if (permission === "granted") {
          new Notification("Notifications Enabled!", { body: "You will now receive alerts for new customer messages." });
        }
      });
    }
  };

  // 3. Polling for New Messages + Sound + Popup
  useEffect(() => {
    if (!activeSession) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/app/chat/messages?sessionId=${activeSession.sessionId}`);
        const data = await res.json();
        
        if (data.length > 0) {
          const latestMsg = data[data.length - 1];
          
          if (latestMsg.id !== lastMessageIdRef.current) {
            // Trigger Alert if New Message is from User
            if (latestMsg.sender === "user" && lastMessageIdRef.current !== null) {
              
              // Audio Alert
              audioRef.current?.play().catch(() => console.log("Click page to enable sound"));
              
              // Browser Popup
              if (Notification.permission === "granted") {
                new Notification(`Talksy: ${activeSession.email}`, {
                  body: latestMsg.message,
                  icon: "https://talksy-production-322d.up.railway.app/favicon.ico" 
                });
              }
            }
            lastMessageIdRef.current = latestMsg.id;
            setMessages(data);
          }
        }
      } catch (err) { console.error("Poll error:", err); }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const loadChat = async (session) => {
    setActiveSession(session);
    const res = await fetch(`/app/chat/messages?sessionId=${session.sessionId}`);
    const data = await res.json();
    if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
    setMessages(data);
  };

  const handleReply = () => {
    if (!reply.trim() || !activeSession) return;
    const newMessage = { message: reply, sender: "admin", createdAt: new Date().toISOString(), sessionId: activeSession.sessionId, shop: currentShop };
    setMessages(prev => [...prev, newMessage]);
    lastMessageIdRef.current = "temp-admin-id";
    setReply("");
    fetcher.submit(JSON.stringify(newMessage), { method: "post", action: "/app/chat/message", encType: "application/json" });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 40px)', width: 'calc(100vw - 40px)', backgroundColor: '#fff', margin: '20px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', border: '1px solid #eee' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: '380px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fcfaf8' }}>
        <div style={{ padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900' }}>Inbox</h2>
          {notifStatus !== "granted" && (
            <button onClick={requestNotifPermission} style={{ padding: '8px', borderRadius: '12px', border: '1px solid #ffd700', background: '#fff9db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 'bold' }}>
              <Icons.Bell /> Enable Alerts
            </button>
          )}
        </div>
        
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '16px', color: '#a8a29e' }}><Icons.Search /></span>
            <input placeholder="Search customer..." style={{ width: '100%', padding: '12px 45px', borderRadius: '14px', border: '1px solid #e5e7eb', outline: 'none' }} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase())).map(session => (
            <div key={session.sessionId} onClick={() => loadChat(session)} style={{ padding: '16px', borderRadius: '20px', cursor: 'pointer', marginBottom: '8px', background: activeSession?.sessionId === session.sessionId ? '#fff' : 'transparent', border: activeSession?.sessionId === session.sessionId ? '1px solid #f0f0f0' : '1px solid transparent' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '15px', background: activeSession?.sessionId === session.sessionId ? accentColor : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeSession?.sessionId === session.sessionId ? 'white' : '#9d9489' }}>
                  <Icons.User size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>{session.email}</div>
                  <div style={{ fontSize: '12px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.messages[0]?.message}</div>
                </div>
                {session.messages[0]?.sender === "user" && activeSession?.sessionId !== session.sessionId && (
                    <div style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '24px 40px', borderBottom: '1px solid #f0f0f0' }}>
                <h3 style={{ margin: 0, fontWeight: '800' }}>{activeSession.email}</h3>
            </div>

            <div ref={scrollRef} style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', background: '#faf9f8' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.sender === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  <div style={{ padding: '14px 18px', borderRadius: '20px', background: msg.sender === 'admin' ? accentColor : '#fff', color: msg.sender === 'admin' ? '#fff' : '#433d3c', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: msg.sender === 'admin' ? 'none' : '1px solid #f0f0f0', fontSize: '15px' }}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '20px 40px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8f7f6', borderRadius: '18px', padding: '8px 12px' }}>
                <input placeholder="Type your reply..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', padding: '10px' }} value={reply} onChange={(e) => setReply(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleReply()} />
                <button onClick={handleReply} style={{ background: accentColor, border: 'none', color: 'white', borderRadius: '14px', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Send /></button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>Select a chat to begin</div>
        )}
      </div>
    </div>
  );
}