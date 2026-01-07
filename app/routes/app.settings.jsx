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
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Monospace", value: "ui-monospace, SFMono-Regular, monospace" }
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.chatSettings.findUnique({ where: { shop: session.shop } });
  
  const defaults = {
    primaryColor: "#4F46E5",
    headerBgColor: "#384959",
    heroBgColor: "#bdddfc",
    headerTextColor: "#ffffff",
    heroTextColor: "#384959",
    cardTitleColor: "#384959",
    cardSubtitleColor: "#64748b",
    onboardingTextColor: "#384959",
    navActiveColor: "#4F46E5", // Added New
    chatMsgBgColor: "#4F46E5", // Added New
    launcherIconColor: "#4F46E5", // Add this
    welcomeImg: "https://ui-avatars.com/api/?name=Support&background=fff&color=4F46E5",
    headerTitle: "Admin",
    headerSubtitle: "Online now",
    welcomeText: "Hi there 👋",
    welcomeSubtext: "We are here to help you! Ask us anything.",
    replyTimeText: "Typically replies in 5 minutes",
    startConversationText: "Send us a message",
    onboardingTitle: "Start a conversation",
    onboardingSubtitle: "Please provide your details to begin.",
    launcherIcon: "bubble",
    customLauncherImg: "", 
    fontFamily: "Inter, sans-serif",
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
  
  const handleFileUpload = (event, field) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (field === 'launcher') {
          setFormState(p => ({ ...p, customLauncherImg: reader.result, launcherIcon: 'custom' }));
        } else {
          handleChange('welcomeImg', reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const formData = new FormData();
    Object.entries(formState).forEach(([key, value]) => formData.append(key, value));
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

      <div style={{ flex: 1, padding: '40px 50px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>
            {activeTab === 'style' && 'Appearance'}
            {activeTab === 'content' && 'Content Settings'}
            {activeTab === 'typography' && 'Typography'}
          </h1>
          <button onClick={handleSave} style={{ padding: '12px 28px', background: '#111827', color: '#FFF', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', border: 'none' }}>
            {navigation.state === "submitting" ? "Syncing..." : "Save & Publish"}
          </button>
        </header>

        {activeTab === 'style' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card title="Launcher Icon Selection">
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['bubble', 'send', 'defaultCustom'].map(key => (
                    <IconButton key={key} active={formState.launcherIcon === key} onClick={() => handleChange('launcherIcon', key)}>
                      {icons[key]}
                    </IconButton>
                  ))}
                  <IconButton 
                    active={formState.launcherIcon === 'custom'} 
                    onClick={() => {
                        if(!formState.customLauncherImg) launcherRef.current.click();
                        else handleChange('launcherIcon', 'custom');
                    }}
                  >
                    {icons['custom']}
                  </IconButton>
                </div>
                <div style={{ height: '40px', width: '1px', background: '#E5E7EB', margin: '0 5px' }}></div>
                <button onClick={() => launcherRef.current.click()} style={{ padding: '10px 16px', background: '#FFF', border: '1px solid #D1D5DB', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  {formState.customLauncherImg ? "Replace Icon" : "Upload Custom"}
                </button>
                <input type="file" ref={launcherRef} onChange={(e) => handleFileUpload(e, 'launcher')} accept="image/*" style={{ display: 'none' }} />
              </div>
            </Card>

            <Card title="Brand Assets">
               <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>Support Avatar</label>
               <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                 <img src={formState.welcomeImg} style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #E5E7EB' }} alt="Avatar" />
                 <button onClick={() => avatarRef.current.click()} style={{ padding: '8px 16px', background: '#FFF', border: '1px solid #D1D5DB', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Change Photo</button>
                 <input type="file" ref={avatarRef} onChange={(e) => handleFileUpload(e, 'avatar')} accept="image/*" style={{ display: 'none' }} />
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <ColorBox label="Header Background" value={formState.headerBgColor} onChange={(v) => handleChange('headerBgColor', v)} />
                <ColorBox label="Banner (Hero) Background" value={formState.heroBgColor} onChange={(v) => handleChange('heroBgColor', v)} />
              </div>
            </Card>

            <Card title="Widget & Navigation Colors">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <ColorBox label="Header Text Color" value={formState.headerTextColor} onChange={(v) => handleChange('headerTextColor', v)} />
                <ColorBox label="Banner (Hero) Text Color" value={formState.heroTextColor} onChange={(v) => handleChange('heroTextColor', v)} />
                <ColorBox label="Nav Active Border Color" value={formState.navActiveColor} onChange={(v) => handleChange('navActiveColor', v)} />
                <ColorBox label="User Msg Background" value={formState.chatMsgBgColor} onChange={(v) => handleChange('chatMsgBgColor', v)} />
                <ColorBox 
  label="Launcher Icon Color" 
  value={formState.launcherIconColor} 
  onChange={(v) => handleChange('launcherIconColor', v)} 
/>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'content' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card title="Headings & Hero">
               <Field label="Header Title" value={formState.headerTitle} onChange={(v) => handleChange('headerTitle', v)} />
               <Field label="Hero Heading" value={formState.welcomeText} onChange={(v) => handleChange('welcomeText', v)} />
               <AreaField label="Hero Description" value={formState.welcomeSubtext} onChange={(v) => handleChange('welcomeSubtext', v)} />
            </Card>
            <Card title="Chat Card">
               <Field label="Card Button Text" value={formState.startConversationText} onChange={(v) => handleChange('startConversationText', v)} />
               <Field label="Reply Status Text" value={formState.replyTimeText} onChange={(v) => handleChange('replyTimeText', v)} />
            </Card>
            <Card title="Onboarding Screen">
               <Field label="Onboarding Title" value={formState.onboardingTitle} onChange={(v) => handleChange('onboardingTitle', v)} />
               <AreaField label="Onboarding Subtitle" value={formState.onboardingSubtitle} onChange={(v) => handleChange('onboardingSubtitle', v)} />
            </Card>
          </div>
        )}

        {activeTab === 'typography' && (
          <Card title="Font Settings">
              <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>Font Family</label>
              <select value={formState.fontFamily} onChange={(e) => handleChange('fontFamily', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '14px', background: '#FFF' }}>
                {FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}
              </select>
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>Text Size: {formState.baseFontSize}</label>
                <input type="range" min="12" max="20" value={parseInt(formState.baseFontSize)} onChange={(e) => handleChange('baseFontSize', `${e.target.value}px`)} style={{ width: '100%', cursor: 'pointer', accentColor: '#111827' }} />
              </div>
          </Card>
        )}
      </div>

      {/* PREVIEW PANEL */}
      <div style={{ width: '450px', padding: '40px', background: '#F9FAFB', borderLeft: '1px solid #E5E7EB', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: '20px', fontSize: '12px', fontWeight: '800', color: '#9CA3AF', letterSpacing: '1px' }}>LIVE PREVIEW</div>
          
          <div style={{ width: '350px', height: '600px', background: '#FFF', borderRadius: '32px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.05)', fontFamily: formState.fontFamily }}>
            <div style={{ background: formState.headerBgColor, padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={formState.welcomeImg} style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} alt="avatar" />
                <div style={{ color: formState.headerTextColor }}>
                    <div style={{ fontWeight: '700', fontSize: formState.baseFontSize }}>{formState.headerTitle}</div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>Online now</div>
                </div>
            </div>

            <div style={{ flex: 1, background: '#F8FAFC', overflowY: 'auto' }}>
                <div style={{ background: formState.heroBgColor, padding: '45px 25px', color: formState.heroTextColor }}>
                    <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 10px 0', lineHeight: 1.2, color: 'inherit' }}>{formState.welcomeText}</h1>
                    <p style={{ fontSize: formState.baseFontSize, opacity: 0.9, color: 'inherit' }}>{formState.welcomeSubtext}</p>
                </div>
                
                {/* User Message Preview */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px' }}>
                    <div style={{ background: formState.chatMsgBgColor, color: '#FFF', padding: '8px 14px', borderRadius: '16px 16px 0 16px', fontSize: '13px', maxWidth: '80%', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                      Hello! How can I help?
                    </div>
                </div>

                <div style={{ background: '#FFF', margin: '10px 20px 15px', padding: '18px', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', border: `1px solid #E2E8F0` }}>
                    <div style={{ fontWeight: '700', color: formState.cardTitleColor }}>{formState.startConversationText}</div>
                    <div style={{ fontSize: '12px', color: formState.cardSubtitleColor }}>{formState.replyTimeText}</div>
                </div>
            </div>

            {/* Bottom Nav Preview */}
            <div style={{ display: 'flex', borderTop: '1px solid #E5E7EB', background: '#FFF' }}>
                <div style={{ flex: 1, padding: '12px', textAlign: 'center', color: formState.navActiveColor, borderTop: `3px solid ${formState.navActiveColor}` }}>
                    <div style={{ fontSize: '18px' }}>🏠</div>
                    <div style={{ fontSize: '10px', fontWeight: '700' }}>Home</div>
                </div>
                <div style={{ flex: 1, padding: '12px', textAlign: 'center', color: '#9CA3AF' }}>
                    <div style={{ fontSize: '18px' }}>💬</div>
                    <div style={{ fontSize: '10px', fontWeight: '700' }}>Messages</div>
                </div>
            </div>
          </div>

          <div style={{ marginTop: '25px', width: '60px', height: '60px', borderRadius: '50%', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: formState.primaryColor }}>
                  {icons[formState.launcherIcon]}
              </div>
          </div>
      </div>

      {toast && <Toast message="Settings Saved Successfully!" />}
    </div>
  );
}

const NavIcon = ({ active, icon, title, onClick }) => (
    <div onClick={onClick} style={{ textAlign: 'center', cursor: 'pointer', transition: '0.2s', marginBottom: '20px' }}>
        <div style={{ fontSize: '24px', background: active ? '#FFF' : 'transparent', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', border: active ? '1px solid #E5E7EB' : '1px solid transparent', boxShadow: active ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none', opacity: active ? 1 : 0.4 }}>{icon}</div>
        <div style={{ fontSize: '10px', fontWeight: '800', marginTop: '6px', color: active ? '#111827' : '#9CA3AF', textTransform: 'uppercase' }}>{title}</div>
    </div>
);

const Card = ({ title, children }) => (
    <div style={{ background: '#FFF', padding: '24px', borderRadius: '20px', border: '1px solid #E5E7EB', marginBottom: '10px' }}>
      <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#9CA3AF', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</h3>
      {children}
    </div>
);

const IconButton = ({ children, active, onClick }) => (
    <div onClick={onClick} style={{ width: '54px', height: '54px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: active ? '2.5px solid #111827' : '1.5px solid #E5E7EB', background: '#FFF', padding: '10px', transition: '0.2s' }}>
      {children}
    </div>
);

const ColorBox = ({ label, value, onChange }) => (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#F9FAFB', padding: '10px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ border: 'none', background: 'none', width: '28px', height: '28px', cursor: 'pointer' }} />
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>{value?.toUpperCase()}</span>
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
    <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#FFF', padding: '14px 28px', borderRadius: '16px', fontWeight: '600', zIndex: 9999 }}>
      {message}
    </div>
);