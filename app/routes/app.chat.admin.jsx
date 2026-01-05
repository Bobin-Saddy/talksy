import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

// --- ICONS SET ---
const Icons = {
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  User: ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>,
  X: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  FileText: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const sessions = await prisma.chatSession.findMany({
    where: { shop },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" } 
  });
  
  return json({ sessions, currentShop: shop });
};

export default function NeuralChatAdmin() {
  const { sessions, currentShop } = useLoaderData();
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState(null); 
  const [liveLocation, setLiveLocation] = useState({ city: "Detecting...", flag: "" });

  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const scrollRef = useRef(null);
  const audioRef = useRef(null);
  const lastGlobalMsgId = useRef(null);
  const fileInputRef = useRef(null);

  const accentColor = "#8b5e3c";

  // --- 1. INITIALIZATION (Sound & Permissions) ---
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    audioRef.current.load();
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // --- 2. GLOBAL WATCHER (Sound & Notifications outside the app) ---
  useEffect(() => {
    const latestMsg = sessions[0]?.messages[0];

    // Trigger alert if there's a new message that isn't from the admin
    if (latestMsg && latestMsg.id !== lastGlobalMsgId.current) {
      if (latestMsg.sender === "user" && lastGlobalMsgId.current !== null) {
        
        // Play notification sound
        audioRef.current?.play().catch(() => console.log("Audio requires user interaction first"));
        
        // System Notification
        if (Notification.permission === "granted") {
          new Notification(`New Message from ${sessions[0].email}`, {
            body: latestMsg.message,
            icon: "/favicon.ico",
            tag: "admin-chat-alert",
            renotify: true 
          });
        }
      }
      lastGlobalMsgId.current = latestMsg.id;
    }

    // This background interval polls the loader every 4s to check for new chats/messages
    const globalPoll = setInterval(() => {
      revalidator.revalidate();
    }, 4000);

    return () => clearInterval(globalPoll);
  }, [sessions, revalidator]);

  // --- 3. ACTIVE CHAT SYNC (Refresh messages for open chat) ---
  useEffect(() => {
    if (!activeSession) return;
    
    const syncActiveChat = async () => {
      try {
        const res = await fetch(`/app/chat/messages?sessionId=${activeSession.sessionId}`);
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        console.error("Sync Error:", err);
      }
    };

    const interval = setInterval(syncActiveChat, 3000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // --- 4. UI HELPERS ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadChat = async (session) => {
    setActiveSession(session);
    const res = await fetch(`/app/chat/messages?sessionId=${session.sessionId}`);
    const data = await res.json();
    setMessages(data);
    
    // Fetch Location Info
    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      const ipData = await ipRes.json();
      setLiveLocation({
        city: ipData.city || "Unknown",
        flag: ipData.country_code ? `https://flagcdn.com/w40/${ipData.country_code.toLowerCase()}.png` : ""
      });
    } catch (e) {}
  };

  const handleReply = (text = null, fileUrl = null) => {
    const finalMsg = text || reply;
    if ((!finalMsg.trim() && !fileUrl) || !activeSession) return;

    const payload = {
      sessionId: activeSession.sessionId,
      message: finalMsg,
      sender: "admin",
      shop: currentShop,
      email: activeSession.email,
      fileUrl: fileUrl || null
    };

    // Optimistic Update
    setMessages(prev => [...prev, { ...payload, id: Date.now(), createdAt: new Date().toISOString() }]);
    setReply("");

    fetcher.submit(JSON.stringify(payload), {
      method: "post",
      action: "/app/chat/message", // Ensure this matches your route
      encType: "application/json"
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => handleReply(`Sent an attachment: ${file.name}`, reader.result);
    reader.readAsDataURL(file);
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sessions, searchTerm]);

  return (
    <div style={{ display: 'flex', height: '92vh', width: '96vw', background: '#fff', margin: '20px auto', borderRadius: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #eee', color: '#433d3c', fontFamily: 'sans-serif' }}>
      
      {/* 1. SIDEBAR: Inbox */}
      <div style={{ width: '380px', borderRight: '1px solid #f0f0f0', background: '#fcfaf8', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>Messages</h2>
          <div style={{ position: 'relative', marginTop: '20px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '12px', color: '#a8a29e' }}><Icons.Search /></span>
            <input 
              placeholder="Search conversations..." 
              style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: '1px solid #e5e7eb', outline: 'none' }}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 15px' }}>
          {filteredSessions.map(session => (
            <div key={session.sessionId} onClick={() => loadChat(session)} style={{ position: 'relative', padding: '15px', borderRadius: '16px', cursor: 'pointer', marginBottom: '8px', background: activeSession?.sessionId === session.sessionId ? '#fff' : 'transparent', border: activeSession?.sessionId === session.sessionId ? '1px solid #eee' : '1px solid transparent', boxShadow: activeSession?.sessionId === session.sessionId ? '0 4px 12px rgba(0,0,0,0.05)' : 'none' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: activeSession?.sessionId === session.sessionId ? accentColor : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeSession?.sessionId === session.sessionId ? 'white' : '#9d9489' }}>
                  <Icons.User size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{session.email?.split('@')[0]}</div>
                  <div style={{ fontSize: '12px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.messages[0]?.message || "New Chat"}</div>
                </div>
                {session.messages[0]?.sender === "user" && activeSession?.sessionId !== session.sessionId && (
                  <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 10px #ef4444' }}></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. MAIN CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '20px 40px', borderBottom: '1px solid #f0f0f0' }}>
              <h3 style={{ margin: 0, fontWeight: '800' }}>{activeSession.email}</h3>
            </div>

            <div ref={scrollRef} style={{ flex: 1, padding: '40px', overflowY: 'auto', background: '#faf9f8', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {messages.map((msg, i) => {
                const isAdmin = msg.sender === 'admin';
                return (
                  <div key={i} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                    <div style={{ 
                      padding: '12px 18px', 
                      borderRadius: isAdmin ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isAdmin ? accentColor : '#fff', 
                      color: isAdmin ? '#fff' : '#433d3c',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      border: isAdmin ? 'none' : '1px solid #eee'
                    }}>
                      {msg.fileUrl && msg.fileUrl.startsWith('data:image') ? (
                        <img src={msg.fileUrl} style={{ maxWidth: '100%', borderRadius: '8px' }} alt="attachment" />
                      ) : (
                        <div style={{ fontSize: '14.5px', lineHeight: '1.5' }}>{msg.message}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '25px 40px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8f7f6', borderRadius: '16px', padding: '8px 12px', border: '1px solid #eee' }}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: '8px' }}><Icons.Paperclip /></button>
                <input 
                  placeholder="Type your reply..." 
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '15px', padding: '0 10px' }} 
                  value={reply} 
                  onChange={(e) => setReply(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && handleReply()}
                />
                <button onClick={() => handleReply()} disabled={!reply.trim()} style={{ width: '42px', height: '42px', borderRadius: '12px', background: reply.trim() ? accentColor : '#e5e7eb', border: 'none', color: 'white', cursor: 'pointer' }}><Icons.Send /></button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
            <Icons.User size={80} />
            <p style={{ marginTop: '15px' }}>Select a customer to start chatting</p>
          </div>
        )}
      </div>

      {/* 3. INTELLIGENCE PANEL */}
      <div style={{ width: '320px', padding: '30px 20px', background: '#fff', borderLeft: '1px solid #f0f0f0' }}>
        <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '1px' }}>Intelligence Hub</h4>
        {activeSession ? (
          <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '20px', background: '#f0f9ff', borderRadius: '20px' }}>
              <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: '800', marginBottom: '8px' }}>VISITOR LOCATION</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {liveLocation.flag && <img src={liveLocation.flag} width="24" style={{ borderRadius: '2px' }} />}
                <span style={{ fontWeight: '700', fontSize: '14px' }}>{liveLocation.city}</span>
              </div>
            </div>
            <div style={{ padding: '20px', background: '#f8f7f6', borderRadius: '20px' }}>
              <div style={{ fontSize: '10px', color: '#a8a29e', fontWeight: '800', marginBottom: '8px' }}>LOCAL TIME</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                <Icons.Clock /> {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        ) : <div style={{ textAlign: 'center', marginTop: '50px', color: '#eee' }}>No data available</div>}
      </div>
    </div>
  );
}