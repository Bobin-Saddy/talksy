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
  Store: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>,
  X: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  MapPin: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>,
  FileText: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
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
  const [selectedImage, setSelectedImage] = useState(null); 
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [liveLocation, setLiveLocation] = useState({ city: "Detecting...", country: "", flag: "" });

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀", "👋", "🙏", "🎉", "💯", "🎈", "✉️"];

  // Fetch Live Location for the User when chat is opened
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

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sessions, searchTerm]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/app/chat/messages?sessionId=${activeSession.sessionId}`);
      const data = await res.json();
      if (data.length !== messages.length) setMessages(data);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeSession, messages.length]);

  const loadChat = async (session) => {
    setActiveSession(session);
    fetchUserLocation();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
    const res = await fetch(`/app/chat/messages?sessionId=${session.sessionId}`);
    const data = await res.json();
    setMessages(data);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf";
    const reader = new FileReader();
    reader.onloadend = () => handleReply(`Sent ${isPdf ? 'PDF' : 'image'}: ${file.name}`, reader.result);
    reader.readAsDataURL(file);
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
      
      {/* --- IMAGE LIGHTBOX --- */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(26, 22, 21, 0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.3s ease' }}>
          <button style={{ position: 'absolute', top: '30px', right: '30px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer' }}><Icons.X /></button>
          <img src={selectedImage} style={{ maxWidth: '85%', maxHeight: '85%', borderRadius: '16px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }} alt="Preview" />
        </div>
      )}

      {/* 1. SIDEBAR: Inbox */}
      <div style={{ width: '380px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fcfaf8' }}>
        <div style={{ padding: '32px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: accentColor, marginBottom: '16px' }}>
            <Icons.Store /><span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px' }}>{currentShop.toUpperCase()}</span>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#1a1615' }}>Messages</h2>
        </div>
        
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '16px', color: '#a8a29e' }}><Icons.Search /></span>
            <input placeholder="Search inbox..." style={{ width: '100%', padding: '14px 48px', borderRadius: '16px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '14px' }} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {filteredSessions.map(session => (
            <div key={session.sessionId} onClick={() => loadChat(session)} style={{ padding: '16px', borderRadius: '20px', cursor: 'pointer', marginBottom: '8px', background: activeSession?.sessionId === session.sessionId ? '#fff' : 'transparent', boxShadow: activeSession?.sessionId === session.sessionId ? '0 10px 15px rgba(0,0,0,0.05)' : 'none', border: activeSession?.sessionId === session.sessionId ? '1px solid #f0f0f0' : '1px solid transparent' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: activeSession?.sessionId === session.sessionId ? accentColor : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeSession?.sessionId === session.sessionId ? 'white' : '#9d9489' }}>
                  <Icons.User size={24} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{session.email?.split('@')[0]}</div>
                  <div style={{ fontSize: '13px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.messages[0]?.message || "No messages"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. MAIN CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '24px 40px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontWeight: '800', fontSize: '20px' }}>{activeSession.email}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                    <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>Live Support Session</span>
                  </div>
                </div>
            </div>

            <div ref={scrollRef} style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', background: '#faf9f8' }}>
              {messages.map((msg, i) => {
                const isPdf = msg.fileUrl && (msg.fileUrl.includes("application/pdf") || msg.fileUrl.endsWith(".pdf") || msg.message.toLowerCase().includes("pdf"));
                const isImg = msg.fileUrl && !isPdf && (msg.fileUrl.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i) != null || msg.fileUrl.startsWith('data:image'));
                const isAdmin = msg.sender === 'admin';
                
                return (
                  <div key={i} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '70%', animation: 'slideUp 0.3s ease' }}>
                    <div style={{ 
                      padding: (isImg || isPdf) ? '12px' : '16px 20px', borderRadius: isAdmin ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
                      background: isAdmin ? accentColor : '#fff', color: isAdmin ? '#fff' : '#433d3c',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: isAdmin ? 'none' : '1px solid #f0f0f0'
                    }}>
                      {isImg ? (
                        <img src={msg.fileUrl} onClick={() => setSelectedImage(msg.fileUrl)} style={{ maxWidth: '100%', borderRadius: '14px', cursor: 'zoom-in', display: 'block' }} alt="Sent content" />
                      ) : isPdf ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px' }}>
                          <div style={{ background: isAdmin ? 'rgba(255,255,255,0.2)' : '#fee2e2', padding: '12px', borderRadius: '12px', color: isAdmin ? '#fff' : '#dc2626' }}>
                            <Icons.FileText />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '700' }}>Document.pdf</div>
                            <a href={msg.fileUrl} download="User_Document.pdf" style={{ fontSize: '12px', color: isAdmin ? '#fff' : accentColor, textDecoration: 'underline', fontWeight: 'bold' }}>Click to Download</a>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '15px', lineHeight: '1.6' }}>{msg.message}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '30px 40px', background: '#fff', borderTop: '1px solid #f0f0f0', position: 'relative' }}>
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '100px', left: '40px', background: '#fff', padding: '16px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', zIndex: 100 }}>
                  {emojis.map(e => (
                    <button key={e} onClick={() => setReply(r => r + e)} style={{ fontSize: '22px', border: 'none', background: 'none', cursor: 'pointer' }}>{e}</button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8f7f6', borderRadius: '20px', padding: '8px 10px 8px 20px', border: '1px solid #eee' }}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept="image/*,application/pdf" />
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: '10px' }}><Icons.Smile /></button>
                <button onClick={() => fileInputRef.current.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: '10px' }}><Icons.Paperclip /></button>
                <input placeholder="Type your response..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '15px', padding: '0 15px' }} value={reply} onChange={(e) => setReply(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleReply()} />
                <button onClick={() => handleReply()} style={{ width: '48px', height: '48px', borderRadius: '16px', background: accentColor, border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Send /></button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#d1cfcd', background: '#fcfaf8' }}>
            <Icons.User size={100} /><p style={{ fontWeight: '700', fontSize: '18px' }}>Select an inquiry to view insights</p>
          </div>
        )}
      </div>

      {/* 3. INTELLIGENCE PANEL: Real-time Location & Insights */}
      <div style={{ width: '340px', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '24px', background: '#fff' }}>
         <h4 style={{ fontSize: '12px', fontWeight: '900', color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Intelligence Hub</h4>
         
         {activeSession ? (
           <>
            {/* LIVE LOCATION CARD */}
            <div style={{ padding: '24px', background: '#f0f9ff', borderRadius: '24px', border: '1px solid #e0f2fe' }}>
              <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: '900', marginBottom: '12px' }}>LIVE VISITOR LOCATION</div>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                {liveLocation.flag && <img src={liveLocation.flag} alt="flag" style={{ width: '35px', borderRadius: '4px' }} />}
                <div>
                  <div style={{ fontWeight: '800', color: '#0c4a6e', fontSize: '16px' }}>{liveLocation.city}</div>
                  <div style={{ fontSize: '12px', color: '#0ea5e9', fontWeight: '600' }}>{liveLocation.country}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px', background: '#f8f7f6', borderRadius: '24px', border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: '10px', color: '#a8a29e', fontWeight: '800', marginBottom: '10px' }}>VISITOR LOCAL TIME</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
                <Icons.Clock /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div style={{ padding: '24px', background: '#fff1e6', borderRadius: '24px', color: '#8b5e3c', border: '1px solid #ffedd5' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', marginBottom: '8px' }}>STORE CONTEXT</div>
              <p style={{ fontSize: '13px', margin: 0, lineHeight: '1.5', fontWeight: '600' }}>Browsing from <b>{currentShop}</b>. System prioritizing high-value customer inquiry logic.</p>
            </div>
           </>
         ) : (
           <div style={{ textAlign: 'center', padding: '60px 0', color: '#d1cfcd', fontSize: '14px' }}>Please select a customer session.</div>
         )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </div>
  );
}