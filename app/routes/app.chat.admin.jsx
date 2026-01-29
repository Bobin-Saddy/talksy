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
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" cy="9" x2="9.01" cy="9"></line><line x1="15" cy="9" x2="15.01" cy="9"></line></svg>,
  X: ({ size = 20, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" cy="6" x2="18" y2="18"></line></svg>,
  FileText: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>,
  CheckCircle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  AlertCircle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
  RotateCcw: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
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
        take: 1
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return json({ sessions, currentShop: shop });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const body = await request.json();
  
  if (body.action === "resolve") {
    await prisma.chatSession.update({
      where: { sessionId: body.sessionId },
      data: { 
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: "admin"
      }
    });
    return json({ success: true });
  }
  
  if (body.action === "unresolve") {
    await prisma.chatSession.update({
      where: { sessionId: body.sessionId },
      data: { 
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null
      }
    });
    return json({ success: true });
  }
  
  return json({ success: false });
};

export default function NeuralChatAdmin() {
  const { sessions: initialSessions, currentShop } = useLoaderData();
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [accentColor] = useState("#6366f1"); 
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState(null); 
  const [filePreview, setFilePreview] = useState(null); 
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const isFirstLoadRef = useRef(true);

  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀", "👋", "🙏", "🎉"];

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/app/chat/sessions");
        const data = await res.json();
        setSessions(data.sessions);
      } catch (e) {
        console.error("Failed to refresh sessions");
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/app/chat/admin");
        const data = await res.json();
        setSessions(data.sessions);
      } catch (e) {
        console.error("Session refresh failed");
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const filteredSessions = useMemo(() => {
    let filtered = sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterStatus === "pending") {
      filtered = filtered.filter(s => !s.isResolved);
    } else if (filterStatus === "resolved") {
      filtered = filtered.filter(s => s.isResolved);
    }
    return filtered;
  }, [sessions, searchTerm, filterStatus]);

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
            lastMessageIdRef.current = latestServerMsg.id;
            setSessions(prev => {
              const updated = prev.map(s =>
                s.sessionId === activeSession.sessionId
                  ? { ...s, updatedAt: new Date().toISOString() }
                  : s
              );
              return [...updated].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            });
          }
        }
      } catch (err) {
        console.error("Message polling error", err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const loadChat = async (session) => {
    setActiveSession(session);
    setUnreadCounts(prev => ({ ...prev, [session.sessionId]: 0 }));
    isFirstLoadRef.current = true;
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

  const addEmoji = (emoji) => {
    setReply(prev => prev + emoji);
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

  const handleMarkResolved = async () => {
    if (!activeSession) return;
    fetcher.submit(JSON.stringify({ action: "resolve", sessionId: activeSession.sessionId }), {
      method: "post",
      action: "/app/chat/admin",
      encType: "application/json"
    });
    setSessions(prev => prev.map(s => 
      s.sessionId === activeSession.sessionId 
        ? { ...s, isResolved: true, resolvedAt: new Date().toISOString() }
        : s
    ));
    setActiveSession(prev => ({ ...prev, isResolved: true, resolvedAt: new Date().toISOString() }));
  };

  const handleReopenChat = async () => {
    if (!activeSession) return;
    fetcher.submit(JSON.stringify({ action: "unresolve", sessionId: activeSession.sessionId }), {
      method: "post",
      action: "/app/chat/admin",
      encType: "application/json"
    });
    setSessions(prev => prev.map(s => 
      s.sessionId === activeSession.sessionId 
        ? { ...s, isResolved: false, resolvedAt: null }
        : s
    ));
    setActiveSession(prev => ({ ...prev, isResolved: false, resolvedAt: null }));
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f9fafb', color: '#111827', fontFamily: '"Inter", system-ui, sans-serif' }}>
      
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', cursor: 'zoom-out' }}>
          <img src={selectedImage} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px' }} alt="Preview" />
        </div>
      )}

      {/* SIDEBAR */}
      <div style={{ width: '360px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Messages</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: 4 }}>Manage customer conversations</p>
        </div>

        {/* Filter Tabs */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: '6px', borderBottom: '1px solid #f3f4f6' }}>
          <button 
            onClick={() => setFilterStatus("all")}
            style={{ 
              flex: 1, 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: filterStatus === "all" ? 'none' : '1px solid #e5e7eb', 
              background: filterStatus === "all" ? '#6366f1' : '#fff',
              color: filterStatus === "all" ? '#fff' : '#6b7280',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            All {sessions.length > 0 && `(${sessions.length})`}
          </button>
          <button 
            onClick={() => setFilterStatus("pending")}
            style={{ 
              flex: 1, 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: filterStatus === "pending" ? 'none' : '1px solid #e5e7eb',
              background: filterStatus === "pending" ? '#f59e0b' : '#fff',
              color: filterStatus === "pending" ? '#fff' : '#6b7280',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Pending {sessions.filter(s => !s.isResolved).length > 0 && `(${sessions.filter(s => !s.isResolved).length})`}
          </button>
          <button 
            onClick={() => setFilterStatus("resolved")}
            style={{ 
              flex: 1, 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: filterStatus === "resolved" ? 'none' : '1px solid #e5e7eb',
              background: filterStatus === "resolved" ? '#10b981' : '#fff',
              color: filterStatus === "resolved" ? '#fff' : '#6b7280',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Resolved {sessions.filter(s => s.isResolved).length > 0 && `(${sessions.filter(s => s.isResolved).length})`}
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '12px', color: '#9ca3af' }}><Icons.Search /></span>
            <input placeholder="Search conversations..." style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '14px' }} onChange={(e) => setSearchTerm(e.target.value)} value={searchTerm} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
          {filteredSessions.map(session => (
            <div key={session.sessionId} onClick={() => loadChat(session)} style={{ position: 'relative', padding: '12px', borderRadius: '12px', cursor: 'pointer', marginBottom: '6px', background: activeSession?.sessionId === session.sessionId ? '#f0f9ff' : 'transparent', border: activeSession?.sessionId === session.sessionId ? '1px solid #bae6fd' : '1px solid transparent', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: activeSession?.sessionId === session.sessionId ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeSession?.sessionId === session.sessionId ? 'white' : '#9ca3af', flexShrink: 0 }}>
                  <Icons.User size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 2 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{session.email?.split('@')[0] || 'User'}</div>
                    {session.isResolved && (
                      <div style={{ background: '#10b981', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icons.Check />
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.messages[0]?.message || 'New Chat'}</div>
                </div>
                {unreadCounts[session.sessionId] > 0 && (
                  <div style={{ background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: '700', padding: '4px 8px', borderRadius: '10px', minWidth: '20px', textAlign: 'center' }}>
                    {unreadCounts[session.sessionId]}
                  </div>
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
            <div style={{ padding: '20px 32px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontWeight: '700', fontSize: '18px', color: '#111827' }}>{activeSession.email}</h3>
                  {activeSession.isResolved && (
                    <div style={{ background: '#d1fae5', color: '#065f46', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icons.Check />
                      Resolved
                    </div>
                  )}
                </div>
                {activeSession.resolvedAt && (
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Resolved on {new Date(activeSession.resolvedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              
              {!activeSession.isResolved ? (
                <button 
                  onClick={handleMarkResolved}
                  style={{ 
                    padding: '10px 18px', 
                    borderRadius: '10px', 
                    border: 'none', 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Icons.CheckCircle />
                  Mark as Resolved
                </button>
              ) : (
                <button 
                  onClick={handleReopenChat}
                  style={{ 
                    padding: '10px 18px', 
                    borderRadius: '10px', 
                    border: '2px solid #f59e0b', 
                    background: '#fff',
                    color: '#f59e0b',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fffbeb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <Icons.RotateCcw />
                  Reopen Chat
                </button>
              )}
            </div>

            <div ref={scrollRef} style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', background: '#f9fafb' }}>
              {messages.map((msg, i) => (
                <div key={msg.id || i} style={{ alignSelf: msg.sender === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '65%' }}>
                  <div style={{ padding: '12px 16px', borderRadius: '16px', background: msg.sender === 'admin' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : '#fff', color: msg.sender === 'admin' ? '#fff' : '#111827', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: msg.sender === 'admin' ? 'none' : '1px solid #e5e7eb' }}>
                    {msg.fileUrl ? (
                      msg.fileUrl.includes('image') || msg.fileUrl.startsWith('data:image') ? 
                      <img src={msg.fileUrl} onClick={() => setSelectedImage(msg.fileUrl)} style={{ maxWidth: '280px', borderRadius: '10px', cursor: 'zoom-in' }} alt="attachment" /> :
                      <div style={{display:'flex', gap:'8px', alignItems: 'center'}}><Icons.FileText /><a href={msg.fileUrl} target="_blank" rel="noreferrer" style={{color: 'inherit', fontWeight: '600', textDecoration: 'none'}}>View Document</a></div>
                    ) : (
                      <div style={{ fontSize: '14px', lineHeight: '1.5' }}>{msg.message}</div>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', textAlign: msg.sender === 'admin' ? 'right' : 'left' }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            {filePreview && (
              <div style={{ padding: '12px 32px', background: '#fef3c7', borderTop: '2px solid #fbbf24', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  {filePreview.type.includes('image') ? (
                     <img src={filePreview.url} style={{ height: '50px', width:'50px', objectFit:'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} alt="preview" />
                  ) : (
                    <div style={{height:'50px', width:'50px', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'8px'}}><Icons.FileText /></div>
                  )}
                  <button onClick={() => setFilePreview(null)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', borderRadius: '50%', border: 'none', cursor: 'pointer', padding: '4px', display:'flex' }}><Icons.X size={12} color="white" /></button>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{filePreview.name}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Ready to send</div>
                </div>
              </div>
            )}

            <div style={{ padding: '20px 32px', background: '#fff', borderTop: '1px solid #e5e7eb', position: 'relative' }}>
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '80px', left: '32px', background: 'white', padding: '12px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', zIndex: 10 }}>
                  {emojis.map(e => (
                    <button key={e} onClick={() => addEmoji(e)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', padding: '6px', borderRadius: '8px', transition: 'all 0.2s' }} onMouseEnter={(e) => e.target.style.background = '#f3f4f6'} onMouseLeave={(e) => e.target.style.background = 'none'}>
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', background: '#f9fafb', borderRadius: '12px', padding: '6px 8px', border: '1px solid #e5e7eb' }}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} accept="image/*,.pdf" />
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: showEmojiPicker ? accentColor : '#9ca3af', padding: '8px' }}><Icons.Smile /></button>
                <button onClick={() => fileInputRef.current.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', margin: '0 8px', color: '#9ca3af', padding: '8px' }}><Icons.Paperclip /></button>
                <input placeholder="Type a message..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: '#111827' }} value={reply} onChange={(e) => setReply(e.target.value)} onKeyPress={(e) => { if(e.key === 'Enter') handleReply(); }} />
                <button onClick={() => handleReply()} style={{ width: '40px', height: '40px', borderRadius: '10px', background: (reply.trim() || filePreview) ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : '#e5e7eb', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}><Icons.Send /></button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', gap: '16px', background: '#f9fafb' }}>
            <Icons.User size={80} />
            <p style={{ fontWeight: '600', fontSize: '16px', color: '#9ca3af' }}>Select a conversation to start chatting</p>
          </div>
        )}
      </div>

      {/* INTELLIGENCE PANEL */}
      <div style={{ width: '320px', padding: '24px', background: '#fff', borderLeft: '1px solid #e5e7eb' }}>
        <h4 style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 20 }}>Chat Details</h4>
        {activeSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', background: activeSession.isResolved ? '#d1fae5' : '#fef3c7', borderRadius: '12px', border: activeSession.isResolved ? '1px solid #86efac' : '1px solid #fcd34d' }}>
              <div style={{ fontSize: '10px', color: activeSession.isResolved ? '#065f46' : '#92400e', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.5px' }}>
                STATUS
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '15px', color: activeSession.isResolved ? '#065f46' : '#92400e' }}>
                {activeSession.isResolved ? <Icons.CheckCircle /> : <Icons.AlertCircle />}
                {activeSession.isResolved ? 'Resolved' : 'Pending'}
              </div>
            </div>

            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.5px' }}>LOCAL TIME</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px', color: '#111827' }}>
                <Icons.Clock /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '10px', color: '#1e40af', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.5px' }}>MESSAGES</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#1e40af' }}>
                {messages.length}
              </div>
              <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: 4 }}>Total exchanges</div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f3f4f6; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>
    </div>
  );
}