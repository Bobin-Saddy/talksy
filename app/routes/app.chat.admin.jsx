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
  Store: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" cy="9" x2="9.01" cy="9"></line><line x1="15" cy="9" x2="15.01" cy="9"></line></svg>,
  X: ({ size = 20, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" cy="6" x2="18" y2="18"></line></svg>,
  FileText: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });

const sessions = await prisma.chatSession.findMany({
  where: { shop: shop },
  include: {
    messages: {
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  },
  orderBy: {
    updatedAt: "desc",   // 🔥 REAL SORTING
  },
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

  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // FIXED: Improved Geolocation fetching
  const fetchUserLocation = async () => {
    setLiveLocation({ city: "Detecting...", country: "", flag: "" });
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error();
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const notifyNewMessage = (session, message) => {
    if (audioRef.current) audioRef.current.play().catch(() => {});
    if (activeSession?.sessionId !== session.sessionId) {
      setUnreadCounts(prev => ({ ...prev, [session.sessionId]: (prev[session.sessionId] || 0) + 1 }));
    }
    if (document.visibilityState !== 'visible' && Notification.permission === "granted") {
      new Notification(`New message from ${session.email || 'Customer'}`, { body: message.message, icon: '/favicon.ico' });
    }
  };

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/app/chat/messages?sessionId=${activeSession.sessionId}`);
        const data = await res.json();
        if (data.length > 0) {
          const latestServerMsg = data[data.length - 1];
          if (latestServerMsg.id !== lastMessageIdRef.current) {
            if (latestServerMsg.sender === "user" && !isFirstLoadRef.current) {
              notifyNewMessage(activeSession, latestServerMsg);
            }
            setMessages(data);
setSessions(prev => {
  const updated = prev.filter(s => s.sessionId !== activeSession.sessionId);
  return [activeSession, ...updated];
});

            lastMessageIdRef.current = latestServerMsg.id;
          }
        }
      } catch (err) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const loadChat = async (session) => {
    setActiveSession(session);
    setUnreadCounts(prev => ({ ...prev, [session.sessionId]: 0 }));
    isFirstLoadRef.current = true;
    fetchUserLocation(); // Trigger location fetch on chat click
    try {
      const res = await fetch(`/app/chat/messages?sessionId=${session.sessionId}`);
      const data = await res.json();
      if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
      setMessages(data);
      setTimeout(() => { isFirstLoadRef.current = false; }, 500);
    } catch (err) {}
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview({ url: reader.result, name: file.name, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  // FIXED: Logic to handle Emoji Clicks
  const addEmoji = (emoji) => {
    setReply(prev => prev + emoji);
    // Keep focus on input if you want
    setShowEmojiPicker(false);
  };

  const handleReply = (text = null) => {
    const finalMsg = text || reply;
    const finalFile = filePreview?.url;
    
    if ((!finalMsg.trim() && !finalFile) || !activeSession) return;

    const tempId = `temp-${Date.now()}`;
    const newMessage = {
      message: finalMsg || "Attachment",
      sender: "admin",
      createdAt: new Date().toISOString(),
      sessionId: activeSession.sessionId,
      shop: currentShop,
      fileUrl: finalFile || null,
      id: tempId
    };

    setMessages(prev => [...prev, newMessage]);
setSessions(prev => {
  const updated = prev.filter(s => s.sessionId !== activeSession.sessionId);
  return [activeSession, ...updated];
});

    lastMessageIdRef.current = tempId;
    setReply("");
    setFilePreview(null);
    setShowEmojiPicker(false);

    fetcher.submit(JSON.stringify(newMessage), {
      method: "post",
      action: "/app/chat/message",
      encType: "application/json"
    });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 40px)', width: 'calc(100vw - 40px)', backgroundColor: '#fff', margin: '20px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', border: '1px solid #eee', color: '#433d3c', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(26, 22, 21, 0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', cursor: 'zoom-out' }}>
          <img src={selectedImage} style={{ maxWidth: '85%', maxHeight: '85%', borderRadius: '16px' }} alt="Preview" />
        </div>
      )}

      {/* 1. SIDEBAR */}
      <div style={{ width: '380px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fcfaf8' }}>
        <div style={{ padding: '32px 24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#1a1615', margin: 0 }}>Messages</h2>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '16px', color: '#a8a29e' }}><Icons.Search /></span>
            <input placeholder="Search inbox..." style={{ width: '100%', padding: '14px 48px', borderRadius: '16px', border: '1px solid #e5e7eb', outline: 'none' }} onChange={(e) => setSearchTerm(e.target.value)} value={searchTerm} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {filteredSessions.map(session => (
            <div key={session.sessionId} onClick={() => loadChat(session)} style={{ position: 'relative', padding: '16px', borderRadius: '20px', cursor: 'pointer', marginBottom: '8px', background: activeSession?.sessionId === session.sessionId ? '#fff' : 'transparent', border: activeSession?.sessionId === session.sessionId ? '1px solid #f0f0f0' : '1px solid transparent', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: activeSession?.sessionId === session.sessionId ? accentColor : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeSession?.sessionId === session.sessionId ? 'white' : '#9d9489', flexShrink: 0 }}>
                  <Icons.User size={24} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{session.email?.split('@')[0] || 'User'}</div>
                  <div style={{ fontSize: '13px', color: '#78716c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.messages[0]?.message || 'New Chat'}</div>
                </div>
                {unreadCounts[session.sessionId] > 0 && (
                  <div style={{ background: '#ef4444', color: 'white', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' }}>
                    {unreadCounts[session.sessionId]} New
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. CHAT AREA */}
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
                    {msg.fileUrl ? (
                      msg.fileUrl.includes('image') || msg.fileUrl.startsWith('data:image') ? 
                      <img src={msg.fileUrl} onClick={() => setSelectedImage(msg.fileUrl)} style={{ maxWidth: '280px', borderRadius: '12px', cursor: 'zoom-in' }} /> :
                      <div style={{display:'flex', gap:'8px'}}><Icons.FileText /><a href={msg.fileUrl} target="_blank" style={{color: 'inherit', fontWeight: '600'}}>View Document</a></div>
                    ) : (
                      <div style={{ fontSize: '15px', lineHeight: '1.5' }}>{msg.message}</div>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#a8a29e', marginTop: '5px', textAlign: msg.sender === 'admin' ? 'right' : 'left' }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            {/* PREVIEW CONTAINER */}
            {filePreview && (
              <div style={{ padding: '15px 40px', background: '#fff', borderTop: `2px solid ${accentColor}`, display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ position: 'relative' }}>
                  {filePreview.type.includes('image') ? (
                     <img src={filePreview.url} style={{ height: '60px', width:'60px', objectFit:'cover', borderRadius: '12px', border: '1px solid #eee' }} />
                  ) : (
                    <div style={{height:'60px', width:'60px', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'12px'}}><Icons.FileText /></div>
                  )}
                  <button onClick={() => setFilePreview(null)} style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', borderRadius: '50%', border: 'none', cursor: 'pointer', padding: '4px', display:'flex' }}><Icons.X size={12} color="white" /></button>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '700' }}>{filePreview.name}</div>
                  <div style={{ fontSize: '12px', color: '#78716c' }}>Ready to send</div>
                </div>
              </div>
            )}

            <div style={{ padding: '30px 40px', background: '#fff', borderTop: '1px solid #f0f0f0', position: 'relative' }}>
              
              {/* FIXED EMOJI PICKER UI */}
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '90px', left: '40px', background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #eee', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', zIndex: 10 }}>
                  {emojis.map(e => (
                    <button key={e} onClick={() => addEmoji(e)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '5px', borderRadius: '8px' }} onMouseEnter={(e) => e.target.style.background = '#f3f4f6'} onMouseLeave={(e) => e.target.style.background = 'none'}>
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', background: '#f8f7f6', borderRadius: '20px', padding: '8px 10px', border: '1px solid #eee' }}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} accept="image/*,.pdf" />
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: showEmojiPicker ? accentColor : '#a8a29e' }}><Icons.Smile /></button>
                <button onClick={() => fileInputRef.current.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', margin: '0 12px', color: '#a8a29e' }}><Icons.Paperclip /></button>
                <input placeholder="Write a message..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '15px' }} value={reply} onChange={(e) => setReply(e.target.value)} onKeyPress={(e) => { if(e.key === 'Enter') handleReply(); }} />
                <button onClick={() => handleReply()} style={{ width: '48px', height: '48px', borderRadius: '16px', background: (reply.trim() || filePreview) ? accentColor : '#e5e7eb', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Send /></button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#d1cfcd', gap: '20px' }}>
            <Icons.User size={100} />
            <p style={{ fontWeight: '600' }}>Select a customer to start chatting</p>
          </div>
        )}
      </div>

      {/* 3. INTELLIGENCE PANEL */}
      <div style={{ width: '340px', padding: '32px 24px', background: '#fff', borderLeft: '1px solid #f0f0f0' }}>
        <h4 style={{ fontSize: '12px', fontWeight: '900', color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '1px' }}>Intelligence Hub</h4>
        {activeSession && (
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* <div style={{ padding: '24px', background: '#f0f9ff', borderRadius: '24px' }}>
              <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: '900', marginBottom: '12px' }}>VISITOR LOCATION</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {liveLocation.flag ? (
                  <img src={liveLocation.flag} width="32" style={{ borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                ) : (
                  <div style={{width: 32, height: 20, background: '#e0e0e0', borderRadius: 4}} />
                )}
                <div>
                  <div style={{ fontWeight: '800', fontSize: '16px' }}>{liveLocation.city}</div>
                  <div style={{ fontSize: '12px', color: '#78716c' }}>{liveLocation.country}</div>
                </div>
              </div>
            </div> */}
            <div style={{ padding: '20px', background: '#f8f7f6', borderRadius: '24px' }}>
              <div style={{ fontSize: '10px', color: '#a8a29e', fontWeight: '800', marginBottom: '10px' }}>LOCAL TIME</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                <Icons.Clock /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        * { transition: background 0.2s, transform 0.1s; }
      `}</style>
    </div>
  );
}