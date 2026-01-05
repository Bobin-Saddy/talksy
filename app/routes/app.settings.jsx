import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { useState, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const ICON_MAP = {
  bubble: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  send: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  custom: <img src="https://alert-lime-e4qtqvlkob.edgeone.app/icon-frame.png" alt="custom" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
};

const FONT_OPTIONS = [
  { label: "System Default", value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "monospace", value: "ui-monospace, SFMono-Regular, monospace" }
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.chatSettings.findUnique({ where: { shop: session.shop } });
  
  const defaults = {
    primaryColor: "#4F46E5",
    headerBgColor: "#384959",
    heroBgColor: "#bdddfc",
    headerTextColor: "#bdddfc",
    heroTextColor: "#384959",
    cardTitleColor: "#384959",
    cardSubtitleColor: "#64748b",
    onboardingTextColor: "#384959",
    welcomeImg: "https://ui-avatars.com/api/?name=Support&background=fff&color=4F46E5",
    headerTitle: "Live Support",
    headerSubtitle: "Online now",
    welcomeText: "Hi there 👋",
    welcomeSubtext: "We are here to help you! Ask us anything.",
    replyTimeText: "Typically replies in 5 minutes",
    startConversationText: "Send us a message",
    onboardingTitle: "Start a conversation",
    onboardingSubtitle: "Please provide your details to begin.",
    launcherIcon: "custom",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    baseFontSize: "15px"
  };

  return json(settings ? { ...defaults, ...settings } : defaults);
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  data.shop = session.shop;
  
  await prisma.chatSettings.upsert({
    where: { shop: session.shop },
    update: data,
    create: data,
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

  useEffect(() => { if (settings) setFormState(settings); }, [settings]);
  useEffect(() => { 
    if (actionData?.success) { 
      setToast(true); 
      setTimeout(() => setToast(false), 3000); 
    } 
  }, [actionData]);

  const handleChange = (f, v) => setFormState(p => ({ ...p, [f]: v }));
  
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => handleChange('welcomeImg', reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const formData = new FormData();
    Object.entries(formState).forEach(([key, value]) => formData.append(key, value));
    submit(formData, { method: "POST" });
  };

  // Helper to get tab details
  const getTabHeader = () => {
    switch(activeTab) {
        case 'style': return { title: "Appearance", icon: "🎨", subtitle: "Design your chat widget's visual identity." };
        case 'content': return { title: "Translations", icon: "🌐", subtitle: "Customize text and languages for your customers." };
        case 'typography': return { title: "Typography", icon: "Aa", subtitle: "Manage fonts and readability settings." };
        default: return { title: "Settings", icon: "⚙️", subtitle: "" };
    }
  };

  const tabHeader = getTabHeader();

  return (
    <div style={{ background: '#F3F4F6', minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif' }}>
      
      {/* SIDEBAR NAVIGATION */}
      <div style={{ width: '100px', background: '#FFF', borderRight: '1px solid #E5E7EB', padding: '30px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'sticky', top: 0, height: '100vh' }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <NavIcon active={activeTab === 'style'} onClick={() => setActiveTab('style')} icon="🎨" title="Style" />
          <NavIcon active={activeTab === 'content'} onClick={() => setActiveTab('content')} icon="🌐" title="Content" />
          <NavIcon active={activeTab === 'typography'} onClick={() => setActiveTab('typography')} icon="Aa" title="Fonts" />
        </nav>
      </div>

      {/* CONFIGURATION AREA */}
      <div style={{ flex: 1, padding: '40px 60px', overflowY: 'auto' }}>
        
        {/* DYNAMIC BIG TEXT HEADER */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div style={{ animation: 'fadeInDown 0.4s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px' }}>
                <span style={{ fontSize: '40px' }}>{tabHeader.icon}</span>
                <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#111827', margin: 0, letterSpacing: '-1px' }}>
                    {tabHeader.title}
                </h1>
            </div>
            <p style={{ color: '#6B7280', fontSize: '16px', margin: 0 }}>{tabHeader.subtitle}</p>
          </div>
          
          <button onClick={handleSave} style={{ padding: '14px 32px', background: '#111827', color: '#FFF', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', border: 'none', transition: '0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {navigation.state === "submitting" ? "Syncing..." : "Save & Publish"}
          </button>
        </header>

        {activeTab === 'style' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card title="Launcher Icon">
              <div style={{ display: 'flex', gap: '12px' }}>
                {Object.keys(ICON_MAP).map(key => (
                  <IconButton key={key} active={formState.launcherIcon === key} onClick={() => handleChange('launcherIcon', key)}>
                    {ICON_MAP[key]}
                  </IconButton>
                ))}
              </div>
            </Card>

            <Card title="Brand Assets">
               <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>Support Avatar</label>
               <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                 <img src={formState.welcomeImg} style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'cover', border: '1px solid #E5E7EB' }} alt="Avatar" />
                 <button onClick={() => fileInputRef.current.click()} style={{ padding: '10px 18px', background: '#FFF', border: '1px solid #D1D5DB', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Change Image</button>
                 <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                <ColorBox label="Primary Color" value={formState.primaryColor} onChange={(v) => handleChange('primaryColor', v)} />
                <ColorBox label="Header BG" value={formState.headerBgColor} onChange={(v) => handleChange('headerBgColor', v)} />
                <ColorBox label="Banner BG" value={formState.heroBgColor} onChange={(v) => handleChange('heroBgColor', v)} />
              </div>
            </Card>

            <Card title="UI Text Colors">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <ColorBox label="Header Text" value={formState.headerTextColor} onChange={(v) => handleChange('headerTextColor', v)} />
                <ColorBox label="Banner Text" value={formState.heroTextColor} onChange={(v) => handleChange('heroTextColor', v)} />
                <ColorBox label="Card Title" value={formState.cardTitleColor} onChange={(v) => handleChange('cardTitleColor', v)} />
                <ColorBox label="Card Subtitle" value={formState.cardSubtitleColor} onChange={(v) => handleChange('cardSubtitleColor', v)} />
                <ColorBox label="Onboarding Text" value={formState.onboardingTextColor} onChange={(v) => handleChange('onboardingTextColor', v)} />
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'typography' && (
          <Card title="Font Configuration">
              <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>Select Font Family</label>
              <select value={formState.fontFamily} onChange={(e) => handleChange('fontFamily', e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '15px', background: '#FFF' }}>
                {FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}
              </select>
              <div style={{ marginTop: '30px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '15px' }}>Base Size: <span style={{ color: '#4F46E5', fontWeight: '800' }}>{formState.baseFontSize}</span></label>
                <input type="range" min="12" max="22" value={parseInt(formState.baseFontSize)} onChange={(e) => handleChange('baseFontSize', `${e.target.value}px`)} style={{ width: '100%', cursor: 'pointer', accentColor: '#4F46E5' }} />
              </div>
          </Card>
        )}

        {activeTab === 'content' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card title="Header & Banner Content">
               <Field label="Header Title" value={formState.headerTitle} onChange={(v) => handleChange('headerTitle', v)} />
               <Field label="Header Subtitle" value={formState.headerSubtitle} onChange={(v) => handleChange('headerSubtitle', v)} />
               <Field label="Hero Title" value={formState.welcomeText} onChange={(v) => handleChange('welcomeText', v)} />
               <AreaField label="Hero Subtext" value={formState.welcomeSubtext} onChange={(v) => handleChange('welcomeSubtext', v)} />
            </Card>
            <Card title="Messaging & Onboarding">
               <Field label="Action Button Text" value={formState.startConversationText} onChange={(v) => handleChange('startConversationText', v)} />
               <Field label="Expected Reply Time" value={formState.replyTimeText} onChange={(v) => handleChange('replyTimeText', v)} />
               <Field label="Registration Title" value={formState.onboardingTitle} onChange={(v) => handleChange('onboardingTitle', v)} />
               <AreaField label="Registration Subtext" value={formState.onboardingSubtitle} onChange={(v) => handleChange('onboardingSubtitle', v)} />
            </Card>
          </div>
        )}
      </div>

      {/* LIVE PREVIEW SECTION */}
      <div style={{ width: '480px', padding: '40px', background: '#F9FAFB', borderLeft: '1px solid #E5E7EB', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ marginBottom: '20px', fontSize: '12px', fontWeight: '900', color: '#9CA3AF', letterSpacing: '2px' }}>LIVE PREVIEW</div>
          
          <div style={{ width: '370px', height: '640px', background: '#FFF', borderRadius: '32px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.05)', fontFamily: formState.fontFamily }}>
            {/* Widget Header */}
            <div style={{ background: formState.headerBgColor, padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={formState.welcomeImg} style={{ width: '42px', height: '42px', borderRadius: '14px', objectFit: 'cover' }} alt="avatar" />
                <div>
                    <div style={{ fontWeight: '700', color: formState.headerTextColor, fontSize: formState.baseFontSize }}>{formState.headerTitle}</div>
                    <div style={{ fontSize: '12px', color: formState.headerTextColor, opacity: 0.8 }}>{formState.headerSubtitle}</div>
                </div>
            </div>

            <div style={{ flex: 1, background: '#f8fafc', overflowY: 'auto' }}>
                <div style={{ background: formState.heroBgColor, padding: '45px 25px', color: formState.heroTextColor }}>
                    <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 10px 0', lineHeight: 1.2 }}>{formState.welcomeText}</h1>
                    <p style={{ fontSize: formState.baseFontSize, opacity: 0.9, lineHeight: 1.5 }}>{formState.welcomeSubtext}</p>
                </div>
                
                <div style={{ background: '#FFF', margin: '-35px 20px 20px', padding: '20px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: `1px solid #f1f5f9` }}>
                    <div style={{ fontWeight: '700', color: formState.cardTitleColor, marginBottom: '4px' }}>{formState.startConversationText}</div>
                    <div style={{ fontSize: '12px', color: formState.cardSubtitleColor }}>{formState.replyTimeText}</div>
                </div>

                <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: formState.onboardingTextColor, marginBottom: '8px' }}>{formState.onboardingTitle}</h3>
                    <p style={{ fontSize: '14px', color: formState.onboardingTextColor, opacity: 0.7, lineHeight: 1.4 }}>{formState.onboardingSubtitle}</p>
                </div>
            </div>
          </div>

          <div style={{ marginTop: '25px', width: '64px', height: '64px', borderRadius: '50%', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
            {ICON_MAP[formState.launcherIcon]}
          </div>
      </div>

      {toast && <Toast message="Settings Saved Successfully!" />}

      <style>{`
        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// Sub-components
const NavIcon = ({ active, icon, title, onClick }) => (
    <div onClick={onClick} style={{ textAlign: 'center', cursor: 'pointer', transition: '0.2s', marginBottom: '20px' }}>
        <div style={{ fontSize: '26px', background: active ? '#F3F4F6' : 'transparent', color: active ? '#111827' : '#9CA3AF', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', transition: 'all 0.3s' }}>{icon}</div>
        <div style={{ fontSize: '11px', fontWeight: '800', marginTop: '6px', color: active ? '#111827' : '#9CA3AF' }}>{title}</div>
    </div>
);

const Card = ({ title, children }) => (
    <div style={{ background: '#FFF', padding: '30px', borderRadius: '20px', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <h3 style={{ fontSize: '12px', fontWeight: '900', color: '#9CA3AF', marginBottom: '25px', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</h3>
      {children}
    </div>
);

const IconButton = ({ children, active, onClick }) => (
    <div onClick={onClick} style={{ width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: active ? '3px solid #4F46E5' : '1.5px solid #E5E7EB', background: active ? '#EEF2FF' : '#FFF', transition: '0.2s' }}>
      {children}
    </div>
);

const ColorBox = ({ label, value, onChange }) => (
    <div style={{ flex: 1 }}>
      <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '10px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#F9FAFB', padding: '10px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ border: 'none', background: 'none', width: '28px', height: '28px', cursor: 'pointer', padding: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: '800', color: '#374151' }}>{value?.toUpperCase()}</span>
      </div>
    </div>
);

const Field = ({ label, value, onChange }) => (
  <div style={{ marginBottom: '20px' }}>
    <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '10px' }}>{label}</label>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '15px', color: '#111827' }} />
  </div>
);

const AreaField = ({ label, value, onChange }) => (
  <div style={{ marginBottom: '20px' }}>
    <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '10px' }}>{label}</label>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '15px', color: '#111827', minHeight: '80px', resize: 'none', lineHeight: 1.5 }} />
  </div>
);

const Toast = ({ message }) => (
    <div style={{ position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#FFF', padding: '16px 32px', borderRadius: '50px', fontWeight: '700', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', animation: 'fadeInUp 0.3s ease-out' }}>
      ✅ {message}
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </div>
);