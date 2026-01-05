import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

// --- REFINED ICON SET ---
const Icons = {
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  User: ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>,
  X: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  FileText: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const sessions = await prisma.chatSession.findMany({
    where: { shop: shop },
    include: { messages: { orderBy: { createdAt: "desc" } } },
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
  const [unreadSessions, setUnreadSessions] = useState({}); // Track unread counts per sessionId

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const notificationAudio = useRef(null);

  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀", "👋", "🙏"];

  // Initialize Audio Object
  useEffect(() => {
    notificationAudio.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
  }, []);

  // Polling for Global Session Updates (New Conversations or New Messages in existing ones)
  useEffect(() => {
    const globalInterval = setInterval(async () => {
      const res = await fetch(`/app/chat/all-sessions?shop=${currentShop}`); // You might need to create this endpoint or use existing loader
      if (!res.ok) return;
      const latestSessions = await res.json();
      
      latestSessions.forEach(newSess => {
        const oldSess = sessions.find(s => s.sessionId === newSess.sessionId);
        
        // Logic: If session is new OR message count increased
        if (!oldSess || newSess.messages.length > oldSess.messages.length) {
            const lastMsg = newSess.messages[0]; // Messages are desc
            
            // Only notify if the last message is from the USER
            if (lastMsg && lastMsg.sender === 'user') {
                if (activeSession?.sessionId !== newSess.sessionId) {
                  // Play Sound and Mark as Unread
                  notificationAudio.current?.play().catch(e => console.log("Audio play blocked by browser"));
                  setUnreadSessions(prev => ({ ...prev, [newSess.sessionId]: true }));
                } else {
                  // If we are currently talking to this person, just update messages
                  setMessages(newSess.messages.reverse());
                }
            }
        }
      });
      setSessions(latestSessions);
    }, 4000);
    return () => clearInterval(globalInterval);
  }, [sessions, activeSession, currentShop]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sessions, searchTerm]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const loadChat = (session) => {
    setActiveSession(session);
    // Clear unread status when opening the chat
    setUnreadSessions(prev => {
      const newState = { ...prev };
      delete newState[session.sessionId];
      return newState;
    });
    setMessages([...session.messages].reverse());
  };

  const handleReply = (text = null, fileUrl = null) => {
    const finalMsg = text || reply;
    if ((!finalMsg.trim() && !fileUrl) || !activeSession) return;
    
    const newMessage = { 
      message: finalMsg, sender: "admin", createdAt: new Date().toISOString(), 
      sessionId: activeSession.sessionId, shop: currentShop, fileUrl: fileUrl || null 
    };

    setMessages(prev => [...prev, newMessage]);
    setReply("");
    setShowEmojiPicker(false);
    fetcher.submit(JSON.stringify(newMessage), { method: "post", action: "/app/chat/message", encType: "application/json" });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 40px)', width: 'calc(100vw - 40px)', backgroundColor: '#fff', margin: '20px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', border: '1px solid #eee', color: '#433d3c', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      
      {/* Lightbox */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={selectedImage} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px' }} alt="zoom" />
        </div>
      )}

      {/* 1. SIDEBAR */}
      <div style={{ width: '380px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fcfaf8' }}>
        <div style={{ padding: '32px 24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#1a1615' }}>Inbox</h2>
        </div>
        
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '16px', color: '#a8a29e' }}><Icons.Search /></span>
            <input placeholder="Search customers..." style={{ width: '100%', padding: '14px 48px', borderRadius: '16px', border: '1px solid #e5e7eb', outline: 'none' }} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {filteredSessions.map(session => {
            const isUnread = unreadSessions[session.sessionId];
            return (
              <div key={session.sessionId} onClick={() => loadChat(session)} style={{ 
                padding: '16px', borderRadius: '20px', cursor: 'pointer', marginBottom: '8px', 
                background: activeSession?.sessionId === session.sessionId ? '#fff' : 'transparent',
                boxShadow: activeSession?.sessionId === session.sessionId ? '0 10px 15px rgba(0,0,0,0.05)' : 'none',
                border: isUnread ? '1.5px solid #ef4444' : (activeSession?.sessionId === session.sessionId ? '1px solid #f0f0f0' : '1px solid transparent'),
                position: 'relative'
              }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: isUnread ? '#fee2e2' : (activeSession?.sessionId === session.sessionId ? accentColor : '#f3f4f6'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: isUnread ? '#ef4444' : (activeSession?.sessionId === session.sessionId ? 'white' : '#9d9489') }}>
                    <Icons.User size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isUnread ? '900' : '700', fontSize: '15px' }}>{session.email}</div>
                    <div style={{ fontSize: '13px', color: isUnread ? '#ef4444' : '#78716c', fontWeight: isUnread ? '600' : '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                       {session.messages[0]?.message || "New Inquiry"}
                    </div>
                  </div>
                  {isUnread && (
                    <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 10px #ef4444' }}></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '24px 40px', borderBottom: '1px solid #f0f0f0' }}>
               <h3 style={{ margin: 0, fontWeight: '800', fontSize: '20px' }}>{activeSession.email}</h3>
               <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>● Active Conversation</span>
            </div>

            <div ref={scrollRef} style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', background: '#faf9f8' }}>
              {messages.map((msg, i) => {
                const isAdmin = msg.sender === 'admin';
                return (
                  <div key={i} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                    <div style={{ 
                      padding: '14px 18px', borderRadius: isAdmin ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                      background: isAdmin ? accentColor : '#fff', color: isAdmin ? '#fff' : '#433d3c',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: isAdmin ? 'none' : '1px solid #f0f0f0'
                    }}>
                      {msg.fileUrl ? (
                         <img src={msg.fileUrl} onClick={() => setSelectedImage(msg.fileUrl)} style={{ maxWidth: '100%', borderRadius: '10px', cursor: 'pointer' }} />
                      ) : (
                        <div style={{ fontSize: '15px' }}>{msg.message}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '25px 40px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8f7f6', borderRadius: '18px', padding: '8px 10px', border: '1px solid #eee' }}>
                <input placeholder="Write a message..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', padding: '10px' }} value={reply} onChange={(e) => setReply(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleReply()} />
                <button onClick={() => handleReply()} style={{ width: '42px', height: '42px', borderRadius: '12px', background: accentColor, border: 'none', color: 'white', cursor: 'pointer' }}><Icons.Send /></button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1cfcd' }}>
            <div style={{ textAlign: 'center' }}>
              <Icons.User size={80} />
              <p style={{ fontWeight: '700' }}>Select a customer to start chatting</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </div>
  );
}