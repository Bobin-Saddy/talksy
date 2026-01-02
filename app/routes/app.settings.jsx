import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// 1. Updated Icon Map with your specific SVG Design
const ICON_MAP = {
  bubble: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  send: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  custom: (
    <svg width="24" height="24" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="601" cy="601" r="389" stroke="#FFC700" strokeWidth="40"/>
      <rect x="525" y="353" width="138" height="119" fill="#FFDE43"/>
    </svg>
  )
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.chatSettings.findUnique({ where: { shop: session.shop } });
  
  const defaults = {
    primaryColor: "#4F46E5",
    headerBgColor: "#384959",
    heroBgColor: "#bdddfc",
    headerTextColor: "#bdddfc",
    heroTextColor: "#384959",
    launcherIcon: "custom", // Ensuring default is 'custom'
    welcomeImg: "https://ui-avatars.com/api/?name=Support&background=fff&color=4F46E5",
    headerTitle: "Live Support",
    welcomeText: "Hi there 👋",
    welcomeSubtext: "How can we help you today?",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    baseFontSize: "15px"
  };

  return json(settings ? { ...defaults, ...settings } : defaults);
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  
  await prisma.chatSettings.upsert({
    where: { shop: session.shop },
    update: { ...data, shop: session.shop },
    create: { ...data, shop: session.shop },
  });
  return json({ success: true });
};

export default function UltimateSettings() {
  const settings = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [formState, setFormState] = useState(settings);
  const [activeTab, setActiveTab] = useState('style');
  const [toast, setToast] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { 
    if (actionData?.success) { 
      setToast(true); 
      setTimeout(() => setToast(false), 3000); 
    } 
  }, [actionData]);

  const handleChange = (field, value) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };
  
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => handleChange('welcomeImg', reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    // Sending the current state to the action
    submit(formState, { method: "POST" });
  };

  return (
    <div style={{ background: '#F3F4F6', minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif' }}>
      
      {/* SIDEBAR NAVIGATION */}
      <div style={{ width: '260px', background: '#FFFFFF', borderRight: '1px solid #E5E7EB', padding: '30px 20px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <div style={{ width: '35px', height: '35px', background: 'linear-gradient(135deg, #FFC700, #4F46E5)', borderRadius: '10px' }}></div>
          <span style={{ fontWeight: '800', fontSize: '18px' }}>Talksy</span>
        </div>
        
        <nav style={{ flex: 1 }}>
          <NavButton active={activeTab === 'style'} onClick={() => setActiveTab('style')} label="Appearance" icon="🎨" />
          <NavButton active={activeTab === 'content'} onClick={() => setActiveTab('content')} label="Content" icon="🌐" />
        </nav>
      </div>

      {/* MAIN CONFIGURATION */}
      <div style={{ flex: 1, padding: '40px 50px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800' }}>Settings</h1>
          <button 
            onClick={handleSave} 
            style={{ padding: '12px 28px', background: '#111827', color: '#FFF', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', border: 'none' }}
          >
            {navigation.state === "submitting" ? "Syncing..." : "Save Settings"}
          </button>
        </header>

        {activeTab === 'style' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card title="Launcher Icon">
              <div style={{ display: 'flex', gap: '12px' }}>
                {Object.keys(ICON_MAP).map(key => (
                  <IconButton 
                    key={key} 
                    active={formState.launcherIcon === key} 
                    onClick={() => handleChange('launcherIcon', key)}
                  >
                    {ICON_MAP[key]}
                  </IconButton>
                ))}
              </div>
            </Card>

            <Card title="Brand Colors">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <ColorBox label="Primary Color" value={formState.primaryColor} onChange={(v) => handleChange('primaryColor', v)} />
                <ColorBox label="Header Background" value={formState.headerBgColor} onChange={(v) => handleChange('headerBgColor', v)} />
              </div>
            </Card>

            <Card title="Support Avatar">
               <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                 <img src={formState.welcomeImg} style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #E5E7EB' }} alt="Avatar" />
                 <button onClick={() => fileInputRef.current.click()} style={{ padding: '8px 16px', background: '#FFF', border: '1px solid #D1D5DB', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Upload Image</button>
                 <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
               </div>
            </Card>
          </div>
        )}

        {activeTab === 'content' && (
          <Card title="Widget Text">
             <Field label="Header Title" value={formState.headerTitle} onChange={(v) => handleChange('headerTitle', v)} />
             <Field label="Hero Title" value={formState.welcomeText} onChange={(v) => handleChange('welcomeText', v)} />
          </Card>
        )}
      </div>

      {/* LIVE PREVIEW */}
      <div style={{ width: '400px', padding: '40px', background: '#F9FAFB', borderLeft: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: '20px', fontSize: '12px', fontWeight: '800', color: '#9CA3AF' }}>PREVIEW</div>
          <div style={{ width: '320px', height: '520px', background: '#FFF', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', position: 'relative' }}>
            <div style={{ background: formState.headerBgColor, padding: '20px', color: formState.headerTextColor }}>
                <div style={{ fontWeight: '700' }}>{formState.headerTitle}</div>
            </div>
            <div style={{ padding: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '700' }}>{formState.welcomeText}</h2>
                <p style={{ color: '#64748b' }}>{formState.welcomeSubtext}</p>
            </div>
          </div>
          <div style={{ 
            marginTop: '20px', 
            width: '60px', 
            height: '60px', 
            borderRadius: '50%', 
            background: formState.primaryColor, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
          }}>
            {ICON_MAP[formState.launcherIcon]}
          </div>
      </div>

      {toast && <Toast message="Settings Saved Successfully!" />}
    </div>
  );
}

// Utility Components
const NavButton = ({ active, label, icon, onClick }) => (
    <div onClick={onClick} style={{ padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', background: active ? '#EEF2FF' : 'transparent', color: active ? '#4F46E5' : '#4B5563', fontWeight: active ? '700' : '500', display: 'flex', gap: '12px', marginBottom: '5px' }}>
      <span style={{ fontSize: '18px' }}>{icon}</span> {label}
    </div>
);

const Card = ({ title, children }) => (
    <div style={{ background: '#FFF', padding: '24px', borderRadius: '16px', border: '1px solid #E5E7EB', marginBottom: '20px' }}>
      <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#9CA3AF', marginBottom: '20px', textTransform: 'uppercase' }}>{title}</h3>
      {children}
    </div>
);

const IconButton = ({ children, active, onClick }) => (
    <div onClick={onClick} style={{ width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: active ? '2px solid #4F46E5' : '1px solid #E5E7EB', background: active ? '#EEF2FF' : '#FFF', color: active ? '#4F46E5' : '#6B7280' }}>
      {children}
    </div>
);

const ColorBox = ({ label, value, onChange }) => (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>{label}</label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', height: '40px', border: '1px solid #E5E7EB', borderRadius: '8px', cursor: 'pointer' }} />
    </div>
);

const Field = ({ label, value, onChange }) => (
  <div style={{ marginBottom: '15px' }}>
    <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>{label}</label>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '14px' }} />
  </div>
);

const Toast = ({ message }) => (
    <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#FFF', padding: '12px 24px', borderRadius: '50px', fontWeight: '600', zIndex: 9999 }}>
      {message}
    </div>
);