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
      <div style={{ flex: 1, padding: '40px 50px', maxWidth: '750px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>Widget Configuration</h1>
          <button onClick={handleSave} style={{ padding: '10px 24px', background: '#111827', color: '#FFF', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>
            {navigation.state === "submitting" ? "Saving..." : "Save Changes"}
          </button>
        </header>

        {activeTab === 'style' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card title="Colors & Appearance">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <ColorBox label="Accent Color (Button/Icon)" value={formState.primaryColor} onChange={(v) => handleChange('primaryColor', v)} />
                <ColorBox label="Widget Border" value={formState.widgetBorderColor} onChange={(v) => handleChange('widgetBorderColor', v)} />
                <ColorBox label="Header Text" value={formState.headerTextColor} onChange={(v) => handleChange('headerTextColor', v)} />
                <ColorBox label="Hero Text" value={formState.heroTextColor} onChange={(v) => handleChange('heroTextColor', v)} />
              </div>
            </Card>

            <Card title="Avatar & Icons">
               <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                 <img src={formState.welcomeImg} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" />
                 <button onClick={() => avatarRef.current.click()} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #DDD', cursor: 'pointer' }}>Change Avatar</button>
                 <input type="file" ref={avatarRef} style={{ display: 'none' }} onChange={(e) => {
                    const reader = new FileReader();
                    reader.onload = () => handleChange('welcomeImg', reader.result);
                    reader.readAsDataURL(e.target.files[0]);
                 }} />
               </div>
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
            <Card title="Text Content">
               <Field label="Header Name" value={formState.headerTitle} onChange={(v) => handleChange('headerTitle', v)} />
               <Field label="Hero Title" value={formState.welcomeText} onChange={(v) => handleChange('welcomeText', v)} />
               <AreaField label="Hero Subtext" value={formState.welcomeSubtext} onChange={(v) => handleChange('welcomeSubtext', v)} />
               <hr style={{ border: '0', borderTop: '1px solid #f0f0f0', margin: '15px 0' }} />
               <Field label="Message Card Title" value={formState.startConversationText} onChange={(v) => handleChange('startConversationText', v)} />
               <Field label="Onboarding Title" value={formState.onboardingTitle} onChange={(v) => handleChange('onboardingTitle', v)} />
            </Card>
          </div>
        )}

        {activeTab === 'typography' && (
          <Card title="Typography">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>Font Family</label>
              <select value={formState.fontFamily} onChange={(e) => handleChange('fontFamily', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #DDD' }}>
                {FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}
              </select>
          </Card>
        )}
      </div>

      {/* PREVIEW PANEL - MATCHES UPLOADED IMAGE */}
      <div style={{ flex: 1, background: '#F9FAFB', borderLeft: '1px solid #E5E7EB', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'sticky', top: 0, height: '100vh' }}>
          
          <div style={{ 
            width: '380px', 
            height: '680px', 
            background: '#FFF', 
            borderRadius: '35px', 
            display: 'flex', 
            flexDirection: 'column', 
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)', 
            border: `1px solid ${formState.widgetBorderColor}`, 
            fontFamily: formState.fontFamily,
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Header */}
            <div style={{ padding: '25px 25px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ position: 'relative' }}>
                        <img src={formState.welcomeImg} style={{ width: '35px', height: '35px', borderRadius: '50%', background: formState.primaryColor }} alt="avatar" />
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', background: '#4ADE80', borderRadius: '50%', border: '2px solid #FFF' }}></div>
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '17px', color: formState.headerTextColor }}>{formState.headerTitle}</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, padding: '40px 30px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px', color: formState.heroTextColor }}>{formState.welcomeText}</h1>
                <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.5', margin: '0 0 40px 0' }}>{formState.welcomeSubtext}</p>
                
                {/* Main Action Card */}
                <div style={{ 
                    background: '#FFF', 
                    padding: '25px', 
                    borderRadius: '24px', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)', 
                    border: '1px solid #F3F4F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    marginBottom: '40px'
                }}>
                    <div>
                        <div style={{ fontWeight: '700', color: '#1F2937', fontSize: '16px', marginBottom: '4px' }}>{formState.startConversationText}</div>
                        <div style={{ fontSize: '13px', color: '#9CA3AF' }}>{formState.replyTimeText}</div>
                    </div>
                    <div style={{ width: '40px', height: '40px', background: formState.primaryColor, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                </div>

                {/* Onboarding Secondary Area */}
                <div style={{ marginTop: '20px' }}>
                    <div style={{ fontWeight: '700', color: '#1F2937', fontSize: '18px', marginBottom: '8px' }}>{formState.onboardingTitle}</div>
                    <div style={{ fontSize: '14px', color: '#4B5563' }}>{formState.onboardingSubtitle}</div>
                </div>
            </div>

            {/* Bottom Nav Bar */}
            <div style={{ height: '85px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingBottom: '10px' }}>
                <div style={{ textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ color: formState.primaryColor, marginBottom: '4px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: formState.primaryColor }}>Home</div>
                </div>
                <div style={{ textAlign: 'center', opacity: 0.4 }}>
                    <div style={{ color: '#9CA3AF', marginBottom: '4px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '700' }}>Messages</div>
                </div>
            </div>
          </div>
      </div>

      {toast && <Toast message="Settings Saved!" />}
    </div>
  );
}

// UI HELPERS
const NavIcon = ({ active, icon, title, onClick }) => (
    <div onClick={onClick} style={{ textAlign: 'center', cursor: 'pointer', marginBottom: '25px', opacity: active ? 1 : 0.5 }}>
        <div style={{ fontSize: '20px', background: active ? '#FFF' : 'transparent', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: active ? '1px solid #EEE' : 'none' }}>{icon}</div>
        <div style={{ fontSize: '10px', fontWeight: '700', marginTop: '5px' }}>{title}</div>
    </div>
);

const Card = ({ title, children }) => (
    <div style={{ background: '#FFF', padding: '20px', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
      <h3 style={{ fontSize: '10px', fontWeight: '800', color: '#9CA3AF', marginBottom: '15px', textTransform: 'uppercase' }}>{title}</h3>
      {children}
    </div>
);

const IconButton = ({ children, active, onClick }) => (
    <div onClick={onClick} style={{ width: '45px', height: '45px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: active ? '2px solid #111827' : '1px solid #EEE', background: '#FFF' }}>
      {children}
    </div>
);

const ColorBox = ({ label, value, onChange }) => (
    <div>
      <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', fontWeight: '600', marginBottom: '5px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#F9FAFB', padding: '8px', borderRadius: '8px', border: '1px solid #EEE' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ border: 'none', background: 'none', width: '24px', height: '24px', cursor: 'pointer' }} />
        <span style={{ fontSize: '12px', fontWeight: '600' }}>{value?.toUpperCase()}</span>
      </div>
    </div>
);

const Field = ({ label, value, onChange }) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', fontWeight: '600', marginBottom: '5px' }}>{label}</label>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #EEE', fontSize: '13px' }} />
  </div>
);

const AreaField = ({ label, value, onChange }) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', fontWeight: '600', marginBottom: '5px' }}>{label}</label>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #EEE', fontSize: '13px', minHeight: '60px', resize: 'none' }} />
  </div>
);

const Toast = ({ message }) => (
    <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#FFF', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', zIndex: 999 }}>{message}</div>
);