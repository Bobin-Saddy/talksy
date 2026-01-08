import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { useState, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const ICON_MAP = (customImg) => ({
  bubble: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  send: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  defaultCustom: <img src="https://alert-lime-e4qtqvlkob.edgeone.app/icon-frame.png" alt="custom" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />,
  custom: customImg ? <img src={customImg} alt="User upload" style={{ width: '100%', height: '100%', borderRadius: '4px', objectFit: 'cover' }} /> : <span style={{ fontSize: '20px' }}>+</span>
});

const FONT_OPTIONS = [
  { label: "Euclid Circular", value: "'Euclid Circular', sans-serif" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Monospace", value: "ui-monospace, SFMono-Regular, monospace" },
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.chatSettings.findUnique({ where: { shop: session.shop } });
  
  const defaults = {
    primaryColor: "#FFD600",
    headerBgColor: "#FFFFFF",
    heroBgColor: "#FFFFFF",
    headerTextColor: "#111827",
    heroTextColor: "#111827",
    cardTitleColor: "#384959",
    cardSubtitleColor: "#64748b",
    onboardingTextColor: "#384959",
    chatBoxBgColor: "#FFFFFF",
    messageBgColor: "#FFFFFF",
    widgetBorderColor: "#F3F4F6", 
    welcomeImg: "https://ui-avatars.com/api/?name=Support&background=FFD600&color=fff",
    headerTitle: "Live Support",
    headerSubtitle: "Online now",
    welcomeText: "Hi there 👋",
    welcomeSubtext: "We are here to help you! Ask us anything.",
    replyTimeText: "Typically replies in 5 minutes",
    startConversationText: "Send us a message",
    onboardingTitle: "Start a conversation",
    onboardingSubtitle: "Please provide your details to begin.",
    launcherIcon: "bubble",
    customLauncherImg: "", 
    fontFamily: "'Euclid Circular', sans-serif",
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
    update: data,
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
  
  const avatarRef = useRef(null);
  const launcherRef = useRef(null);

  useEffect(() => { if (settings) setFormState(settings); }, [settings]);
  useEffect(() => { 
    if (actionData?.success) { 
      setToast(true); 
      setTimeout(() => setToast(false), 3000); 
    } 
  }, [actionData]);

  const handleChange = (f, v) => setFormState(p => ({ ...p, [f]: v }));
  
  const handleSave = () => {
    const formData = new FormData();
    Object.entries(formState).forEach(([key, value]) => {
      if (!['id', 'shop', 'createdAt', 'updatedAt'].includes(key)) {
        formData.append(key, value);
      }
    });
    submit(formData, { method: "POST" });
  };

  const icons = ICON_MAP(formState.customLauncherImg);

  return (
    <div style={{ background: '#F3F4F6', minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif' }}>
      
      {/* SIDE NAV */}
      <div style={{ width: '100px', background: '#F3F4F6', borderRight: '1px solid #E5E7EB', padding: '30px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'sticky', top: 0, height: '100vh' }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <NavIcon active={activeTab === 'style'} onClick={() => setActiveTab('style')} icon="🎨" title="Style" />
          <NavIcon active={activeTab === 'content'} onClick={() => setActiveTab('content')} icon="🌐" title="Content" />
          <NavIcon active={activeTab === 'typography'} onClick={() => setActiveTab('typography')} icon="Aa" title="Fonts" />
        </nav>
      </div>

      {/* MAIN CONFIG */}
      <div style={{ flex: 1, padding: '40px 50px', maxWidth: '750px', overflowY: 'auto', height: '100vh' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
            {activeTab === 'style' && 'Appearance Settings'}
            {activeTab === 'content' && 'Widget Content'}
            {activeTab === 'typography' && 'Typography'}
          </h1>
          <button onClick={handleSave} style={{ padding: '10px 24px', background: '#111827', color: '#FFF', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>
            {navigation.state === "submitting" ? "Syncing..." : "Save & Publish"}
          </button>
        </header>

        {activeTab === 'style' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card title="Colors & Theming">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <ColorBox label="Primary Action Color" value={formState.primaryColor} onChange={(v) => handleChange('primaryColor', v)} />
                <ColorBox label="Widget Border Color" value={formState.widgetBorderColor} onChange={(v) => handleChange('widgetBorderColor', v)} />
                <ColorBox label="Chat Window BG" value={formState.chatBoxBgColor} onChange={(v) => handleChange('chatBoxBgColor', v)} />
                <ColorBox label="Message Bubble BG" value={formState.messageBgColor} onChange={(v) => handleChange('messageBgColor', v)} />
                <ColorBox label="Header BG Color" value={formState.headerBgColor} onChange={(v) => handleChange('headerBgColor', v)} />
                <ColorBox label="Hero BG Color" value={formState.heroBgColor} onChange={(v) => handleChange('heroBgColor', v)} />
              </div>
            </Card>

            <Card title="Launcher & Branding">
               <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#6B7280' }}>Support Avatar</label>
               <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                 <img src={formState.welcomeImg} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #EEE' }} alt="Avatar" />
                 <button onClick={() => avatarRef.current.click()} style={{ fontSize: '12px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #DDD', background: '#FFF', cursor: 'pointer' }}>Upload New</button>
                 <input type="file" ref={avatarRef} style={{ display: 'none' }} onChange={(e) => {
                    const reader = new FileReader();
                    reader.onload = () => handleChange('welcomeImg', reader.result);
                    reader.readAsDataURL(e.target.files[0]);
                 }} />
               </div>
               <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#6B7280' }}>Launcher Icon</label>
               <div style={{ display: 'flex', gap: '10px' }}>
                  {['bubble', 'send'].map(key => (
                    <IconButton key={key} active={formState.launcherIcon === key} onClick={() => handleChange('launcherIcon', key)}>
                      {icons[key]}
                    </IconButton>
                  ))}
               </div>
            </Card>
          </div>
        )}

        {activeTab === 'content' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card title="Hero & Header Text">
               <Field label="Header Title" value={formState.headerTitle} onChange={(v) => handleChange('headerTitle', v)} />
               <Field label="Header Subtitle" value={formState.headerSubtitle} onChange={(v) => handleChange('headerSubtitle', v)} />
               <Field label="Main Welcome Title" value={formState.welcomeText} onChange={(v) => handleChange('welcomeText', v)} />
               <AreaField label="Hero Description" value={formState.welcomeSubtext} onChange={(v) => handleChange('welcomeSubtext', v)} />
            </Card>
            <Card title="Action Card & Onboarding">
               <Field label="Card Action Text" value={formState.startConversationText} onChange={(v) => handleChange('startConversationText', v)} />
               <Field label="Response Time Text" value={formState.replyTimeText} onChange={(v) => handleChange('replyTimeText', v)} />
               <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid #F3F4F6' }} />
               <Field label="Onboarding Title" value={formState.onboardingTitle} onChange={(v) => handleChange('onboardingTitle', v)} />
               <AreaField label="Onboarding Subtitle" value={formState.onboardingSubtitle} onChange={(v) => handleChange('onboardingSubtitle', v)} />
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginTop: '10px' }}>
                <ColorBox label="Onboarding Text Color" value={formState.onboardingTextColor} onChange={(v) => handleChange('onboardingTextColor', v)} />
                <ColorBox label="Card Title Color" value={formState.cardTitleColor} onChange={(v) => handleChange('cardTitleColor', v)} />
               </div>
            </Card>
          </div>
        )}

        {activeTab === 'typography' && (
          <Card title="Font Styles">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#6B7280' }}>Font Family</label>
              <select value={formState.fontFamily} onChange={(e) => handleChange('fontFamily', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #DDD', fontSize: '14px' }}>
                {FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}
              </select>
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#6B7280' }}>Base Font Size: {formState.baseFontSize}</label>
                <input type="range" min="12" max="20" value={parseInt(formState.baseFontSize)} onChange={(e) => handleChange('baseFontSize', `${e.target.value}px`)} style={{ width: '100%', accentColor: '#111827' }} />
              </div>
          </Card>
        )}
      </div>

      {/* PREVIEW PANEL - SYNCED WITH YOUR SCREENSHOT */}
      <div style={{ flex: 1, background: '#F9FAFB', borderLeft: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'sticky', top: 0, height: '100vh' }}>
          <div style={{ marginBottom: '15px', fontSize: '11px', fontWeight: '800', color: '#9CA3AF', letterSpacing: '2px' }}>WIDGET PREVIEW</div>
          
          <div style={{ 
            width: '370px', 
            height: '650px', 
            background: formState.chatBoxBgColor, 
            borderRadius: '32px', 
            display: 'flex', 
            flexDirection: 'column', 
            boxShadow: '0 30px 60px -12px rgba(0,0,0,0.15)', 
            border: `1px solid ${formState.widgetBorderColor}`, 
            fontFamily: formState.fontFamily,
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ background: formState.headerBgColor, padding: '25px 25px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <img src={formState.welcomeImg} style={{ width: '36px', height: '36px', borderRadius: '50%', background: formState.primaryColor }} alt="avatar" />
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '9px', height: '9px', background: '#4ADE80', borderRadius: '50%', border: '2px solid #FFF' }}></div>
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '17px', color: formState.headerTextColor }}>{formState.headerTitle}</div>
                </div>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
            </div>

            {/* Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', textAlign: 'center' }}>
                {/* Hero Section */}
                <div style={{ background: formState.heroBgColor, padding: '40px 30px 30px', color: formState.heroTextColor }}>
                    <h1 style={{ fontSize: '30px', fontWeight: '800', marginBottom: '10px' }}>{formState.welcomeText}</h1>
                    <p style={{ fontSize: formState.baseFontSize, color: '#4B5563', lineHeight: '1.5', opacity: 0.9 }}>{formState.welcomeSubtext}</p>
                </div>
                
                {/* Action Card */}
                <div style={{ 
                    background: formState.messageBgColor, 
                    margin: '0 25px 40px', 
                    padding: '25px', 
                    borderRadius: '24px', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.04)', 
                    border: `1px solid ${formState.widgetBorderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left'
                }}>
                    <div>
                        <div style={{ fontWeight: '700', color: formState.cardTitleColor, fontSize: '16px', marginBottom: '4px' }}>{formState.startConversationText}</div>
                        <div style={{ fontSize: '13px', color: formState.cardSubtitleColor }}>{formState.replyTimeText}</div>
                    </div>
                    <div style={{ width: '42px', height: '42px', background: formState.primaryColor, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3.5"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                </div>

                {/* Onboarding Section */}
                <div style={{ padding: '0 40px' }}>
                    <div style={{ fontWeight: '700', color: formState.onboardingTextColor, fontSize: '20px', marginBottom: '8px' }}>{formState.onboardingTitle}</div>
                    <div style={{ fontSize: '14px', color: formState.onboardingTextColor, opacity: 0.7 }}>{formState.onboardingSubtitle}</div>
                </div>
            </div>

            {/* Bottom Navigation */}
            <div style={{ height: '85px', borderTop: `1px solid ${formState.widgetBorderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingBottom: '10px', background: '#FFF' }}>
                <div style={{ textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ color: formState.primaryColor, marginBottom: '4px' }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: formState.primaryColor }}>Home</div>
                </div>
                <div style={{ textAlign: 'center', opacity: 0.3 }}>
                    <div style={{ color: '#9CA3AF', marginBottom: '4px' }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '800' }}>Messages</div>
                </div>
            </div>
          </div>
      </div>

      {toast && <Toast message="Design Saved Successfully!" />}
    </div>
  );
}

// REUSABLE COMPONENTS
const NavIcon = ({ active, icon, title, onClick }) => (
    <div onClick={onClick} style={{ textAlign: 'center', cursor: 'pointer', marginBottom: '25px' }}>
        <div style={{ fontSize: '22px', background: active ? '#FFF' : 'transparent', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '14px', border: active ? '1px solid #E5E7EB' : '1px solid transparent', boxShadow: active ? '0 4px 6px rgba(0,0,0,0.05)' : 'none', opacity: active ? 1 : 0.5 }}>{icon}</div>
        <div style={{ fontSize: '10px', fontWeight: '800', marginTop: '6px', color: active ? '#111827' : '#9CA3AF', textTransform: 'uppercase' }}>{title}</div>
    </div>
);

const Card = ({ title, children }) => (
    <div style={{ background: '#FFF', padding: '24px', borderRadius: '20px', border: '1px solid #E5E7EB' }}>
      <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#9CA3AF', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</h3>
      {children}
    </div>
);

const IconButton = ({ children, active, onClick }) => (
    <div onClick={onClick} style={{ width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: active ? '2px solid #111827' : '1px solid #E5E7EB', background: '#FFF' }}>
      {children}
    </div>
);

const ColorBox = ({ label, value, onChange }) => (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#F9FAFB', padding: '10px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ border: 'none', background: 'none', width: '28px', height: '28px', cursor: 'pointer' }} />
        <span style={{ fontSize: '13px', fontWeight: '700' }}>{value?.toUpperCase()}</span>
      </div>
    </div>
);

const Field = ({ label, value, onChange }) => (
  <div style={{ marginBottom: '15px' }}>
    <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>{label}</label>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '14px' }} />
  </div>
);

const AreaField = ({ label, value, onChange }) => (
  <div style={{ marginBottom: '15px' }}>
    <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>{label}</label>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '14px', minHeight: '80px', resize: 'none' }} />
  </div>
);

const Toast = ({ message }) => (
    <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#FFF', padding: '14px 28px', borderRadius: '16px', fontWeight: '600', zIndex: 9999 }}>{message}</div>
);