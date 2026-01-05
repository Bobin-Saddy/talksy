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
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>,
  X: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [liveLocation, setLiveLocation] = useState({ city: "Detecting...", country: "", flag: "" });

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const isFirstLoadRef = useRef(true);
  const lastKnownMessageIds = useRef({});

  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀", "👋", "🙏", "🎉"];

  // Initialize Sound and Request Notification Permission
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    audioRef.current.load();
    
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        console.log("Notification permission:", permission);
      });
    }

    // Initialize last known messages
    initialSessions.forEach(session => {
      if (session.messages && session.messages.length > 0) {
        lastKnownMessageIds.current[session.sessionId] = session.messages[0].id;
      }
    });
  }, []);

  const fetchUserLocation = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      setLiveLocation({
        city: data.city || "Unknown",
        country: data.country_name || "Private Network",
        flag: data.country_code ? `https://flagcdn.com/w40/${data.country_code.toLowerCase()}.png` : ""
      });
    } catch (e) {
      console.error("Location fetch error:", e);
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

  // Function to play sound and show notification
  const notifyNewMessage = (session, message) => {
    // Play sound
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.error("Audio play failed:", err);
      });
    }

    // Show notification if page is not visible or user is not on active session
    const isPageVisible = document.visibilityState === 'visible';
    const isViewingSession = activeSession?.sessionId === session.sessionId;
    
    if ((!isPageVisible || !isViewingSession) && Notification.permission === "granted") {
      try {
        const notification = new Notification(`New message from ${session.email || 'Customer'}`, {
          body: message.message.substring(0, 100),
          icon: '/favicon.ico',
          tag: `msg-${message.id}`,
          requireInteraction: false,
          silent: false
        });

        notification.onclick = () => {
          window.focus();
          if (!isViewingSession) {
            loadChat(session);
          }
          notification.close();
        };
      } catch (err) {
        console.error("Notification error:", err);
      }
    }
  };

  // Polling for active session messages
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/app/chat/messages?sessionId=${activeSession.sessionId}`);
        const data = await res.json();

        if (data.length > 0) {
          const latestMsg = data[data.length - 1];

          // Check if there's a new message
          if (latestMsg.id !== lastMessageIdRef.current) {
            // Only play sound and show notification for new user messages (not on first load)
            if (latestMsg.sender === "user" && !isFirstLoadRef.current) {
              notifyNewMessage(activeSession, latestMsg);
            }

            lastMessageIdRef.current = latestMsg.id;
            lastKnownMessageIds.current[activeSession.sessionId] = latestMsg.id;
            setMessages(data);
            isFirstLoadRef.current = false;
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // Background polling for ALL sessions (checks sidebar)
  useEffect(() => {
    const globalInterval = setInterval(async () => {
      try {
        // Check each session for new messages
        for (const session of sessions) {
          const res = await fetch(`/app/chat/messages?sessionId=${session.sessionId}`);
          const data = await res.json();

          if (data.length > 0) {
            const latestMsg = data[data.length - 1];
            const lastKnownId = lastKnownMessageIds.current[session.sessionId];

            // New message detected from user
            if (latestMsg.sender === "user" && latestMsg.id !== lastKnownId && lastKnownId !== undefined) {
              // Update the known ID
              lastKnownMessageIds.current[session.sessionId] = latestMsg.id;

              // Notify if it's not the current active session
              if (activeSession?.sessionId !== session.sessionId) {
                notifyNewMessage(session, latestMsg);
                
                // Update sessions list to show badge
                setSessions(prevSessions => 
                  prevSessions.map(s => 
                    s.sessionId === session.sessionId 
                      ? { ...s, messages: [latestMsg] }
                      : s
                  )
                );
              }
            }
          }
        }
      } catch (err) {
        console.error("Global polling error:", err);
      }
    }, 5000);

    return () => clearInterval(globalInterval);
  }, [sessions, activeSession]);

  const loadChat = async (session) => {
    setActiveSession(session);
    isFirstLoadRef.current = true;
    fetchUserLocation();

    try {
      const res = await fetch(`/app/chat/messages?sessionId=${session.sessionId}`);
      const data = await res.json();

      if (data.length > 0) {
        lastMessageIdRef.current = data[data.length - 1].id;
        lastKnownMessageIds.current[session.sessionId] = data[data.length - 1].id;
      }

      setMessages(data);
      
      setTimeout(() => {
        isFirstLoadRef.current = false;
      }, 500);
    } catch (err) {
      console.error("Load chat error:", err);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => handleReply(`Sent file: ${file.name}`, reader.result);
    reader.readAsDataURL(file);
  };

  const handleReply = (text = null, fileUrl = null) => {
    const finalMsg = text || reply;
    if ((!finalMsg.trim() && !fileUrl) || !activeSession) return;

    const newMessage = {
      message: finalMsg,
      sender: "admin",
      createdAt: new Date().toISOString(),
      sessionId: activeSession.sessionId,
      shop: currentShop,
      fileUrl: fileUrl || null,
      id: `temp-${Date.now()}`
    };

    // Optimistically update UI
    setMessages(prev => [...prev, newMessage]);
    lastMessageIdRef.current = newMessage.id;
    setReply("");
    setShowEmojiPicker(false);

    // Submit to server
    fetcher.submit(
      JSON.stringify(newMessage),
      {
        method: "post",
        action: "/app/chat/message",
        encType: "application/json"
      }
    );
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 40px)', width: 'calc(100vw - 40px)', backgroundColor: '#fff', margin: '20px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', border: '1px solid #eee', color: '#433d3c', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>

      {/* --- IMAGE LIGHTBOX --- */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(26, 22, 21, 0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', cursor: 'zoom-out' }}>
          <img src={selectedImage} style={{ maxWidth: '85%', maxHeight: '85%', borderRadius: '16px' }} alt="Preview" />
        </div>
      )}

      {/* 1. SIDEBAR: Inbox */}
      <div style={{ width: '380px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fcfaf8' }}>
        <div style={{ padding: '32px 24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#1a1615', margin: 0 }}>Messages</h2>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '16px', color: '#a8a29e', pointerEvents: 'none' }}><Icons.Search /></span>
            <input placeholder="Search inbox..." style={{ width: '100%', padding: '14px 48px', borderRadius: '16px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '14px', fontFamily: 'inherit' }} onChange={(e) => setSearchTerm(e.target.value)} value={searchTerm} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {filteredSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#a8a29e' }}>
              {searchTerm ? 'No chats found' : 'No conversations yet'}
            </div>
          ) : (
            filteredSessions.map(session => (
              <div key={session.sessionId} onClick={() => loadChat(session)} style={{ position: 'relative', padding: '16px', borderRadius: '20px', cursor: 'pointer', marginBottom: '8px', background: activeSession?.sessionId === session.sessionId ? '#fff' : 'transparent', border: activeSession?.sessionId === session.sessionId ? '1px solid #f0f0f0' : '1px solid transparent', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: activeSession?.sessionId === session.sessionId ? accentColor : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeSession?.sessionId === session.sessionId ? 'white' : '#9d9489', flexShrink: 0 }}>
                    <Icons.User size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{session.email?.split('@')[0] || 'Anonymous'}</div>
                    <div style={{ fontSize: '13px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.messages[0]?.message || "New Conversation"}</div>
                  </div>
                  {/* Visual Alert Badge */}
                  {session.messages[0]?.sender === "user" && activeSession?.sessionId !== session.sessionId && (
                    <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 10px #ef4444', flexShrink: 0 }}></div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. MAIN CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '24px 40px', borderBottom: '1px solid #f0f0f0' }}>
              <h3 style={{ margin: 0, fontWeight: '800', fontSize: '20px' }}>{activeSession.email}</h3>
            </div>

            <div ref={scrollRef} style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', background: '#faf9f8' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#a8a29e' }}>No messages yet</div>
              ) : (
                messages.map((msg, i) => {
                  const isAdmin = msg.sender === 'admin';
                  const isImg = msg.fileUrl && (msg.fileUrl.includes('data:image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.fileUrl));
                  const isPdf = msg.fileUrl && (msg.fileUrl.includes('data:application/pdf') || msg.fileUrl.includes('.pdf'));

                  return (
                    <div key={msg.id || i} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{
                        padding: (isImg || isPdf) ? '12px' : '16px 20px',
                        borderRadius: isAdmin ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
                        background: isAdmin ? accentColor : '#fff',
                        color: isAdmin ? '#fff' : '#433d3c',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        border: isAdmin ? 'none' : '1px solid #f0f0f0'
                      }}>
                        {isImg ? (
                          <img src={msg.fileUrl} onClick={() => setSelectedImage(msg.fileUrl)} style={{ maxWidth: '300px', width: '100%', borderRadius: '14px', cursor: 'zoom-in', display: 'block' }} alt="Attachment" />
                        ) : isPdf ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Icons.FileText />
                            <a href={msg.fileUrl} download style={{ color: isAdmin ? '#fff' : accentColor, textDecoration: 'none', fontWeight: '600' }}>Download PDF</a>
                          </div>
                        ) : (
                          <div style={{ fontSize: '15px', wordWrap: 'break-word', lineHeight: '1.5' }}>{msg.message}</div>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#a8a29e', marginTop: '6px', textAlign: isAdmin ? 'right' : 'left' }}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ padding: '30px 40px', background: '#fff', borderTop: '1px solid #f0f0f0', position: 'relative' }}>
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '100px', left: '40px', background: '#fff', padding: '16px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', zIndex: 100 }}>
                  {emojis.map(e => (
                    <button key={e} onClick={() => { setReply(r => r + e); setShowEmojiPicker(false); }} style={{ fontSize: '22px', border: 'none', background: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>{e}</button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8f7f6', borderRadius: '20px', padding: '8px 10px', border: '1px solid #eee' }}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept="image/*,.pdf" />
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Add emoji"><Icons.Smile /></button>
                <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Attach file"><Icons.Paperclip /></button>
                <input placeholder="Type your response..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '15px', padding: '0 15px', fontFamily: 'inherit' }} value={reply} onChange={(e) => setReply(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }} />
                <button onClick={() => handleReply()} disabled={!reply.trim()} style={{ width: '48px', height: '48px', borderRadius: '16px', background: reply.trim() ? accentColor : '#e5e7eb', border: 'none', color: 'white', cursor: reply.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Send message"><Icons.Send /></button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#d1cfcd', gap: '16px' }}>
            <Icons.User size={100} />
            <p style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Select a chat to begin</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#e5e7eb' }}>Choose a conversation from the sidebar</p>
          </div>
        )}
      </div>

      {/* 3. INTELLIGENCE PANEL */}
      <div style={{ width: '340px', padding: '32px 24px', background: '#fff', borderLeft: '1px solid #f0f0f0', overflowY: 'auto' }}>
        <h4 style={{ fontSize: '12px', fontWeight: '900', color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px', marginTop: 0 }}>Intelligence Hub</h4>
        {activeSession ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '24px', background: '#f0f9ff', borderRadius: '24px' }}>
              <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: '900', marginBottom: '12px', letterSpacing: '0.5px' }}>VISITOR LOCATION</div>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                {liveLocation.flag ? (
                  <img src={liveLocation.flag} width="35" style={{ borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} alt="Flag" />
                ) : (
                  <div style={{ width: '35px', height: '24px', background: '#e5e7eb', borderRadius: '4px' }}></div>
                )}
                <div>
                  <div style={{ fontWeight: '800', fontSize: '16px', color: '#1a1615' }}>{liveLocation.city}</div>
                  {liveLocation.country && (
                    <div style={{ fontSize: '12px', color: '#78716c', marginTop: '2px' }}>{liveLocation.country}</div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '20px', background: '#f8f7f6', borderRadius: '24px' }}>
              <div style={{ fontSize: '10px', color: '#a8a29e', fontWeight: '800', marginBottom: '10px', letterSpacing: '0.5px' }}>VISITOR LOCAL TIME</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', fontSize: '15px', color: '#433d3c' }}>
                <Icons.Clock /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div style={{ padding: '20px', background: '#fef3c7', borderRadius: '24px' }}>
              <div style={{ fontSize: '10px', color: '#92400e', fontWeight: '800', marginBottom: '10px', letterSpacing: '0.5px' }}>SESSION INFO</div>
              <div style={{ fontSize: '13px', color: '#78716c', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', color: '#433d3c' }}>Email:</span> {activeSession.email}
                </div>
                <div>
                  <span style={{ fontWeight: '700', color: '#433d3c' }}>Messages:</span> {messages.length}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#d1cfcd', fontSize: '14px' }}>
            <Icons.Store />
            <p style={{ marginTop: '12px' }}>Waiting for session...</p>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #d1d5db; }

        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}