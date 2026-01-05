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
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" cy="9" x2="9.01" cy="9"></line><line x1="15" cy="9" x2="15.01" cy="9"></line></svg>,
  X: ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const sessions = await prisma.chatSession.findMany({
    where: { shop: session.shop },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" }
  });
  return json({ sessions, currentShop: session.shop });
};

export default function NeuralChatAdmin() {
  const { sessions: initialSessions, currentShop } = useLoaderData();
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [filePreview, setFilePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [liveLocation, setLiveLocation] = useState({ city: "Detecting...", country: "", flag: "" });
  const [unreadSessions, setUnreadSessions] = useState(new Set());

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastMsgCountRef = useRef(0);

  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀", "👋", "🙏", "🎉", "🤣", "💯"];

  // 1. Fetch Location for Intelligence Hub
  useEffect(() => {
    if (activeSession) {
      fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => setLiveLocation({
          city: data.city || "Unknown",
          country: data.country_name || "Private",
          flag: data.country_code ? `https://flagcdn.com/w40/${data.country_code.toLowerCase()}.png` : ""
        }))
        .catch(() => setLiveLocation({ city: "Not Available", country: "Secured", flag: "" }));
    }
  }, [activeSession]);

  // 2. Real-time Polling for New Messages & Notifications
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Fetch all sessions to see if there's a new message in any of them
        const res = await fetch(`/app/chat/sessions`); // Ensure this endpoint exists
        const latestSessions = await res.json();
        
        const newUnreads = new Set();
        latestSessions.forEach(s => {
          const lastMsg = s.messages[0];
          if (lastMsg?.sender === "user" && activeSession?.sessionId !== s.sessionId) {
            newUnreads.add(s.sessionId);
          }
        });
        setUnreadSessions(newUnreads);
        setSessions(latestSessions);

        // Update current chat if active
        if (activeSession) {
          const activeRes = await fetch(`/app/chat/messages?sessionId=${activeSession.sessionId}`);
          const activeData = await activeRes.json();
          if (activeData.length > lastMsgCountRef.current) {
            setMessages(activeData);
            lastMsgCountRef.current = activeData.length;
          }
        }
      } catch (e) {}
    }, 4000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // 3. Handle Auto Scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const loadChat = async (session) => {
    setActiveSession(session);
    setUnreadSessions(prev => {
      const next = new Set(prev);
      next.delete(session.sessionId);
      return next;
    });
    const res = await fetch(`/app/chat/messages?sessionId=${session.sessionId}`);
    const data = await res.json();
    setMessages(data);
    lastMsgCountRef.current = data.length;
  };

  const handleReply = () => {
    if (!reply.trim() && !filePreview) return;
    const payload = {
      message: reply || "Sent an attachment",
      sender: "admin",
      sessionId: activeSession.sessionId,
      fileUrl: filePreview?.url || null,
      shop: currentShop,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, payload]);
    setReply("");
    setFilePreview(null);
    setShowEmojiPicker(false);

    fetcher.submit(JSON.stringify(payload), { 
      method: "post", 
      action: "/app/chat/message", 
      encType: "application/json" 
    });
  };

  return (
    <div style={{ display: 'flex', height: '92vh', margin: '20px', background: '#fff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontFamily: 'Plus Jakarta Sans, sans-serif', border: '1px solid #eee' }}>
      
      {/* SECTION 1: SIDEBAR (Inboxes) */}
      <div style={{ width: '380px', borderRight: '1px solid #f0f0f0', background: '#fcfaf8', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '30px 24px' }}><h2 style={{ margin: 0, fontWeight: 900, fontSize: '24px' }}>Messages</h2></div>
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '12px', display: 'flex', border: '1px solid #e5e7eb', alignItems: 'center' }}>
            <Icons.Search />
            <input placeholder="Search chats..." style={{ border: 'none', outline: 'none', marginLeft: '12px', width: '100%', fontSize: '14px' }} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
          {sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
            <div key={s.sessionId} onClick={() => loadChat(s)} style={{ padding: '16px', borderRadius: '16px', cursor: 'pointer', marginBottom: '8px', background: activeSession?.sessionId === s.sessionId ? '#fff' : 'transparent', border: activeSession?.sessionId === s.sessionId ? '1px solid #eee' : '1px solid transparent', display: 'flex', gap: '14px', position: 'relative', transition: '0.2s' }}>
              <div style={{ width: '48px', height: '48px', background: activeSession?.sessionId === s.sessionId ? '#8b5e3c' : '#f3f4f6', color: activeSession?.sessionId === s.sessionId ? '#fff' : '#999', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.User size={24} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#1a1615' }}>{s.email?.split('@')[0]}</div>
                <div style={{ fontSize: '13px', color: unreadSessions.has(s.sessionId) ? '#ef4444' : '#78716c', fontWeight: unreadSessions.has(s.sessionId) ? '800' : '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {unreadSessions.has(s.sessionId) ? "🔴 New message received" : (s.messages[0]?.message || "No messages")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: CHAT INTERFACE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: '#fff' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '20px 40px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '18px' }}>{activeSession.email}</h3>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '40px', background: '#faf9f8', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.sender === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  <div style={{ padding: '14px 20px', borderRadius: '20px', background: m.sender === 'admin' ? '#8b5e3c' : '#fff', color: m.sender === 'admin' ? '#fff' : '#433d3c', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: m.sender === 'admin' ? 'none' : '1px solid #eee' }}>
                    {m.fileUrl && <img src={m.fileUrl} style={{ maxWidth: '250px', borderRadius: '12px', display: 'block', marginBottom: '8px' }} />}
                    <div style={{ fontSize: '15px', lineHeight: '1.5' }}>{m.message}</div>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>

            {/* MESSAGE COMPOSER */}
            <div style={{ padding: '25px 40px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
              {filePreview && (
                <div style={{ padding: '12px', background: '#f8f8f8', borderRadius: '14px', marginBottom: '15px', display: 'inline-flex', alignItems: 'center', gap: '12px', border: '1px solid #eee' }}>
                  <img src={filePreview.url} width="45" height="45" style={{ objectFit: 'cover', borderRadius: '8px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{filePreview.name}</div>
                  <button onClick={() => setFilePreview(null)} style={{ border: 'none', background: '#ef4444', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.X size={12} /></button>
                </div>
              )}
              
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: '18px', padding: '8px 16px' }}>
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}><Icons.Smile /></button>
                
                {showEmojiPicker && (
                  <div style={{ position: 'absolute', bottom: '70px', left: '0', background: '#fff', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', borderRadius: '16px', padding: '15px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', zIndex: 100, border: '1px solid #eee' }}>
                    {emojis.map(e => <button key={e} onClick={() => { setReply(r => r + e); setShowEmojiPicker(false); }} style={{ border: 'none', background: 'none', fontSize: '22px', cursor: 'pointer', padding: '5px' }}>{e}</button>)}
                  </div>
                )}

                <button onClick={() => fileInputRef.current.click()} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', margin: '0 12px' }}><Icons.Paperclip /></button>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files[0];
                  const reader = new FileReader();
                  reader.onload = () => setFilePreview({ url: reader.result, name: file.name });
                  reader.readAsDataURL(file);
                }} />

                <input value={reply} onChange={e => setReply(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleReply()} placeholder="Write your reply..." style={{ flex: 1, border: 'none', background: 'none', outline: 'none', padding: '12px', fontSize: '15px' }} />
                <button onClick={handleReply} style={{ background: '#8b5e3c', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Send /></button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#a8a29e' }}>
            <Icons.User size={80} />
            <p style={{ marginTop: '20px', fontWeight: 600 }}>Select a conversation to begin</p>
          </div>
        )}
      </div>

      {/* SECTION 3: INTELLIGENCE HUB */}
      <div style={{ width: '320px', borderLeft: '1px solid #f0f0f0', padding: '32px 24px', background: '#fff' }}>
        <h4 style={{ textTransform: 'uppercase', fontSize: '11px', color: '#a8a29e', letterSpacing: '1.5px', fontWeight: 800 }}>Intelligence Hub</h4>
        {activeSession && (
          <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#f0f9ff', padding: '24px', borderRadius: '24px', border: '1px solid #e0f2fe' }}>
              <div style={{ fontSize: '10px', fontWeight: 900, color: '#0369a1', marginBottom: '15px' }}>LIVE LOCATION</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {liveLocation.flag && <img src={liveLocation.flag} width="32" style={{ borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: '#1a1615' }}>{liveLocation.city}</div>
                  <div style={{ fontSize: '12px', color: '#78716c' }}>{liveLocation.country}</div>
                </div>
              </div>
            </div>

            <div style={{ background: '#fdf4ff', padding: '20px', borderRadius: '24px', border: '1px solid #fae8ff' }}>
              <div style={{ fontSize: '10px', fontWeight: 900, color: '#a21caf', marginBottom: '10px' }}>CUSTOMER LOCAL TIME</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#1a1615' }}>
                <Icons.Clock /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}