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
  FileText: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>,
  X: ({ size = 20, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" cy="9" x2="9.01" cy="9"></line><line x1="15" cy="9" x2="15.01" cy="9"></line></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  const sessions = await prisma.chatSession.findMany({
    where: { shop: shop },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" } // Use updatedAt to get most recent activity
  });
  return json({ sessions, currentShop: shop });
};

export default function NeuralChatAdmin() {
  const { sessions: initialSessions, currentShop } = useLoaderData();
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [filePreview, setFilePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  const accentColor = "#8b5e3c";
  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀"];

  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
  }, []);

  // Sort sessions based on message timestamp or creation
  const filteredSessions = useMemo(() => {
    return [...sessions]
      .filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const dateA = new Date(a.messages[0]?.createdAt || a.createdAt);
        const dateB = new Date(b.messages[0]?.createdAt || b.createdAt);
        return dateB - dateA;
      });
  }, [sessions, searchTerm]);

  // Global Polling for NEW SESSIONS and NEW MESSAGES in other chats
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/app/chat/sessions`); // Create this endpoint to return all sessions
        const updatedSessions = await res.json();
        
        updatedSessions.forEach(s => {
          const oldSession = sessions.find(os => os.sessionId === s.sessionId);
          const newMsgId = s.messages[0]?.id;
          const oldMsgId = oldSession?.messages[0]?.id;

          if (newMsgId && newMsgId !== oldMsgId) {
            // New message detected!
            if (s.messages[0].sender === "user") {
              if (activeSession?.sessionId !== s.sessionId) {
                setUnreadCounts(prev => ({ ...prev, [s.sessionId]: (prev[s.sessionId] || 0) + 1 }));
                audioRef.current?.play().catch(() => {});
              }
            }
          }
        });
        setSessions(updatedSessions);
      } catch (err) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [sessions, activeSession]);

  // Polling for ACTIVE CHAT
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/app/chat/messages?sessionId=${activeSession.sessionId}`);
        const data = await res.json();
        if (data.length > 0) {
          const latestServerMsg = data[data.length - 1];
          if (latestServerMsg.id !== lastMessageIdRef.current) {
            setMessages(data);
            lastMessageIdRef.current = latestServerMsg.id;
          }
        }
      } catch (err) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const loadChat = (session) => {
    setActiveSession(session);
    setUnreadCounts(prev => ({ ...prev, [session.sessionId]: 0 }));
    fetchMessages(session.sessionId);
  };

  const fetchMessages = async (sid) => {
    const res = await fetch(`/app/chat/messages?sessionId=${sid}`);
    const data = await res.json();
    setMessages(data);
    if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
  };

  const handleReply = () => {
    if (!reply.trim() && !filePreview) return;
    
    const newMessage = {
      message: reply || "Attachment",
      sender: "admin",
      createdAt: new Date().toISOString(),
      sessionId: activeSession.sessionId,
      shop: currentShop,
      fileUrl: filePreview?.url || null,
      id: `temp-${Date.now()}`
    };

    setMessages(prev => [...prev, newMessage]);
    
    // Move current session to top locally
    setSessions(prev => {
      const otherSessions = prev.filter(s => s.sessionId !== activeSession.sessionId);
      const updatedActive = { ...activeSession, messages: [newMessage] };
      return [updatedActive, ...otherSessions];
    });

    setReply("");
    setFilePreview(null);
    
    fetcher.submit(JSON.stringify(newMessage), {
      method: "post",
      action: "/app/chat/message",
      encType: "application/json"
    });
  };

  return (
    <div style={{ display: 'flex', height: '90vh', margin: '20px', background: '#fff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: '350px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fcfaf8' }}>
        <div style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '20px' }}>Chats</h2>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '12px', color: '#a8a29e' }}><Icons.Search /></span>
            <input 
              placeholder="Search customers..." 
              style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: '1px solid #eee', outline: 'none' }}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
          {filteredSessions.map(session => {
            const isUnread = unreadCounts[session.sessionId] > 0;
            const isActive = activeSession?.sessionId === session.sessionId;
            
            return (
              <div 
                key={session.sessionId} 
                onClick={() => loadChat(session)}
                style={{ 
                  padding: '16px', 
                  borderRadius: '16px', 
                  cursor: 'pointer', 
                  marginBottom: '8px', 
                  background: isActive ? '#fff' : 'transparent',
                  boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                  border: isActive ? `1px solid #eee` : '1px solid transparent',
                  position: 'relative',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ 
                    width: '45px', height: '45px', borderRadius: '12px', 
                    background: isUnread ? '#ef4444' : (isActive ? accentColor : '#e5e7eb'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' 
                  }}>
                    <Icons.User size={22} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: isUnread ? '800' : '700', fontSize: '14px' }}>
                        {session.email?.split('@')[0]}
                      </span>
                      <span style={{ fontSize: '10px', color: '#a8a29e' }}>
                        {session.messages[0] ? new Date(session.messages[0].createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: isUnread ? '#1a1615' : '#78716c', 
                      fontWeight: isUnread ? '700' : '400',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' 
                    }}>
                      {session.messages[0]?.message || "No messages yet"}
                    </div>
                  </div>
                  {isUnread && (
                    <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '20px 30px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '18px' }}>{activeSession.email}</div>
                <div style={{ fontSize: '12px', color: '#22c55e' }}>● Online</div>
              </div>
            </div>

            <div ref={scrollRef} style={{ flex: 1, padding: '30px', overflowY: 'auto', background: '#faf9f8', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {messages.map((msg, i) => (
                <div key={msg.id || i} style={{ alignSelf: msg.sender === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                  <div style={{ 
                    padding: '12px 16px', borderRadius: '18px', 
                    background: msg.sender === 'admin' ? accentColor : '#fff', 
                    color: msg.sender === 'admin' ? '#fff' : '#000',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                  }}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '20px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: '15px', padding: '8px 15px' }}>
                <input 
                  placeholder="Type your reply..." 
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', padding: '10px' }} 
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                />
                <button onClick={handleReply} style={{ background: accentColor, color: '#fff', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}>
                  <Icons.Send />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a8a29e' }}>
            Select a conversation to begin
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}