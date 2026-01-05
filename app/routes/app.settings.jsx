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
  
  // Explicitly mapping each field to ensure Prisma picks it up
  const data = {
    shop: session.shop,
    primaryColor: formData.get("primaryColor"),
    headerBgColor: formData.get("headerBgColor"),
    heroBgColor: formData.get("heroBgColor"),
    headerTextColor: formData.get("headerTextColor"),
    heroTextColor: formData.get("heroTextColor"),
    cardTitleColor: formData.get("cardTitleColor"),
    cardSubtitleColor: formData.get("cardSubtitleColor"),
    onboardingTextColor: formData.get("onboardingTextColor"),
    welcomeImg: formData.get("welcomeImg"),
    headerTitle: formData.get("headerTitle"),
    headerSubtitle: formData.get("headerSubtitle"),
    welcomeText: formData.get("welcomeText"),
    welcomeSubtext: formData.get("welcomeSubtext"),
    replyTimeText: formData.get("replyTimeText"),
    startConversationText: formData.get("startConversationText"),
    onboardingTitle: formData.get("onboardingTitle"),
    onboardingSubtitle: formData.get("onboardingSubtitle"),
    launcherIcon: formData.get("launcherIcon"),
    fontFamily: formData.get("fontFamily"),
    baseFontSize: formData.get("baseFontSize"),
  };
  
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

  // Sync form state when loader data changes (after save)
  useEffect(() => {
    if (settings) {
      setFormState(settings);
    }
  }, [settings]);

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
    Object.entries(formState).forEach(([key, value]) => {
      formData.append(key, value);
    });
    submit(formData, { method: "POST" });
  };

  return (
    <div style={{ background: '#F3F4F6', minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif' }}>
      
      {/* NAVIGATION */}
      <div style={{ width: '100px', background: '#F9FAFB', borderRight: '1px solid #E5E7EB', padding: '30px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'sticky', top: 0, height: '100vh' }}>
 
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <NavIcon active={activeTab === 'style'} onClick={() => setActiveTab('style')} icon="🎨" title="Style" />
          <NavIcon active={activeTab === 'content'} onClick={() => setActiveTab('content')} icon="🌐" title="Content" />
          <NavIcon active={activeTab === 'typography'} onClick={() => setActiveTab('typography')} icon="Aa" title="Fonts" />
        </nav>
      </div>

      {/* CONFIGURATION */}
      <div style={{ flex: 1, padding: '40px 50px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>
            {activeTab === 'style' && 'Appearance'}
            {activeTab === 'content' && 'Translations'}
            {activeTab === 'typography' && 'Typography'}
          </h1>
          <button onClick={handleSave} style={{ padding: '12px 28px', background: '#111827', color: '#FFF', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', border: 'none' }}>
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
                 <img src={formState.welcomeImg} style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #E5E7EB' }} alt="Avatar" />
                 <button onClick={() => fileInputRef.current.click()} style={{ padding: '8px 16px', background: '#FFF', border: '1px solid #D1D5DB', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Upload New Image</button>
                 <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
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
          <Card title="Font Style">
              <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>Font Family</label>
              <select value={formState.fontFamily} onChange={(e) => handleChange('fontFamily', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '14px', background: '#FFF' }}>
                {FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}
              </select>
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>Base Font Size: {formState.baseFontSize}</label>
                <input type="range" min="12" max="20" value={parseInt(formState.baseFontSize)} onChange={(e) => handleChange('baseFontSize', `${e.target.value}px`)} style={{ width: '100%', cursor: 'pointer', accentColor: '#4F46E5' }} />
              </div>
          </Card>
        )}

        {activeTab === 'content' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card title="Header & Hero Content">
               <Field label="Header Title" value={formState.headerTitle} onChange={(v) => handleChange('headerTitle', v)} />
               <Field label="Header Subtitle" value={formState.headerSubtitle} onChange={(v) => handleChange('headerSubtitle', v)} />
               <Field label="Hero Title" value={formState.welcomeText} onChange={(v) => handleChange('welcomeText', v)} />
               <AreaField label="Hero Subtext" value={formState.welcomeSubtext} onChange={(v) => handleChange('welcomeSubtext', v)} />
            </Card>
            <Card title="Conversation & Onboarding">
               <Field label="Action Card Title" value={formState.startConversationText} onChange={(v) => handleChange('startConversationText', v)} />
               <Field label="Reply Time Text" value={formState.replyTimeText} onChange={(v) => handleChange('replyTimeText', v)} />
               <Field label="Onboarding Title" value={formState.onboardingTitle} onChange={(v) => handleChange('onboardingTitle', v)} />
               <AreaField label="Onboarding Subtitle" value={formState.onboardingSubtitle} onChange={(v) => handleChange('onboardingSubtitle', v)} />
            </Card>
          </div>
        )}
      </div>

      {/* LIVE PREVIEW SECTION */}
      <div style={{ width: '450px', padding: '40px', background: '#F9FAFB', borderLeft: '1px solid #E5E7EB', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: '20px', fontSize: '12px', fontWeight: '800', color: '#9CA3AF' }}>PREVIEW</div>
          
          <div style={{ width: '350px', height: '620px', background: '#FFF', borderRadius: '28px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.1)', fontFamily: formState.fontFamily }}>
            {/* Header */}
            <div style={{ background: formState.headerBgColor, padding: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={formState.welcomeImg} style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} alt="avatar" />
                <div>
                    <div style={{ fontWeight: '700', color: formState.headerTextColor, fontSize: formState.baseFontSize }}>{formState.headerTitle}</div>
                    <div style={{ fontSize: '12px', color: formState.headerTextColor, opacity: 0.8 }}>{formState.headerSubtitle}</div>
                </div>
            </div>

            <div style={{ flex: 1, background: '#f8fafc', overflowY: 'auto' }}>
                {/* Hero Section */}
                <div style={{ background: formState.heroBgColor, padding: '40px 25px', color: formState.heroTextColor }}>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 10px 0' }}>{formState.welcomeText}</h1>
                    <p style={{ fontSize: formState.baseFontSize, opacity: 0.9 }}>{formState.welcomeSubtext}</p>
                </div>
                
                {/* Conversation Card */}
                <div style={{ background: '#FFF', margin: '-30px 20px 15px', padding: '15px', borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', border: `1.5px solid #f1f5f9` }}>
                    <div>
                      <div style={{ fontWeight: '700', color: formState.cardTitleColor }}>{formState.startConversationText}</div>
                      <div style={{ fontSize: '12px', color: formState.cardSubtitleColor }}>{formState.replyTimeText}</div>
                    </div>
                </div>

                {/* Onboarding Preview */}
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: formState.onboardingTextColor, marginBottom: '5px' }}>{formState.onboardingTitle}</h3>
                    <p style={{ fontSize: '13px', color: formState.onboardingTextColor, opacity: 0.7 }}>{formState.onboardingSubtitle}</p>
                </div>
            </div>
          </div>

          {/* Launcher Button Preview */}
          <div style={{ marginTop: '20px', width: '60px', height: '60px', borderRadius: '50%', background: formState.primaryColor, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ borderRadius: '50%', padding: formState.launcherIcon === 'custom' ? '0' : '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {ICON_MAP[formState.launcherIcon]}
            </div>
          </div>
      </div>

      {toast && <Toast message="Settings Saved Successfully!" />}
    </div>
  );
}

// Sub-components
const NavIcon = ({ active, icon, title, onClick }) => (
    <div onClick={onClick} style={{ textAlign: 'center', cursor: 'pointer', opacity: active ? 1 : 0.5, transition: '0.2s', marginBottom: '20px' }}>
        <div style={{ fontSize: '24px', background: active ? '#F3F4F6' : 'transparent', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>{icon}</div>
        <div style={{ fontSize: '10px', fontWeight: '700', marginTop: '5px', color: '#4B5563' }}>{title}</div>
    </div>
);
const Card = ({ title, children }) => (
    <div style={{ background: '#FFF', padding: '24px', borderRadius: '16px', border: '1px solid #E5E7EB', marginBottom: '10px' }}>
      <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#9CA3AF', marginBottom: '20px', textTransform: 'uppercase' }}>{title}</h3>
      {children}
    </div>
);
const IconButton = ({ children, active, onClick }) => (
    <div onClick={onClick} style={{ width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: active ? '2.5px solid #4F46E5' : '1.5px solid #E5E7EB', background: '#FFF' }}>
      {children}
    </div>
);
const ColorBox = ({ label, value, onChange }) => (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#F9FAFB', padding: '8px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ border: 'none', background: 'none', width: '25px', height: '25px', cursor: 'pointer' }} />
        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{value?.toUpperCase()}</span>
      </div>
    </div>
);
const Field = ({ label, value, onChange }) => (
  <div style={{ marginBottom: '15px' }}>
    <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>{label}</label>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '14px' }} />
  </div>
);
const AreaField = ({ label, value, onChange }) => (
  <div style={{ marginBottom: '15px' }}>
    <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>{label}</label>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '14px', minHeight: '60px', resize: 'none' }} />
  </div>
);
const Toast = ({ message }) => (
    <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#FFF', padding: '12px 24px', borderRadius: '50px', fontWeight: '600', zIndex: 9999 }}>
      ✅ {message}
    </div>
);