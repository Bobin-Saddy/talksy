import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useRevalidator } from "react-router"; // Use Remix-specific hooks
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
  const { sessions, currentShop } = useLoaderData();
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState(null); 
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [liveLocation, setLiveLocation] = useState({ city: "Detecting...", country: "", flag: "" });

  const fetcher = useFetcher();
  const revalidator = useRevalidator(); // To refresh sidebar list
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  const accentColor = "#8b5e3c";
  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀", "👋"];

  // Initialize Sound
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Polling for new messages
  useEffect(() => {
    if (!activeSession) return;

    const pollMessages = async () => {
      try {
        const res = await fetch(`/app/chat/messages?sessionId=${activeSession.sessionId}`);
        const data = await res.json();
        
        if (data.length > 0) {
          const latestMsg = data[data.length - 1];
          
          // Logic: If there is a new message and it's from the user
          if (lastMessageIdRef.current && latestMsg.id !== lastMessageIdRef.current) {
            if (latestMsg.sender === "user") {
              audioRef.current?.play().catch(() => {});
              if (Notification.permission === "granted") {
                new Notification(`New message from ${activeSession.email}`, { body: latestMsg.message });
              }
              // Refresh the sidebar to show latest preview
              revalidator.revalidate();
            }
          }
          lastMessageIdRef.current = latestMsg.id;
          setMessages(data);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    const interval = setInterval(pollMessages, 3000); // 3s polling
    return () => clearInterval(interval);
  }, [activeSession, revalidator]);

  const loadChat = async (session) => {
    setActiveSession(session);
    fetchUserLocation();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
    const res = await fetch(`/app/chat/messages?sessionId=${session.sessionId}`);
    const data = await res.json();
    if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
    setMessages(data);
  };

  const fetchUserLocation = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      setLiveLocation({
        city: data.city || "Unknown",
        country: data.country_name || "Private Network",
        flag: `https://flagcdn.com/w40/${data.country_code?.toLowerCase()}.png`
      });
    } catch (e) {
      setLiveLocation({ city: "Not Available", country: "Secured", flag: "" });
    }
  };

  const handleReply = (text = null, fileUrl = null) => {
    const messageContent = text || reply;
    if ((!messageContent.trim() && !fileUrl) || !activeSession) return;
    
    const tempId = Date.now().toString();
    const newMessage = { 
      id: tempId,
      message: messageContent, 
      sender: "admin", 
      createdAt: new Date().toISOString(), 
      sessionId: activeSession.sessionId, 
      shop: currentShop, 
      fileUrl: fileUrl || null 
    };

    // 1. Optimistic Update: Show message immediately
    setMessages(prev => [...prev, newMessage]);
    setReply("");
    setShowEmojiPicker(false);

    // 2. Submit to server
    fetcher.submit(
      { ...newMessage, id: undefined }, // Don't send tempId to DB
      { method: "post", action: "/app/chat/message", encType: "application/json" }
    );
  };

  // Auto Scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sessions, searchTerm]);

  return (
    <div style={{ display: 'flex', height: '90vh', width: '95vw', backgroundColor: '#fff', margin: '20px auto', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', border: '1px solid #eee', color: '#433d3c', fontFamily: 'sans-serif' }}>
      
      {/* Lightbox */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={selectedImage} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px' }} alt="Preview" />
        </div>
      )}

      {/* Sidebar */}
      <div style={{ width: '350px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fcfaf8' }}>
        <div style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Messages</h2>
          <div style={{ position: 'relative', marginTop: '15px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#a8a29e' }}><Icons.Search /></span>
            <input 
              placeholder="Search chats..." 
              style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '12px', border: '1px solid #e5e7eb', outline: 'none' }} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
          {filteredSessions.map(session => (
            <div key={session.sessionId} onClick={() => loadChat(session)} style={{ padding: '12px', borderRadius: '15px', cursor: 'pointer', marginBottom: '5px', background: activeSession?.sessionId === session.sessionId ? '#fff' : 'transparent', border: activeSession?.sessionId === session.sessionId ? '1px solid #eee' : '1px solid transparent', boxShadow: activeSession?.sessionId === session.sessionId ? '0 4px 6px rgba(0,0,0,0.02)' : 'none' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: activeSession?.sessionId === session.sessionId ? accentColor : '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeSession?.sessionId === session.sessionId ? '#fff' : '#666' }}>
                  <Icons.User size={20} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{session.email}</div>
                  <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {session.messages[0]?.message || "No messages yet"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '20px 30px', borderBottom: '1px solid #f0f0f0', fontWeight: '700' }}>{activeSession.email}</div>
            
            <div ref={scrollRef} style={{ flex: 1, padding: '30px', overflowY: 'auto', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {messages.map((msg, i) => {
                const isAdmin = msg.sender === 'admin';
                return (
                  <div key={i} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                    <div style={{ 
                      padding: '12px 16px', borderRadius: '18px',
                      background: isAdmin ? accentColor : '#fff', 
                      color: isAdmin ? '#fff' : '#333',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                      border: isAdmin ? 'none' : '1px solid #eee'
                    }}>
                      {msg.fileUrl ? (
                         <img src={msg.fileUrl} onClick={() => setSelectedImage(msg.fileUrl)} style={{ maxWidth: '200px', borderRadius: '8px', cursor: 'pointer' }} alt="Attachment" />
                      ) : (
                        <div style={{ fontSize: '14px', lineHeight: '1.5' }}>{msg.message}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '20px', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f3f4f6', padding: '8px 15px', borderRadius: '15px' }}>
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><Icons.Smile /></button>
                <input 
                  value={reply} 
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                  placeholder="Type a message..." 
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none' }}
                />
                <button onClick={() => handleReply()} style={{ background: accentColor, color: '#fff', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}><Icons.Send /></button>
              </div>
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '80px', background: '#fff', border: '1px solid #eee', padding: '10px', borderRadius: '10px', display: 'flex', gap: '5px', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                  {emojis.map(e => <span key={e} onClick={() => setReply(r => r + e)} style={{ cursor: 'pointer', fontSize: '20px' }}>{e}</span>)}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>Select a conversation</div>
        )}
      </div>

      {/* Info Panel */}
      <div style={{ width: '300px', borderLeft: '1px solid #f0f0f0', padding: '24px' }}>
        <h4 style={{ fontSize: '12px', color: '#aaa', textTransform: 'uppercase', marginBottom: '20px' }}>Customer Info</h4>
        {activeSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ background: '#f0f7ff', padding: '15px', borderRadius: '15px' }}>
              <div style={{ fontSize: '11px', color: '#0070f3', fontWeight: '700' }}>LOCATION</div>
              <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {liveLocation.flag && <img src={liveLocation.flag} width="20" alt="flag" />}
                <span style={{ fontWeight: '600' }}>{liveLocation.city}, {liveLocation.country}</span>
              </div>
            </div>
            <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '15px' }}>
              <div style={{ fontSize: '11px', color: '#666', fontWeight: '700' }}>LOCAL TIME</div>
              <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icons.Clock /> {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}