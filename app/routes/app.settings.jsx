// app/routes/app.ultimate-settings.jsx - WITH PLAN SAVE LIMIT

import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getShopLimits } from "../planLimits.server";

/* ─── Icon map ─── */
const ICON_MAP = (customImg) => ({
  bubble: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  send:   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  defaultCustom: <img src="https://alert-lime-e4qtqvlkob.edgeone.app/icon-frame.png" alt="custom" style={{ width:"100%", height:"100%", objectFit:"contain" }} />,
  custom: customImg
    ? <img src={customImg} alt="User upload" style={{ width:"100%", height:"100%", borderRadius:"4px", objectFit:"cover" }} />
    : <span style={{ fontSize:"20px" }}>+</span>
});

const FONT_OPTIONS = [
  { label:"Montserrat", value:"'Montserrat', sans-serif" },
  { label:"Inter", value:"'Inter', sans-serif" },
  { label:"Poppins", value:"'Poppins', sans-serif" },
  { label:"Playfair Display", value:"'Playfair Display', serif" },
  { label:"Monospace", value:"ui-monospace, SFMono-Regular, monospace" },
];

const DEFAULTS = {
  primaryColor: "#F39C12", headerGradientStart: "#F39C12", headerGradientEnd: "#E67E22",
  headerBgColor: "#2c3e50", headerTextColor: "#ffffff", chatBoxBgColor: "#f5f5f5",
  messageBgColor: "#FFFFFF", widgetBorderColor: "#E5E7EB", contactCardBgColor: "#FFFFFF",
  chatButtonBgColor: "#F39C12", cardTitleColor: "#1a1a1a", cardSubtitleColor: "#777777",
  onboardingTextColor: "#1a1a1a", searchCardTitle: "Search here", searchCardSubtitle: "This is Search",
  onlineStatusColor: "#22c55e", offlineStatusColor: "#ef4444", customLauncherImg: "",
  welcomeText: "Hello 👋", welcomeSubtext: "How can we help you?",
  startConversationText: "Contact us", onboardingTitle: "Start a conversation",
  onboardingSubtitle: "Please provide your details to begin.",
  launcherIcon: "bubble", fontFamily: "'Montserrat', sans-serif", baseFontSize: "14px",
  saveCount: 0, // ✅ track how many times settings have been saved
};

/* ═══ LOADER ═══ */
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.chatSettings.findUnique({ where: { shop: session.shop } });

  // ✅ Get plan limits
  const { limits, plan } = await getShopLimits(session.shop);

  return json({
    settings: settings ? { ...DEFAULTS, ...settings } : DEFAULTS,
    plan,
    maxSaves: limits.canCustomizeWidget ? -1 : 2, // FREE=2 saves, paid=-1 (unlimited)
    // For STANDARD plan: unlimited saves for widget (canCustomizeWidget=true)
    // For FREE plan: only 2 saves allowed
  });
};

/* ═══ ACTION ═══ */
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  // ✅ Get plan limits - check if saving is allowed
  const { limits, plan } = await getShopLimits(shop);

  // If FREE plan, check save count
  if (!limits.canCustomizeWidget) {
    const current = await prisma.chatSettings.findUnique({ where: { shop } });
    const currentSaveCount = parseInt(current?.saveCount || 0);

    if (currentSaveCount >= 2) {
      return json({
        success: false,
        blocked: true,
        plan,
        message: "Save limit reached. Upgrade to Standard or Premium to continue customizing."
      });
    }

    // Increment save count
    data.saveCount = String(currentSaveCount + 1);
  } else {
    // Paid plan - reset or keep count, no restriction
    const current = await prisma.chatSettings.findUnique({ where: { shop } });
    data.saveCount = String(parseInt(current?.saveCount || 0) + 1);
  }

  await prisma.chatSettings.upsert({
    where: { shop },
    update: data,
    create: { ...data, shop },
  });

  return json({ success: true, plan });
};

/* ═══ PAGE ═══ */
export default function UltimateSettings() {
  const { settings, plan, maxSaves } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [form, setForm] = useState(settings);
  const [activeTab, setTab] = useState("style");
  const [toast, setToast] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [previewOnline, setPreviewOnline] = useState(true);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  useEffect(() => {
    if (actionData?.success) {
      setToast(true);
      setTimeout(() => setToast(false), 3000);
      // Update local save count
      setForm(p => ({ ...p, saveCount: (parseInt(p.saveCount || 0) + 1) }));
    }
    if (actionData?.blocked) {
      setShowUpgradeModal(true);
    }
  }, [actionData]);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const currentSaveCount = parseInt(form.saveCount || 0);
  const isFreePlan = plan === "FREE";
  const savesUsed = isFreePlan ? currentSaveCount : null;
  const savesMax = isFreePlan ? 2 : null;
  const isSaveBlocked = isFreePlan && currentSaveCount >= 2;

  const handleSave = () => {
    if (isSaveBlocked) {
      setShowUpgradeModal(true);
      return;
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (!["id", "shop", "createdAt", "updatedAt"].includes(k)) fd.append(k, v);
    });
    submit(fd, { method: "POST" });
  };

  const icons = ICON_MAP(form.customLauncherImg);

  const handleLauncherUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setForm(p => ({ ...p, customLauncherImg: reader.result, launcherIcon: "custom" }));
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ background:"#F3F4F6", minHeight:"100vh", display:"flex", flexDirection:"column", fontFamily:"Inter, sans-serif" }}>

      {/* ✅ UPGRADE MODAL */}
      {showUpgradeModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:20, padding:40, maxWidth:440, width:"90%", textAlign:"center", boxShadow:"0 24px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:64, marginBottom:16 }}>🔒</div>
            <h2 style={{ fontSize:22, fontWeight:800, color:"#111827", margin:"0 0 10px 0" }}>Save Limit Reached</h2>
            <p style={{ fontSize:15, color:"#6b7280", lineHeight:1.7, margin:"0 0 10px 0" }}>
              You've used <strong>{savesMax}/{savesMax}</strong> saves on the <strong>Free</strong> plan.
            </p>
            <p style={{ fontSize:14, color:"#6b7280", lineHeight:1.6, margin:"0 0 28px 0" }}>
              Upgrade to <strong>Standard</strong> or <strong>Premium</strong> to save unlimited widget customizations.
            </p>
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              <a href="/app/subscription" style={{ padding:"12px 28px", background:"linear-gradient(135deg,#f97316,#ea580c)", color:"#fff", borderRadius:11, fontWeight:700, fontSize:15, textDecoration:"none", boxShadow:"0 6px 20px rgba(249,115,22,.4)" }}>
                ⚡ Upgrade Now
              </a>
              <button onClick={() => setShowUpgradeModal(false)} style={{ padding:"12px 22px", background:"#f3f4f6", border:"none", borderRadius:11, fontWeight:600, fontSize:14, cursor:"pointer", color:"#6b7280" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP NAV ── */}
      <div style={{ background:"#FFF", borderBottom:"1px solid #E5E7EB", padding:"0 40px", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", maxWidth:"1400px", margin:"0 auto" }}>
          <div style={{ display:"flex" }}>
            {["style","content","typography","status"].map(tab => (
              <div key={tab} onClick={() => setTab(tab)} style={{ padding:"20px 24px", cursor:"pointer", borderBottom: activeTab===tab ? "3px solid #111827" : "3px solid transparent", fontWeight: activeTab===tab ? "700" : "500", fontSize:"15px", color: activeTab===tab ? "#111827" : "#6B7280", transition:"all .2s", textTransform:"capitalize" }}>
                {tab === "style" ? "Appearance" : tab === "status" ? "Online Status" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </div>
            ))}
          </div>

          {/* ✅ SAVE BUTTON with limit indicator */}
          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"16px 0" }}>
            {isFreePlan && (
              <div style={{ fontSize:13, fontWeight:600, color: isSaveBlocked ? "#dc2626" : "#6b7280", background: isSaveBlocked ? "#fef2f2" : "#f9fafb", padding:"6px 12px", borderRadius:8, border: `1px solid ${isSaveBlocked ? "#fca5a5" : "#e5e7eb"}` }}>
                {isSaveBlocked ? "🔒 Save limit reached" : `💾 ${savesUsed}/${savesMax} saves used`}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={navigation.state === "submitting"}
              title={isSaveBlocked ? "Upgrade to save more customizations" : "Save & Publish"}
              style={{
                padding:"10px 24px",
                background: isSaveBlocked ? "#9ca3af" : "#111827",
                color:"#FFF", borderRadius:"8px", fontWeight:"600",
                cursor: isSaveBlocked ? "not-allowed" : "pointer",
                border:"none", opacity: isSaveBlocked ? 0.7 : 1,
                display:"flex", alignItems:"center", gap:8
              }}
            >
              {isSaveBlocked ? "🔒 Upgrade to Save" : navigation.state === "submitting" ? "Syncing…" : "Save & Publish"}
            </button>
          </div>
        </div>
      </div>

      {/* ✅ FREE PLAN LIMIT WARNING BAR */}
      {isFreePlan && !isSaveBlocked && savesUsed >= 1 && (
        <div style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)", borderBottom:"2px solid #fcd34d", padding:"10px 40px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#92400e" }}>
            ⚠️ You have <strong>{savesMax - savesUsed} save{savesMax - savesUsed === 1 ? "" : "s"}</strong> remaining on the Free plan. After that, Save & Publish will be disabled.
          </div>
          <a href="/app/subscription" style={{ fontSize:12, fontWeight:700, color:"#f97316", padding:"5px 12px", border:"1.5px solid #fb923c", borderRadius:8, background:"#fff", textDecoration:"none" }}>Upgrade →</a>
        </div>
      )}

      {/* ✅ BLOCKED BANNER */}
      {isSaveBlocked && (
        <div style={{ background:"linear-gradient(135deg,#fef2f2,#fee2e2)", borderBottom:"2px solid #fca5a5", padding:"10px 40px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#991b1b" }}>
            🔒 Save limit reached. You've used all <strong>{savesMax}</strong> saves on the Free plan. Upgrade to continue customizing.
          </div>
          <a href="/app/subscription" style={{ fontSize:12, fontWeight:700, color:"#fff", padding:"6px 14px", borderRadius:8, background:"linear-gradient(135deg,#f97316,#ea580c)", textDecoration:"none" }}>⚡ Upgrade Now</a>
        </div>
      )}

      <div style={{ display:"flex", flex:1 }}>
        {/* ── LEFT PANEL ── */}
        <div style={{ flex:1, padding:"40px 50px", maxWidth:"750px", overflowY:"auto", height:"calc(100vh - 73px)" }}>

          {activeTab === "style" && (
            <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
              <Card title="Launcher Icon">
                <div style={{ display:"flex", alignItems:"center", gap:"14px", flexWrap:"wrap" }}>
                  <div style={{ display:"flex", gap:"10px" }}>
                    {["bubble","send","defaultCustom"].map(k => (
                      <IconButton key={k} active={form.launcherIcon === k} onClick={() => set("launcherIcon", k)}>{icons[k]}</IconButton>
                    ))}
                    {form.customLauncherImg && <IconButton active={form.launcherIcon === "custom"} onClick={() => set("launcherIcon", "custom")}>{icons.custom}</IconButton>}
                  </div>
                  <label style={{ padding:"10px 16px", background:"#FFF", border:"1px solid #D1D5DB", borderRadius:"10px", cursor:"pointer", fontSize:"13px", fontWeight:"600" }}>
                    Upload Custom<input type="file" accept="image/*" onChange={handleLauncherUpload} style={{ display:"none" }} />
                  </label>
                </div>
              </Card>
              <Card title="Header Gradient">
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"14px" }}>
                  <ColorBox label="Gradient Start" value={form.headerGradientStart} onChange={v => set("headerGradientStart", v)} />
                  <ColorBox label="Gradient End"   value={form.headerGradientEnd}   onChange={v => set("headerGradientEnd",   v)} />
                  <ColorBox label="Header Text"    value={form.headerTextColor}     onChange={v => set("headerTextColor",     v)} />
                </div>
              </Card>
              <Card title="Main Background">
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"14px" }}>
                  <ColorBox label="Primary Color"   value={form.primaryColor}      onChange={v => set("primaryColor",      v)} />
                  <ColorBox label="Page Background" value={form.chatBoxBgColor}    onChange={v => set("chatBoxBgColor",    v)} />
                  <ColorBox label="Widget Border"   value={form.widgetBorderColor} onChange={v => set("widgetBorderColor", v)} />
                </div>
              </Card>
              <Card title="Contact Card">
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"14px" }}>
                  <ColorBox label="Card Background" value={form.contactCardBgColor} onChange={v => set("contactCardBgColor", v)} />
                  <ColorBox label="Chat Button"     value={form.chatButtonBgColor}  onChange={v => set("chatButtonBgColor",  v)} />
                </div>
              </Card>
              <Card title="Text Colors">
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"14px" }}>
                  <ColorBox label="Card Title"    value={form.cardTitleColor}    onChange={v => set("cardTitleColor",    v)} />
                  <ColorBox label="Card Subtitle" value={form.cardSubtitleColor} onChange={v => set("cardSubtitleColor", v)} />
                </div>
              </Card>
            </div>
          )}

          {activeTab === "content" && (
            <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
              <Card title="Header Content">
                <Field label="Welcome Title"    value={form.welcomeText}    onChange={v => set("welcomeText",    v)} />
                <Field label="Welcome Subtitle" value={form.welcomeSubtext} onChange={v => set("welcomeSubtext", v)} />
              </Card>
              <Card title="Contact Card">
                <Field label="Card Title" value={form.startConversationText} onChange={v => set("startConversationText", v)} />
              </Card>
              <Card title="Search-here Card">
                <Field label="Title"    value={form.searchCardTitle}    onChange={v => set("searchCardTitle",    v)} />
                <Field label="Subtitle" value={form.searchCardSubtitle} onChange={v => set("searchCardSubtitle", v)} />
              </Card>
              <Card title="Onboarding">
                <Field label="Title"    value={form.onboardingTitle}    onChange={v => set("onboardingTitle",    v)} />
                <Field label="Subtitle" value={form.onboardingSubtitle} onChange={v => set("onboardingSubtitle", v)} />
              </Card>
            </div>
          )}

          {activeTab === "typography" && (
            <Card title="Fonts">
              <label style={labelStyle}>Font Family</label>
              <select value={form.fontFamily} onChange={e => set("fontFamily", e.target.value)} style={{ width:"100%", padding:"12px", borderRadius:"10px", border:"1px solid #DDD", fontSize:"14px" }}>
                {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <div style={{ marginTop:"22px" }}>
                <label style={labelStyle}>Base Font Size: {form.baseFontSize}</label>
                <input type="range" min="12" max="20" value={parseInt(form.baseFontSize)} onChange={e => set("baseFontSize", `${e.target.value}px`)} style={{ width:"100%", accentColor:"#111827" }} />
              </div>
            </Card>
          )}

          {activeTab === "status" && (
            <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
              <Card title="Status Dot Colors">
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"14px" }}>
                  <ColorBox label="Online Colour"  value={form.onlineStatusColor}  onChange={v => set("onlineStatusColor",  v)} />
                  <ColorBox label="Offline Colour" value={form.offlineStatusColor} onChange={v => set("offlineStatusColor", v)} />
                </div>
              </Card>
              <Card title="Preview – Toggle Online / Offline">
                <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                  <div onClick={() => setPreviewOnline(p => !p)} style={{ width:"52px", height:"28px", borderRadius:"14px", background: previewOnline ? form.onlineStatusColor : "#ccc", position:"relative", cursor:"pointer", transition:"background .3s" }}>
                    <div style={{ width:"22px", height:"22px", borderRadius:"50%", background:"#fff", position:"absolute", top:"3px", left: previewOnline ? "27px" : "3px", transition:"left .3s", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }} />
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <div style={{ width:"10px", height:"10px", borderRadius:"50%", background: previewOnline ? form.onlineStatusColor : form.offlineStatusColor, transition:"background .3s" }} />
                    <span style={{ fontSize:"14px", fontWeight:"600", color:"#333" }}>{previewOnline ? "We are online" : "We are offline"}</span>
                  </div>
                </div>
                <p style={{ fontSize:"12px", color:"#999", marginTop:"14px", lineHeight:"1.5" }}>The dot colour updates based on admin heartbeat. No heartbeat for 60s = offline.</p>
              </Card>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL – LIVE PREVIEW ── */}
        <div style={{ flex:1, background:"#F9FAFB", borderLeft:"1px solid #E5E7EB", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", position:"sticky", top:0, height:"100vh" }}>
          <div style={{ width:"380px", height:"680px", background: form.chatBoxBgColor, borderRadius:"24px", display:"flex", flexDirection:"column", boxShadow:"0 30px 60px -12px rgba(0,0,0,.15)", border:`1px solid ${form.widgetBorderColor}`, fontFamily: form.fontFamily, overflow:"hidden" }}>
            <div style={{ background:`linear-gradient(135deg,${form.headerGradientStart},${form.headerGradientEnd})`, color: form.headerTextColor, padding:"28px 22px 24px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <h1 style={{ fontSize:"26px", fontWeight:"700", marginBottom:"4px" }}>{form.welcomeText}</h1>
                <p style={{ fontSize:"15px", fontWeight:"400", opacity:.92 }}>{form.welcomeSubtext}</p>
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"18px 16px", display:"flex", flexDirection:"column", gap:"12px", background: form.chatBoxBgColor }}>
              <div style={{ background: form.contactCardBgColor, borderRadius:"14px", padding:"18px", boxShadow:"0 1px 4px rgba(0,0,0,.07)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
                  <strong style={{ fontSize:"16px", fontWeight:"700", color: form.cardTitleColor }}>{form.startConversationText}</strong>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    <div style={{ width:"9px", height:"9px", borderRadius:"50%", background: previewOnline ? form.onlineStatusColor : form.offlineStatusColor }} />
                    <span style={{ fontSize:"13px", color: form.cardSubtitleColor }}>{previewOnline ? "We are online" : "We are offline"}</span>
                  </div>
                </div>
                <button style={{ width:"100%", background: form.chatButtonBgColor, color:"#fff", border:"none", padding:"14px", borderRadius:"12px", fontSize:"15px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  Chat Now
                </button>
              </div>
              {["How long will it take to receive my order?","How to chat?","How long to take reply?","How long will it take to receive to my order?"].map((q, i) => (
                <div key={i} style={{ background:"#fff", padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom: i<3?"1px solid #eee":"none", borderRadius: i===0?"12px 12px 0 0":i===3?"0 0 12px 12px":"0" }}>
                  <span style={{ fontSize:"14px", fontWeight:"500", color: form.cardTitleColor, flex:1, paddingRight:"10px" }}>{q}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              ))}
            </div>
            <div style={{ height:"72px", borderTop:"1px solid #eee", display:"flex", alignItems:"center", justifyContent:"space-around", background:"#FFF" }}>
              {[{label:"Home",active:true},{label:"Message"},{label:"Search"},{label:"Help"}].map(n => (
                <div key={n.label} style={{ textAlign:"center", color: n.active ? form.primaryColor : "#aaa", opacity: n.active ? 1 : .45, fontSize:"11px", fontWeight: n.active?"700":"500" }}>{n.label}</div>
              ))}
            </div>
          </div>
          <div style={{ marginTop:"22px", width:"62px", height:"62px", borderRadius:"50%", background:"#FFF", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 10px 20px rgba(0,0,0,.1)", border:`1px solid ${form.widgetBorderColor}`, color: form.primaryColor, overflow:"hidden" }}>
            <div style={{ width:"28px", height:"28px", display:"flex", alignItems:"center", justifyContent:"center" }}>{icons[form.launcherIcon]}</div>
          </div>
        </div>
      </div>

      {toast && <Toast message="Settings Saved Successfully!" />}
    </div>
  );
}

/* ─── TINY COMPONENTS ─── */
const labelStyle = { display:"block", fontSize:"12px", fontWeight:"600", marginBottom:"8px", color:"#6B7280" };

const Card = ({ title, children }) => (
  <div style={{ background:"#FFF", padding:"24px", borderRadius:"20px", border:"1px solid #E5E7EB", marginBottom:"10px" }}>
    <h3 style={{ fontSize:"11px", fontWeight:"600", color:"#9CA3AF", marginBottom:"18px", textTransform:"uppercase", letterSpacing:".05em" }}>{title}</h3>
    {children}
  </div>
);

const IconButton = ({ children, active, onClick }) => (
  <div onClick={onClick} style={{ width:"50px", height:"50px", borderRadius:"12px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", background:"#FFF", border: active ? "2.5px solid #111827" : "1.5px solid #E5E7EB" }}>{children}</div>
);

const ColorBox = ({ label, value, onChange }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <div style={{ display:"flex", gap:"10px", alignItems:"center", background:"#F9FAFB", padding:"10px", borderRadius:"12px", border:"1px solid #E5E7EB" }}>
      <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ border:"none", background:"none", width:"28px", height:"28px", cursor:"pointer" }} />
      <span style={{ fontSize:"13px", fontWeight:"600" }}>{value?.toUpperCase()}</span>
    </div>
  </div>
);

const Field = ({ label, value, onChange }) => (
  <div style={{ marginBottom:"14px" }}>
    <label style={labelStyle}>{label}</label>
    <input type="text" value={value} onChange={e => onChange(e.target.value)} style={{ width:"100%", padding:"12px", borderRadius:"12px", border:"1px solid #E5E7EB", fontSize:"14px" }} />
  </div>
);

const Toast = ({ message }) => (
  <div style={{ position:"fixed", bottom:"30px", left:"50%", transform:"translateX(-50%)", background:"#111827", color:"#FFF", padding:"14px 28px", borderRadius:"16px", fontWeight:"600", zIndex:9999 }}>{message}</div>
);