// ============================================================
// ADMIN PANEL — Firebase Push Notification Registration
// Yeh code apne admin.jsx mein add karo
//
// Pehle run karo:  npm install firebase
// ============================================================

// ── STEP 1: Yeh imports admin.jsx ke TOP mein add karo ──────
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ── STEP 2: Component ke BAHAR (module level) add karo ───────
const FIREBASE_CONFIG = {
  apiKey           : "AIzaSyAkp3v6YWY4HexFQ7Z0BYPGMeG18IXXqWg",
  authDomain       : "shopify-talksy.firebaseapp.com",
  projectId        : "shopify-talksy",
  storageBucket    : "shopify-talksy.firebasestorage.app",
  messagingSenderId: "547076667229",
  appId            : "1:547076667229:web:e65ed249fe33f7724e9ab4"
};
const FIREBASE_VAPID_KEY = "BJzrkyA1gwJTL7auMx6y0RHjv34mSPzm6FpY5twRsMuuE54l0nL4cl4UUltGcgqO5cNGcJjWEugjyZFkkfTI1AE";
const BACKEND_URL        = "https://talksy-production-5d43.up.railway.app";

// ── STEP 3: NeuralChatAdmin component mein yeh state add karo ─
const [adminToast, setAdminToast] = useState(null);

// ── STEP 4: Existing useEffect hooks ke baad yeh add karo ────
useEffect(() => {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

  async function setupAdminPush() {
    try {
      const app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
      const msg = getMessaging(app);

      // SW register karo — public/firebase-messaging-sw.js mein rakho
      let swReg;
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        console.log('✅ Admin SW registered');
      } catch (e) {
        console.warn('Admin SW failed:', e);
      }

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { console.log('Admin notification permission denied'); return; }

      const opts = { vapidKey: FIREBASE_VAPID_KEY };
      if (swReg) opts.serviceWorkerRegistration = swReg;
      const token = await getToken(msg, opts);

      if (!token) { console.warn('Could not get admin FCM token'); return; }
      console.log('✅ Admin FCM token:', token.substring(0, 20) + '...');

      // Backend mein register karo
      await fetch(`${BACKEND_URL}/app/admin/register-fcm-token`, {
        method     : 'POST',
        headers    : { 'Content-Type': 'application/json' },
        credentials: 'include',
        body       : JSON.stringify({
          shop     : currentShop,
          fcmToken : token,
          registeredAt: new Date().toISOString()
        })
      });
      console.log('✅ Admin token backend mein save ho gaya');

      // Foreground messages (jab admin panel open ho)
      onMessage(msg, payload => {
        console.log('🔔 Admin ko message mila:', payload);
        if (audioRef.current) audioRef.current.play().catch(() => {});
        if (document.hidden) {
          new Notification(payload.notification?.title || '💬 New Message', {
            body: payload.notification?.body || 'Customer sent a message',
            icon: '/favicon.ico'
          });
        } else {
          // In-app toast dikhao
          setAdminToast({
            title    : payload.notification?.title || '💬 New Message',
            body     : payload.notification?.body  || 'Customer sent a message',
            sessionId: payload.data?.sessionId,
            id       : Date.now()
          });
          setTimeout(() => setAdminToast(null), 5000);
        }
      });

    } catch (err) {
      console.error('Admin push setup failed:', err);
    }
  }

  setupAdminPush();
}, [currentShop]);

// ── STEP 5: Admin.jsx return() ke andar add karo (last div se pehle) ──
{adminToast && (
  <div
    onClick={() => {
      if (adminToast.sessionId) {
        const s = sessions.find(s => s.sessionId === adminToast.sessionId);
        if (s) loadChat(s);
      }
      setAdminToast(null);
    }}
    style={{
      position        : 'fixed',
      bottom          : '32px',
      right           : '32px',
      zIndex          : 99999,
      background      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      color           : 'white',
      borderRadius    : '16px',
      padding         : '16px 20px',
      maxWidth        : '340px',
      boxShadow       : '0 8px 32px rgba(99, 102, 241, 0.4)',
      display         : 'flex',
      alignItems      : 'flex-start',
      gap             : '12px',
      cursor          : adminToast.sessionId ? 'pointer' : 'default',
      animation       : 'slideInRight 0.3s ease'
    }}
  >
    <div style={{ width:'40px', height:'40px', background:'rgba(255,255,255,0.2)', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'20px' }}>
      💬
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight:'700', fontSize:'14px', marginBottom:'4px' }}>{adminToast.title}</div>
      <div style={{ fontSize:'13px', opacity:0.9, lineHeight:'1.4' }}>{adminToast.body}</div>
      {adminToast.sessionId && <div style={{ fontSize:'11px', opacity:0.7, marginTop:'6px' }}>Click to open chat →</div>}
    </div>
    <button
      onClick={e => { e.stopPropagation(); setAdminToast(null); }}
      style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', width:'24px', height:'24px', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'14px', fontWeight:'700' }}
    >×</button>
  </div>
)}

// ── STEP 6: admin.jsx ke <style> tag mein yeh animation add karo ──
`
@keyframes slideInRight {
  from { transform: translateX(120%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
`

// ── STEP 7: public/firebase-messaging-sw.js create karo ──────
// Remix app ke public/ folder mein firebase-messaging-sw.js rakho
// (same file jo Shopify assets mein upload ki hai wahi use karo)