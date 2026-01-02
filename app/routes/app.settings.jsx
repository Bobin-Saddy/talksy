import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { useState, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const ICON_MAP = {
  bubble: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  send: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  custom: <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="1200" viewBox="0 0 1200 1200" fill="none">
<g clip-path="url(#clip0_356_516)">
<rect width="1200" height="1200" fill="white"/>
<rect width="1200" height="1200" transform="translate(0.5 0.5)" fill="white"/>
<g filter="url(#filter0_di_356_516)">
<rect x="207" y="207" width="788" height="788" fill="url(#pattern0_356_516)" shape-rendering="crispEdges"/>
</g>
<rect x="525" y="353" width="138" height="119" fill="#FFDE43"/>
<g filter="url(#filter1_f_356_516)">
<rect x="590" y="473" width="24" height="5" fill="#D9D9D9"/>
</g>
<circle cx="601" cy="601" r="389" stroke="#FFC700" stroke-width="10"/>
</g>
<defs>
<filter id="filter0_di_356_516" x="203" y="205" width="796" height="798" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dy="4"/>
<feGaussianBlur stdDeviation="2"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_356_516"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_356_516" result="shape"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="-12" dy="-2"/>
<feGaussianBlur stdDeviation="2"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0"/>
<feBlend mode="normal" in2="shape" result="effect2_innerShadow_356_516"/>
</filter>
<pattern id="pattern0_356_516" patternContentUnits="objectBoundingBox" width="1" height="1">
<use xlink:href="#image0_356_516" transform="scale(0.00195312)"/>
</pattern>
<filter id="filter1_f_356_516" x="584" y="467" width="36" height="17" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feGaussianBlur stdDeviation="3" result="effect1_foregroundBlur_356_516"/>
</filter>
<clipPath id="clip0_356_516">
<rect width="1200" height="1200" fill="white"/>
</clipPath>
<image id="image0_356_516" width="512" height="512" preserveAspectRatio="none" xlink:href="data:image/png;base64,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"/>
</defs>
</svg>
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
    launcherIcon: "custom",
    welcomeImg: "https://ui-avatars.com/api/?name=Support&background=fff&color=4F46E5",
    headerTitle: "Live Support",
    headerSubtitle: "Online now",
    welcomeText: "Hi there 👋",
    welcomeSubtext: "We are here to help you! Ask us anything.",
    replyTimeText: "Typically replies in 5 minutes",
    startConversationText: "Send us a message",
    onboardingTitle: "Start a conversation",
    onboardingSubtitle: "Please provide your details to begin.",
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

  useEffect(() => { if (actionData?.success) { setToast(true); setTimeout(() => setToast(false), 3000); } }, [actionData]);

  const handleChange = (f, v) => setFormState(p => ({ ...p, [f]: v }));
  
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange('welcomeImg', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => submit(formState, { method: "POST" });

  return (
    <div style={{ background: '#F3F4F6', minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif' }}>
      
      {/* NAVIGATION */}
      <div style={{ width: '260px', background: '#FFFFFF', borderRight: '1px solid #E5E7EB', padding: '30px 20px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <div style={{ width: '35px', height: '35px', background: 'linear-gradient(135deg, #FFC700, #4F46E5)', borderRadius: '10px' }}></div>
          <span style={{ fontWeight: '800', fontSize: '18px' }}>Talksy</span>
        </div>
        
        <nav style={{ flex: 1 }}>
          <NavButton active={activeTab === 'style'} onClick={() => setActiveTab('style')} label="Widget Style" icon="🎨" />
          <NavButton active={activeTab === 'content'} onClick={() => setActiveTab('content')} label="Translations" icon="🌐" />
          <NavButton active={activeTab === 'typography'} onClick={() => setActiveTab('typography')} label="Typography" icon="Aa" />
        </nav>
      </div>

      {/* CONFIGURATION */}
      <div style={{ flex: 1, padding: '40px 50px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800' }}>
            {activeTab === 'style' && 'Appearance'}
            {activeTab === 'content' && 'Content'}
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

            <Card title="Text & UI Colors">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <ColorBox label="Header Text" value={formState.headerTextColor} onChange={(v) => handleChange('headerTextColor', v)} />
                <ColorBox label="Banner Text" value={formState.heroTextColor} onChange={(v) => handleChange('heroTextColor', v)} />
                <ColorBox label="Action Card Title" value={formState.cardTitleColor} onChange={(v) => handleChange('cardTitleColor', v)} />
                <ColorBox label="Action Card Sub" value={formState.cardSubtitleColor} onChange={(v) => handleChange('cardSubtitleColor', v)} />
                <ColorBox label="Onboarding Text" value={formState.onboardingTextColor} onChange={(v) => handleChange('onboardingTextColor', v)} />
              </div>
            </Card>
          </div>
        )}

        {/* TYPOGRAPHY & CONTENT SECTIONS REMAIN SIMILAR */}
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
               <Field label="Status Text" value={formState.headerSubtitle} onChange={(v) => handleChange('headerSubtitle', v)} />
               <Field label="Hero Title" value={formState.welcomeText} onChange={(v) => handleChange('welcomeText', v)} />
               <AreaField label="Hero Subtext" value={formState.welcomeSubtext} onChange={(v) => handleChange('welcomeSubtext', v)} />
            </Card>
          </div>
        )}
      </div>

      {/* LIVE PREVIEW SECTION */}
      <div style={{ width: '450px', padding: '40px', background: '#F9FAFB', borderLeft: '1px solid #E5E7EB', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: '20px', fontSize: '12px', fontWeight: '800', color: '#9CA3AF' }}>PREVIEW</div>
          
          <div style={{ width: '350px', height: '580px', background: '#FFF', borderRadius: '28px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.1)', fontFamily: formState.fontFamily }}>
            <div style={{ background: formState.headerBgColor, padding: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={formState.welcomeImg} style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} alt="avatar" />
                <div>
                    <div style={{ fontWeight: '700', color: formState.headerTextColor, fontSize: formState.baseFontSize }}>{formState.headerTitle}</div>
                    <div style={{ fontSize: '12px', color: formState.headerTextColor, opacity: 0.8 }}>{formState.headerSubtitle}</div>
                </div>
            </div>

            <div style={{ flex: 1, background: '#f8fafc', overflowY: 'auto' }}>
                <div style={{ background: formState.heroBgColor, padding: '40px 25px', color: formState.heroTextColor }}>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 10px 0' }}>{formState.welcomeText}</h1>
                    <p style={{ fontSize: formState.baseFontSize, opacity: 0.9 }}>{formState.welcomeSubtext}</p>
                </div>
                <div style={{ background: '#FFF', margin: '-30px 20px 0', padding: '20px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', border: `2px solid ${formState.cardTitleColor}` }}>
                    <div>
                        <div style={{ fontWeight: '700', color: formState.cardTitleColor }}>{formState.startConversationText}</div>
                        <div style={{ fontSize: '12px', color: formState.cardSubtitleColor }}>{formState.replyTimeText}</div>
                    </div>
                </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', width: '60px', height: '60px', borderRadius: '50%', background: formState.primaryColor, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ICON_MAP[formState.launcherIcon]}
          </div>
      </div>

      {toast && <Toast message="Settings Synced Successfully!" />}
    </div>
  );
}

// Helper components remain same
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
    <textarea value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '14px', minHeight: '80px', resize: 'none' }} />
  </div>
);
const Toast = ({ message }) => (
    <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#FFF', padding: '12px 24px', borderRadius: '50px', fontWeight: '600', zIndex: 9999 }}>
      ✅ {message}
    </div>
);