import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { useState, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Icon Map function
const ICON_MAP = (customImg) => ({
  bubble: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  send: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  defaultCustom: <img src="https://alert-lime-e4qtqvlkob.edgeone.app/icon-frame.png" alt="custom" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />,
  custom: customImg ? <img src={customImg} alt="User upload" style={{ width: '100%', height: '100%', borderRadius: '4px', objectFit: 'cover' }} /> : <span style={{ fontSize: '20px' }}>+</span>
});

const FONT_OPTIONS = [
  { 
    label: "Euclid Circular A (Medium)", 
    value: "'Euclid Circular A Medium', 'Euclid Circular A', -apple-system, BlinkMacSystemFont, sans-serif" 
  },
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
    primaryColor: "#4F46E5",
    headerBgColor: "#2c3e50",
    heroBgColor: "#f8f9fa",
    headerTextColor: "#ffffff",
    heroTextColor: "#1a1a1a",
    cardTitleColor: "#1a1a1a",
    cardSubtitleColor: "#4a5568",
    onboardingTextColor: "#1a1a1a",
    chatBoxBgColor: "#f8f9fa",
    messageBgColor: "#FFFFFF",
    widgetBorderColor: "#E5E7EB",
    contactCardBgColor: "#e8e8e8",
    chatButtonBgColor: "#2c3e50",
    emailButtonBgColor: "#fbbf24",
    customLauncherImg: "", 
    welcomeImg: "https://ui-avatars.com/api/?name=Support&background=4F46E5&color=fff",
    headerTitle: "Live Support",
    headerSubtitle: "Online now",
    welcomeText: "Hi 👋",
    welcomeSubtext: "How can we help you?",
    replyTimeText: "Typically replies in 5 minutes",
    startConversationText: "Contact us", 
    onboardingTitle: "Start a conversation",
    onboardingSubtitle: "Please provide your details to begin.",
    launcherIcon: "bubble",
    fontFamily: "'Euclid Circular A Medium', 'Euclid Circular A', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
        }
      };
      reader.readAsDataURL(file);
    }
  };

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
    <div style={{ background: '#F3F4F6', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Top Navigation Tabs */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', padding: '0 40px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '0' }}>
            <TabNav active={activeTab === 'style'} onClick={() => setActiveTab('style')} label="Appearance" />
            <TabNav active={activeTab === 'content'} onClick={() => setActiveTab('content')} label="Content" />
            <TabNav active={activeTab === 'typography'} onClick={() => setActiveTab('typography')} label="Typography" />
          </div>
          <button onClick={handleSave} style={{ padding: '10px 24px', background: '#111827', color: '#FFF', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', border: 'none', margin: '16px 0' }}>
            {navigation.state === "submitting" ? "Syncing..." : "Save & Publish"}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ flex: 1, padding: '40px 50px', maxWidth: '750px', overflowY: 'auto', height: 'calc(100vh - 73px)' }}>

        {activeTab === 'style' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card title="Launcher Icon">
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['bubble', 'send', 'defaultCustom'].map(key => (
                    <IconButton key={key} active={formState.launcherIcon === key} onClick={() => handleChange('launcherIcon', key)}>
                      {icons[key]}
                    </IconButton>
                  ))}
                  {formState.customLauncherImg && (
                    <IconButton active={formState.launcherIcon === 'custom'} onClick={() => handleChange('launcherIcon', 'custom')}>
                      {icons['custom']}
                    </IconButton>
                  )}
                </div>
                <button onClick={() => launcherRef.current.click()} style={{ padding: '10px 16px', background: '#FFF', border: '1px solid #D1D5DB', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  Upload Custom
                </button>
                <input type="file" ref={launcherRef} onChange={(e) => handleFileUpload(e, 'launcher')} accept="image/*" style={{ display: 'none' }} />
              </div>
            </Card>

            <Card title="Header Colors">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <ColorBox label="Header Background" value={formState.headerBgColor} onChange={(v) => handleChange('headerBgColor', v)} />
                <ColorBox label="Header Text Color" value={formState.headerTextColor} onChange={(v) => handleChange('headerTextColor', v)} />
              </div>
            </Card>

            <Card title="Main Background Colors">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <ColorBox label="Primary Color" value={formState.primaryColor} onChange={(v) => handleChange('primaryColor', v)} />
                <ColorBox label="Page Background" value={formState.chatBoxBgColor} onChange={(v) => handleChange('chatBoxBgColor', v)} />
                <ColorBox label="Widget Border" value={formState.widgetBorderColor} onChange={(v) => handleChange('widgetBorderColor', v)} />
              </div>
            </Card>

            <Card title="Contact Card Colors">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <ColorBox label="Card Background" value={formState.contactCardBgColor || "#e8e8e8"} onChange={(v) => handleChange('contactCardBgColor', v)} />
                <ColorBox label="Chat Button" value={formState.chatButtonBgColor || "#2c3e50"} onChange={(v) => handleChange('chatButtonBgColor', v)} />
                <ColorBox label="Email Button" value={formState.emailButtonBgColor || "#fbbf24"} onChange={(v) => handleChange('emailButtonBgColor', v)} />
              </div>
            </Card>

            <Card title="Text Colors">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <ColorBox label="Card Title" value={formState.cardTitleColor} onChange={(v) => handleChange('cardTitleColor', v)} />
                <ColorBox label="Card Subtitle" value={formState.cardSubtitleColor} onChange={(v) => handleChange('cardSubtitleColor', v)} />
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'content' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card title="Header Content">
               <Field label="Header Title" value={formState.welcomeText} onChange={(v) => handleChange('welcomeText', v)} />
               <Field label="Header Subtitle" value={formState.welcomeSubtext} onChange={(v) => handleChange('welcomeSubtext', v)} />
            </Card>
            
            <Card title="Contact Card Content">
               <Field label="Contact Card Title" value={formState.startConversationText} onChange={(v) => handleChange('startConversationText', v)} />
            </Card>
            
            <Card title="Onboarding Content">
               <Field label="Onboarding Title" value={formState.onboardingTitle} onChange={(v) => handleChange('onboardingTitle', v)} />
               <AreaField label="Onboarding Subtitle" value={formState.onboardingSubtitle} onChange={(v) => handleChange('onboardingSubtitle', v)} />
            </Card>
          </div>
        )}

        {activeTab === 'typography' && (
          <Card title="Fonts">
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

      <div style={{ flex: 1, background: '#F9FAFB', borderLeft: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'sticky', top: 0, height: '100vh' }}>
          
          <div style={{ 
            width: '400px', 
            height: '680px', 
            background: formState.chatBoxBgColor, 
            borderRadius: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            boxShadow: '0 30px 60px -12px rgba(0,0,0,0.15)', 
            border: `1px solid ${formState.widgetBorderColor}`, 
            fontFamily: formState.fontFamily,
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ 
              background: formState.headerBgColor, 
              color: formState.headerTextColor,
              padding: '24px 24px 20px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start'
            }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>
                        {formState.welcomeText}
                    </h1>
                    <p style={{ fontSize: '16px', opacity: 0.9, fontWeight: '400' }}>
                        {formState.welcomeSubtext}
                    </p>
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Contact Card */}
                <div style={{ 
                    background: formState.contactCardBgColor || '#e8e8e8', 
                    padding: '20px', 
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div>
                        <div style={{ fontSize: '17px', fontWeight: '600', color: formState.cardTitleColor, marginBottom: '6px' }}>
                            {formState.startConversationText}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }}></div>
                            <span style={{ fontSize: '14px', color: formState.cardSubtitleColor }}>We are online</span>
                        </div>
                    </div>
                    
                    <button style={{ 
                        background: formState.chatButtonBgColor || '#2c3e50', 
                        color: 'white',
                        border: 'none',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                        </svg>
                        <span>Chat now</span>
                    </button>
                    
                    <button style={{ 
                        background: formState.emailButtonBgColor || '#fbbf24',
                        color: '#1a1a1a',
                        border: 'none',
                        padding: '14px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                        </svg>
                    </button>
                </div>

                {/* Order Tracking Card */}
                <div style={{ 
                    background: 'white', 
                    padding: '18px 20px', 
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: formState.cardTitleColor }}>
                            Order tracking
                        </div>
                        <div style={{ fontSize: '14px', color: formState.cardSubtitleColor }}>
                            Track your orders
                        </div>
                    </div>
                    <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="m9 18 6-6-6-6"/>
                        </svg>
                    </div>
                </div>

                {/* Search Box */}
                <div style={{ position: 'relative' }}>
                    <input 
                        type="text"
                        placeholder="Search for help"
                        style={{
                            width: '100%',
                            padding: '14px 50px 14px 18px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            fontSize: '15px',
                            background: 'white'
                        }}
                    />
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                        </svg>
                    </div>
                </div>

                {/* FAQ Items */}
                {[1, 2, 3].map(i => (
                    <div key={i} style={{
                        background: 'white',
                        padding: '16px 18px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                        <span style={{ fontSize: '15px', fontWeight: '500', color: formState.cardTitleColor }}>
                            {i === 1 ? 'How long will it take to receive my order?' : i === 2 ? 'How to track my order?' : 'Do you ship internationally?'}
                        </span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                            <path d="m9 18 6-6-6-6"/>
                        </svg>
                    </div>
                ))}
            </div>

            {/* Bottom Navigation */}
            <div style={{ height: '80px', borderTop: `1px solid ${formState.widgetBorderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingBottom: '8px', background: '#FFF' }}>
                <NavIcon active={true} color={formState.primaryColor} label="Home">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                </NavIcon>
                <NavIcon label="Message">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                </NavIcon>
                <NavIcon label="Track">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                    </svg>
                </NavIcon>
                <NavIcon label="Help">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                </NavIcon>
            </div>
          </div>

          <div style={{ 
              marginTop: '25px',
              width: '62px', 
              height: '62px', 
              borderRadius: '50%', 
              background: '#FFF', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              boxShadow: '0 10px 20px rgba(0,0,0,0.1)', 
              border: `1px solid ${formState.widgetBorderColor}`,
              color: formState.primaryColor,
              overflow: 'hidden'
          }}>
              <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {icons[formState.launcherIcon]}
              </div>
          </div>
      </div>
      </div>

      {toast && <Toast message="Settings Saved Successfully!" />}
    </div>
  );
}

const TabNav = ({ active, label, onClick }) => (
    <div 
        onClick={onClick} 
        style={{ 
            padding: '20px 24px', 
            cursor: 'pointer', 
            borderBottom: active ? '3px solid #111827' : '3px solid transparent',
            fontWeight: active ? '700' : '500',
            fontSize: '15px',
            color: active ? '#111827' : '#6B7280',
            transition: 'all 0.2s',
            position: 'relative'
        }}
    >
        {label}
    </div>
);

const Card = ({ title, children }) => (
    <div style={{ background: '#FFF', padding: '24px', borderRadius: '20px', border: '1px solid #E5E7EB', marginBottom: '10px' }}>
      <h3 style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', marginBottom: '20px', textTransform: 'uppercase' }}>{title}</h3>
      {children}
    </div>
);

const IconButton = ({ children, active, onClick }) => (
    <div onClick={onClick} style={{ width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: active ? '2.5px solid #111827' : '1.5px solid #E5E7EB', background: '#FFF', transition: '0.2s' }}>
      {children}
    </div>
);

const ColorBox = ({ label, value, onChange }) => (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#F9FAFB', padding: '10px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ border: 'none', background: 'none', width: '28px', height: '28px', cursor: 'pointer' }} />
        <span style={{ fontSize: '13px', fontWeight: '600' }}>{value?.toUpperCase()}</span>
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

const NavIcon = ({ children, active, color, label }) => (
    <div style={{ 
        textAlign: 'center', 
        opacity: active ? 1 : 0.3,
        color: active ? color : '#9CA3AF'
    }}>
        <div style={{ marginBottom: '4px' }}>
            {children}
        </div>
        <div style={{ fontSize: '11px', fontWeight: '600' }}>{label}</div>
    </div>
);

const Toast = ({ message }) => (
    <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#FFF', padding: '14px 28px', borderRadius: '16px', fontWeight: '600', zIndex: 9999 }}>{message}</div>
);