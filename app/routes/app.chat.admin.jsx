import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { canCreateChat, shouldBlurChat } from "../planLimits.server";

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
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  TrendingUp: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>,
  AlertTriangle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Inbox: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>,
  Lock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Eye: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  EyeOff: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>,
  Zap: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  // ✅ FETCH ALL SESSIONS WITH INDEX - ORDERED BY CREATION TIME
  const sessions = await prisma.chatSession.findMany({
    where: { shop: shop },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "asc" }
  });

  // ✅ GET PLAN LIMITS
  const chatLimit = await canCreateChat(shop);

  // ✅ CHECK BLUR STATUS FOR EACH SESSION
  const sessionsWithLimitInfo = await Promise.all(
    sessions.map(async (session, index) => {
      const isOverLimit = chatLimit.max > 0 && index >= chatLimit.max;
      
      // ✅ Check if chat should be blurred based on retention policy
      const blurInfo = await shouldBlurChat(shop, session.createdAt);
      
      return {
        ...session,
        chatIndex: index + 1,
        isOverLimit: isOverLimit,
        shouldBlur: blurInfo.shouldBlur,
        blurReason: blurInfo.reason,
        retentionDays: blurInfo.retentionDays,
        currentPlan: blurInfo.plan,
      };
    })
  );

  // ✅ Sort by updated time for display (but isOverLimit is already set)
  sessionsWithLimitInfo.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return json({ 
    sessions: sessionsWithLimitInfo,
    currentShop: shop,
    planLimit: {
      current: sessions.length,
      max: chatLimit.max,
      remaining: chatLimit.remaining,
      isNearLimit: chatLimit.remaining <= 5 && chatLimit.remaining > 0,
      isAtLimit: !chatLimit.allowed,
      isOverLimit: chatLimit.max > 0 && sessions.length > chatLimit.max,
      overLimitBy: chatLimit.max > 0 ? Math.max(0, sessions.length - chatLimit.max) : 0,
    }
  });
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
  const { sessions: initialSessions, currentShop, planLimit: initialPlanLimit } = useLoaderData();
  const [sessions, setSessions] = useState(initialSessions);
  const [planLimit, setPlanLimit] = useState(initialPlanLimit);
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
  const [showBlurPopup, setShowBlurPopup] = useState(false); // ✅ NEW: Blur popup state

  const fetcher = useFetcher();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const isFirstLoadRef = useRef(true);
  const lastSessionCountRef = useRef(initialSessions.length);

  const emojis = ["😊", "👍", "❤️", "🙌", "✨", "🔥", "✅", "🤔", "💡", "🚀", "👋", "🙏", "🎉"];

  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ✅ REAL-TIME SESSION UPDATES
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(window.location.pathname, {
          headers: {
            'Accept': 'application/json'
          }
        });
        const data = await res.json();
        
        if (data.sessions && data.planLimit) {
          const newSessionCount = data.sessions.length;
          const previousCount = lastSessionCountRef.current;
          
          const currentSessionIds = sessions.map(s => s.sessionId);
          const newSessions = data.sessions.filter(s => 
            !currentSessionIds.includes(s.sessionId)
          );
          
          const updatedSessions = data.sessions.filter(newS => {
            const oldS = sessions.find(s => s.sessionId === newS.sessionId);
            return oldS && new Date(newS.updatedAt) > new Date(oldS.updatedAt);
          });
          
          setSessions(data.sessions);
          setPlanLimit(data.planLimit);
          
          if (newSessions.length > 0) {
            console.log("🆕 New chat(s) detected!", newSessions.length, "new sessions");
            
            if (audioRef.current) {
              audioRef.current.play().catch(() => {});
            }
            
            if (Notification.permission === "granted") {
              newSessions.forEach(newSession => {
                new Notification("New Chat Request", {
                  body: "From: " + (newSession.email || 'Customer'),
                  icon: '/favicon.ico'
                });
              });
            }
            
            const hasOverLimitNewChat = newSessions.some(s => s.isOverLimit);
            if (hasOverLimitNewChat) {
              console.log("📬 New over-limit chat - switching to Requests tab");
              setFilterStatus("requests");
            }
          }
          
          if (updatedSessions.length > 0 && newSessions.length === 0) {
            console.log("📨 Message updates detected in", updatedSessions.length, "sessions");
          }
          
          lastSessionCountRef.current = newSessionCount;
        }
      } catch (e) {
        console.error("Session refresh failed:", e);
      }
    }, 1500);
    
    return () => clearInterval(interval);
  }, [sessions]);

  // ✅ FILTER SESSIONS
  const filteredSessions = useMemo(() => {
    let filtered = sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterStatus === "requests") {
      filtered = filtered.filter(s => s.isOverLimit === true);
    } else {
      filtered = filtered.filter(s => s.isOverLimit !== true);
      
      if (filterStatus === "pending") {
        filtered = filtered.filter(s => !s.isResolved);
      } else if (filterStatus === "resolved") {
        filtered = filtered.filter(s => s.isResolved);
      }
    }
    
    return filtered;
  }, [sessions, searchTerm, filterStatus]);

  // ✅ CHECK IF ACTIVE SESSION IS OVER LIMIT OR BLURRED
  const isActiveSessionOverLimit = activeSession?.isOverLimit === true;
  const isActiveSessionBlurred = activeSession?.shouldBlur === true;

  // ✅ COUNT SESSIONS FOR TABS
  const withinLimitSessions = sessions.filter(s => s.isOverLimit !== true);
  const overLimitSessions = sessions.filter(s => s.isOverLimit === true);

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
      new Notification("New message from " + (session.email || 'Customer'), { body: message.message, icon: '/favicon.ico' });
    }
  };

  // ✅ POLL ACTIVE CHAT MESSAGES
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/app/chat/messages?sessionId=" + activeSession.sessionId);
        const data = await res.json();
        
        if (data.length !== messages.length || 
            (data.length > 0 && data[data.length - 1].id !== lastMessageIdRef.current)) {
          
          const latestServerMsg = data[data.length - 1];
          
          if (latestServerMsg && 
              latestServerMsg.sender === "user" && 
              latestServerMsg.id !== lastMessageIdRef.current &&
              !isFirstLoadRef.current) {
            notifyNewMessage(activeSession, latestServerMsg);
          }
          
          setMessages(data);
          if (data.length > 0) {
            lastMessageIdRef.current = data[data.length - 1].id;
          }
        }
      } catch (err) {
        console.error("Message polling error", err);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [activeSession, messages.length]);

  // ✅ LOAD CHAT - WITH BLUR CHECK
  const loadChat = async (session) => {
    // ✅ If chat is blurred, show popup instead of loading
    if (session.shouldBlur) {
      setShowBlurPopup(true);
      return;
    }

    setActiveSession(session);
    setUnreadCounts(prev => ({ ...prev, [session.sessionId]: 0 }));
    isFirstLoadRef.current = true;
    try {
      const res = await fetch("/app/chat/messages?sessionId=" + session.sessionId);
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

  const handleReply = async (text = null) => {
    if (isActiveSessionOverLimit) {
      alert("This chat is over your plan limit. Upgrade to respond to new customer requests.");
      return;
    }

    if (isActiveSessionBlurred) {
      setShowBlurPopup(true);
      return;
    }

    const finalMsg = text || reply;
    const finalFile = filePreview?.url;
    if ((!finalMsg.trim() && !finalFile) || !activeSession) return;
    
    const newMessage = {
      message: finalMsg || "Attachment",
      sender: "admin",
      createdAt: new Date().toISOString(),
      sessionId: activeSession.sessionId,
      shop: currentShop,
      fileUrl: finalFile || null,
    };
    
    setReply("");
    setFilePreview(null);
    setShowEmojiPicker(false);
    
    try {
      const response = await fetch("/app/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMessage)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log("✅ Message sent successfully:", result.newMessage?.id);
      } else {
        console.error("❌ Failed to send message:", result.error);
        alert("Failed to send message. Please try again.");
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
      alert("Failed to send message. Please try again.");
    }
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
      
      {/* ✅ BLUR UPGRADE POPUP */}
      {showBlurPopup && (
        <div 
          onClick={() => setShowBlurPopup(false)} 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            backgroundColor: 'rgba(0, 0, 0, 0.7)', 
            zIndex: 10000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: 'white', 
              borderRadius: '20px', 
              padding: '40px', 
              maxWidth: '500px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              cursor: 'default',
              position: 'relative'
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowBlurPopup(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icons.X size={20} color="#9ca3af" />
            </button>

            {/* Icon */}
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              color: 'white'
            }}>
              <Icons.EyeOff />
            </div>

            {/* Title */}
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#111827', 
              textAlign: 'center',
              marginBottom: '12px'
            }}>
              Chat History Expired
            </h2>

            {/* Description */}
            <p style={{ 
              fontSize: '15px', 
              color: '#6b7280', 
              textAlign: 'center',
              lineHeight: '1.6',
              marginBottom: '24px'
            }}>
              This chat is older than your <strong>FREE plan</strong> retention period (2 minutes). 
              Upgrade to <strong>Standard</strong> or <strong>Premium</strong> to access full chat history.
            </p>

            {/* Features */}
            <div style={{ 
              background: '#f9fafb', 
              borderRadius: '12px', 
              padding: '20px',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af', marginBottom: '12px', letterSpacing: '0.5px' }}>
                UPGRADE BENEFITS:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    borderRadius: '50%', 
                    background: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icons.Check />
                  </div>
                  <span style={{ fontSize: '14px', color: '#111827' }}>
                    <strong>Standard:</strong> 180 days chat history
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    borderRadius: '50%', 
                    background: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icons.Check />
                  </div>
                  <span style={{ fontSize: '14px', color: '#111827' }}>
                    <strong>Premium:</strong> Unlimited chat history
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    borderRadius: '50%', 
                    background: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icons.Check />
                  </div>
                  <span style={{ fontSize: '14px', color: '#111827' }}>
                    Access to advanced features
                  </span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowBlurPopup(false)}
                style={{ 
                  flex: 1,
                  padding: '14px 20px', 
                  borderRadius: '10px', 
                  border: '2px solid #e5e7eb', 
                  background: '#fff',
                  color: '#6b7280',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
              >
                Maybe Later
              </button>
              <button 
                onClick={() => window.location.href = '/app/subscription'}
                style={{ 
                  flex: 1,
                  padding: '14px 20px', 
                  borderRadius: '10px', 
                  border: 'none', 
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <Icons.Zap />
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* ✅ OVER LIMIT WARNING */}
        {planLimit.isOverLimit && (
          <div style={{ 
            margin: '0 16px 16px', 
            padding: '14px', 
            background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)', 
            borderRadius: '12px', 
            color: 'white',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Icons.AlertTriangle />
              <div style={{ fontSize: '13px', fontWeight: '700' }}>
                Over Plan Limit (+{planLimit.overLimitBy} extra)
              </div>
            </div>
            <div style={{ fontSize: '12px', opacity: 0.95, lineHeight: '1.4' }}>
              {planLimit.overLimitBy} customer{planLimit.overLimitBy !== 1 ? 's' : ''} waiting. Check the "Requests" tab.
            </div>
            <button 
              onClick={() => window.location.href = '/app/subscription'}
              style={{ 
                marginTop: '10px', 
                padding: '8px 14px', 
                background: 'white', 
                color: '#7c3aed', 
                border: 'none', 
                borderRadius: '8px', 
                fontWeight: '600', 
                fontSize: '12px', 
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Upgrade to Continue
            </button>
          </div>
        )}

        {/* ✅ 4-TAB FILTER */}
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', borderBottom: '1px solid #f3f4f6' }}>
          <button 
            onClick={() => setFilterStatus("all")}
            style={{ 
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
            All {withinLimitSessions.length > 0 && "(" + withinLimitSessions.length + ")"}
          </button>
          <button 
            onClick={() => setFilterStatus("pending")}
            style={{ 
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
            Pending {withinLimitSessions.filter(s => !s.isResolved).length > 0 && "(" + withinLimitSessions.filter(s => !s.isResolved).length + ")"}
          </button>
          <button 
            onClick={() => setFilterStatus("resolved")}
            style={{ 
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
            Resolved {withinLimitSessions.filter(s => s.isResolved).length > 0 && "(" + withinLimitSessions.filter(s => s.isResolved).length + ")"}
          </button>
          <button 
            onClick={() => setFilterStatus("requests")}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: filterStatus === "requests" ? 'none' : '1px solid #e5e7eb',
              background: filterStatus === "requests" ? '#7c3aed' : '#fff',
              color: filterStatus === "requests" ? '#fff' : '#6b7280',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Icons.Inbox />
            Requests {overLimitSessions.length > 0 && "(" + overLimitSessions.length + ")"}
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
            <div key={session.sessionId} onClick={() => loadChat(session)} style={{ position: 'relative', padding: '12px', borderRadius: '12px', cursor: 'pointer', marginBottom: '6px', background: activeSession?.sessionId === session.sessionId ? '#f0f9ff' : 'transparent', border: activeSession?.sessionId === session.sessionId ? '1px solid #bae6fd' : '1px solid transparent', transition: 'all 0.2s', opacity: session.shouldBlur ? 0.6 : 1 }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: session.shouldBlur ? '#fef3c7' : (activeSession?.sessionId === session.sessionId ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : (session.isOverLimit ? '#fef3c7' : '#f3f4f6')), display: 'flex', alignItems: 'center', justifyContent: 'center', color: session.shouldBlur ? '#92400e' : (activeSession?.sessionId === session.sessionId ? 'white' : (session.isOverLimit ? '#92400e' : '#9ca3af')), flexShrink: 0 }}>
                  {session.shouldBlur ? <Icons.EyeOff /> : (session.isOverLimit ? <Icons.Lock /> : <Icons.User size={20} />)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 2 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{session.email?.split('@')[0] || 'User'}</div>
                    {session.isResolved && (
                      <div style={{ background: '#10b981', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icons.Check />
                      </div>
                    )}
                    {session.shouldBlur && (
                      <div style={{ background: '#f59e0b', color: 'white', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                        EXPIRED
                      </div>
                    )}
                    {session.isOverLimit && !session.shouldBlur && (
                      <div style={{ background: '#f59e0b', color: 'white', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                        REQUEST
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.shouldBlur ? 'Chat history expired' : (session.messages[0]?.message || 'New Chat')}
                  </div>
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

      {/* CHAT AREA - Rest of the component remains the same */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '20px 32px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isActiveSessionOverLimit ? '#fef3c7' : '#fff' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontWeight: '700', fontSize: '18px', color: '#111827' }}>{activeSession.email}</h3>
                  {isActiveSessionOverLimit && (
                    <div style={{ background: '#f59e0b', color: 'white', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icons.Lock />
                      Over Limit
                    </div>
                  )}
                  {activeSession.isResolved && !isActiveSessionOverLimit && (
                    <div style={{ background: '#d1fae5', color: '#065f46', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icons.Check />
                      Resolved
                    </div>
                  )}
                </div>
                {isActiveSessionOverLimit && (
                  <div style={{ fontSize: '12px', color: '#92400e', marginTop: '4px', fontWeight: '500' }}>
                    This chat is over your plan limit. Upgrade to respond.
                  </div>
                )}
                {activeSession.resolvedAt && !isActiveSessionOverLimit && (
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Resolved on {new Date(activeSession.resolvedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              
              {!isActiveSessionOverLimit && !activeSession.isResolved && (
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
              )}
              
              {!isActiveSessionOverLimit && activeSession.isResolved && (
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

              {isActiveSessionOverLimit && (
                <button 
                  onClick={() => window.location.href = '/app/subscription'}
                  style={{ 
                    padding: '10px 18px', 
                    borderRadius: '10px', 
                    border: 'none', 
                    background: '#f59e0b',
                    color: '#fff',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Icons.TrendingUp />
                  Upgrade Plan
                </button>
              )}
            </div>

            <div ref={scrollRef} style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', background: '#f9fafb' }}>
              {messages.map((msg, i) => (
                <div key={msg.id || i} style={{ alignSelf: msg.sender === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '65%' }}>
                  <div style={{ padding: '12px 16px', borderRadius: '16px', background: msg.sender === 'admin' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : (msg.sender === 'bot' ? '#fef3c7' : '#fff'), color: msg.sender === 'admin' ? '#fff' : '#111827', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: msg.sender === 'admin' ? 'none' : (msg.sender === 'bot' ? '1px solid #fbbf24' : '1px solid #e5e7eb') }}>
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

            {filePreview && !isActiveSessionOverLimit && (
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

            {!isActiveSessionOverLimit ? (
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
            ) : (
              <div style={{ padding: '20px 32px', background: '#fef3c7', borderTop: '2px solid #fbbf24' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'white', borderRadius: '12px', border: '2px dashed #f59e0b' }}>
                  <Icons.Lock />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                      Chat Locked - Over Plan Limit
                    </div>
                    <div style={{ fontSize: '12px', color: '#92400e' }}>
                      Upgrade your plan to respond to this customer request
                    </div>
                  </div>
                  <button 
                    onClick={() => window.location.href = '/app/subscription'}
                    style={{ 
                      padding: '8px 16px', 
                      background: '#f59e0b', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      fontWeight: '600', 
                      fontSize: '12px', 
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Upgrade Now
                  </button>
                </div>
              </div>
            )}
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
        
        <div style={{ marginBottom: '16px', padding: '16px', background: planLimit.isOverLimit ? '#fef3c7' : (planLimit.isAtLimit ? '#fee2e2' : (planLimit.isNearLimit ? '#fef3c7' : '#eff6ff')), borderRadius: '12px', border: planLimit.isOverLimit ? '1px solid #fcd34d' : (planLimit.isAtLimit ? '1px solid #fca5a5' : (planLimit.isNearLimit ? '1px solid #fcd34d' : '1px solid #bfdbfe')) }}>
          <div style={{ fontSize: '10px', color: planLimit.isOverLimit ? '#92400e' : (planLimit.isAtLimit ? '#991b1b' : (planLimit.isNearLimit ? '#92400e' : '#1e40af')), fontWeight: '700', marginBottom: '8px', letterSpacing: '0.5px' }}>
            PLAN USAGE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Icons.TrendingUp />
            <span style={{ fontSize: '24px', fontWeight: '800', color: planLimit.isOverLimit ? '#92400e' : (planLimit.isAtLimit ? '#991b1b' : (planLimit.isNearLimit ? '#92400e' : '#1e40af')) }}>
              {planLimit.max > 0 ? withinLimitSessions.length + "/" + planLimit.max : sessions.length}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: planLimit.isOverLimit ? '#92400e' : (planLimit.isAtLimit ? '#991b1b' : (planLimit.isNearLimit ? '#92400e' : '#60a5fa')) }}>
            {planLimit.isOverLimit 
              ? planLimit.overLimitBy + " request" + (planLimit.overLimitBy !== 1 ? 's' : '') + " in queue"
              : planLimit.isAtLimit 
                ? 'At limit - upgrade to continue' 
                : planLimit.remaining + " chat" + (planLimit.remaining !== 1 ? 's' : '') + " remaining"}
          </div>
          {(planLimit.isAtLimit || planLimit.isOverLimit) && (
            <button 
              onClick={() => window.location.href = '/app/subscription'}
              style={{ 
                marginTop: '12px', 
                padding: '8px 12px', 
                background: planLimit.isOverLimit ? '#f59e0b' : '#dc2626', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontWeight: '600', 
                fontSize: '12px', 
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Upgrade Now
            </button>
          )}
        </div>

        {activeSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', background: activeSession.isResolved ? '#d1fae5' : (isActiveSessionOverLimit ? '#fee2e2' : '#fef3c7'), borderRadius: '12px', border: activeSession.isResolved ? '1px solid #86efac' : (isActiveSessionOverLimit ? '1px solid #fca5a5' : '1px solid #fcd34d') }}>
              <div style={{ fontSize: '10px', color: activeSession.isResolved ? '#065f46' : (isActiveSessionOverLimit ? '#991b1b' : '#92400e'), fontWeight: '700', marginBottom: '8px', letterSpacing: '0.5px' }}>
                STATUS
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '15px', color: activeSession.isResolved ? '#065f46' : (isActiveSessionOverLimit ? '#991b1b' : '#92400e') }}>
                {activeSession.isResolved ? <Icons.CheckCircle /> : (isActiveSessionOverLimit ? <Icons.Lock /> : <Icons.AlertCircle />)}
                {activeSession.isResolved ? 'Resolved' : (isActiveSessionOverLimit ? 'Over Limit' : 'Pending')}
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
        ::-webkit-scrollbar-track { background: '#f3f4f6'; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>
    </div>
  );
}