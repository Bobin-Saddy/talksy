import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

// --- ICONS SET ---
const Icons = {
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  User: ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" cy="9" x2="9.01" cy="9"></line><line x1="15" cy="9" x2="15.01" cy="9"></line></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
  X: ({ size = 20, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  FileText: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
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
  const { sessions: initialSessions, currentShop } = useLoaderData();
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [accentColor] = useState("#8b5e3c"); 
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState(null); 
  const [filePreview, setFilePreview] = useState(null); 
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [liveLocation, setLiveLocation] = useState({ city: "Detecting...", country: "", flag: "" });
  const [unreadCounts, setUnreadCounts] = useState({});

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const isFirstLoadRef = useRef(true);

  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀", "👋", "🙏", "🎉"];

  // Initialize Audio and Notifications
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const fetchUserLocation = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      setLiveLocation({
        city: data.city || "Unknown",
        country: data.country_name || "Private",
        flag: data.country_code ? `https://flagcdn.com/w40/${data.country_code.toLowerCase()}.png` : ""
      });
    } catch (e) {
      setLiveLocation({ city: "Not Available", country: "Secured", flag: "" });
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sessions, searchTerm]);

  // Handle auto-scroll and trigger sound on NEW message
  useEffect(() => {
    if (messages.length > 0) {
      const latest = messages[messages.length - 1];
      // Only play sound if the message is from user AND it's not the initial load
      if (latest.sender === "user" && !isFirstLoadRef.current) {
        audioRef.current?.play().catch(() => console.log("Audio blocked by browser"));
      }
      
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages]);

  // Global Polling for Background Notifications & Sidebar Updates
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/app/chat/all-latest-messages`); // You'll need an endpoint that returns latest for all sessions
        const data = await res.json();
        
        // Update unread counts and session list based on new activity
        setSessions(prev => {
          let updated = [...prev];
          data.forEach(msg => {
            const sessionIdx = updated.findIndex(s => s.sessionId === msg.sessionId);
            if (sessionIdx > -1 && updated[sessionIdx].messages[0]?.id !== msg.id) {
              // New message found!
              if (activeSession?.sessionId !== msg.sessionId) {
                setUnreadCounts(u => ({ ...u, [msg.sessionId]: (u[msg.sessionId] || 0) + 1 }));
              }
              updated[sessionIdx].messages = [msg];
              // Play sound if browser allows
              if (msg.sender === "user") audioRef.current?.play().catch(() => {});
            }
          });
          return updated.sort((a, b) => new Date(b.messages[0]?.createdAt) - new Date(a.messages[0]?.createdAt));
        });

      } catch (err) {}
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [activeSession]);

  const loadChat = async (session) => {
    setActiveSession(session);
    setUnreadCounts(prev => ({ ...prev, [session.sessionId]: 0 }));
    isFirstLoadRef.current = true;
    fetchUserLocation();
    try {
      const res = await fetch(`/app/chat/messages?sessionId=${session.sessionId}`);
      const data = await res.json();
      if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
      setMessages(data);
      setTimeout(() => { isFirstLoadRef.current = false; }, 800);
    } catch (err) {}
  };

  const addEmoji = (emoji) => {
    setReply(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleReply = () => {
    if ((!reply.trim() && !filePreview) || !activeSession) return;

    const tempId = `temp-${Date.now()}`;
    const newMessage = {
      message: reply || "Attachment",
      sender: "admin",
      createdAt: new Date().toISOString(),
      sessionId: activeSession.sessionId,
      shop: currentShop,
      fileUrl: filePreview?.url || null,
      id: tempId
    };

    setMessages(prev => [...prev, newMessage]);
    setReply("");
    setFilePreview(null);

    fetcher.submit(JSON.stringify(newMessage), {
      method: "post",
      action: "/app/chat/message",
      encType: "application/json"
    });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 40px)', width: 'calc(100vw - 40px)', backgroundColor: '#fff', margin: '20px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', border: '1px solid #eee', color: '#433d3c', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      
      {/* Sidebar */}
      <div style={{ width: '380px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fcfaf8' }}>
        <div style={{ padding: '32px 24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#1a1615', margin: 0 }}>Messages</h2>
        </div>
        
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '16px', color: '#a8a29e' }}><Icons.Search /></span>
            <input 
              placeholder="Search inbox..." 
              style={{ width: '100%', padding: '14px 48px', borderRadius: '16px', border: '1px solid #e5e7eb', outline: 'none' }} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {filteredSessions.map(session => (
            <div 
              key={session.sessionId} 
              onClick={() => loadChat(session)} 
              style={{ 
                position: 'relative', padding: '16px', borderRadius: '20px', cursor: 'pointer', marginBottom: '8px', 
                background: activeSession?.sessionId === session.sessionId ? '#fff' : 'transparent',
                border: activeSession?.sessionId === session.sessionId ? '1px solid #f0f0f0' : '1px solid transparent',
                boxShadow: activeSession?.sessionId === session.sessionId ? '0 4px 12px rgba(0,0,0,0.03)' : 'none'
              }}
            >
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: activeSession?.sessionId === session.sessionId ? accentColor : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeSession?.sessionId === session.sessionId ? 'white' : '#9d9489', flexShrink: 0 }}>
                  <Icons.User size={24} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{session.email?.split('@')[0] || 'User'}</div>
                  <div style={{ fontSize: '13px', color: unreadCounts[session.sessionId] > 0 ? '#1a1615' : '#78716c', fontWeight: unreadCounts[session.sessionId] > 0 ? '700' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.messages[0]?.message || 'New Chat'}
                  </div>
                </div>
                {unreadCounts[session.sessionId] > 0 && (
                  <div style={{ background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: '900', padding: '4px 8px', borderRadius: '10px' }}>
                    NEW
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '24px 40px', borderBottom: '1px solid #f0f0f0' }}>
              <h3 style={{ margin: 0, fontWeight: '800', fontSize: '20px' }}>{activeSession.email}</h3>
            </div>

            <div ref={scrollRef} style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', background: '#faf9f8' }}>
              {messages.map((msg, i) => (
                <div key={msg.id || i} style={{ alignSelf: msg.sender === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                  <div style={{ padding: '14px 18px', borderRadius: '20px', background: msg.sender === 'admin' ? accentColor : '#fff', color: msg.sender === 'admin' ? '#fff' : '#433d3c', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: msg.sender === 'admin' ? 'none' : '1px solid #f0f0f0' }}>
                    {msg.message}
                  </div>
                  <div style={{ fontSize: '10px', color: '#a8a29e', marginTop: '5px', textAlign: msg.sender === 'admin' ? 'right' : 'left' }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Bar */}
            <div style={{ padding: '30px 40px', background: '#fff', borderTop: '1px solid #f0f0f0', position: 'relative' }}>
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '100%', left: '40px', marginBottom: '10px', background: 'white', padding: '12px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', zIndex: 100 }}>
                  {emojis.map(e => (
                    <button key={e} onClick={() => addEmoji(e)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', padding: '5px' }}>{e}</button>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8f7f6', borderRadius: '20px', padding: '8px 10px', border: '1px solid #eee' }}>
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e' }}><Icons.Smile /></button>
                <input 
                  placeholder="Write a message..." 
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '15px', padding: '0 15px' }} 
                  value={reply} 
                  onChange={(e) => setReply(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && handleReply()}
                />
                <button onClick={handleReply} style={{ width: '48px', height: '48px', borderRadius: '16px', background: reply.trim() ? accentColor : '#e5e7eb', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.Send />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#d1cfcd' }}>
            <Icons.User size={100} />
            <p style={{ fontWeight: '600', marginTop: '20px' }}>Select a customer to start chatting</p>
          </div>
        )}
      </div>

      {/* Intelligence Hub (Location) */}
      <div style={{ width: '340px', padding: '32px 24px', background: '#fff', borderLeft: '1px solid #f0f0f0' }}>
        <h4 style={{ fontSize: '12px', fontWeight: '900', color: '#a8a29e', textTransform: 'uppercase' }}>Intelligence Hub</h4>
        {activeSession && (
          <div style={{ marginTop: '24px' }}>
             <div style={{ padding: '24px', background: '#f0f9ff', borderRadius: '24px' }}>
              <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: '900', marginBottom: '12px' }}>VISITOR LOCATION</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {liveLocation.flag && <img src={liveLocation.flag} width="30" alt="flag" />}
                <div>
                  <div style={{ fontWeight: '800', fontSize: '16px' }}>{liveLocation.city}</div>
                  <div style={{ fontSize: '12px', color: '#78716c' }}>{liveLocation.country}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </div>
  );
}