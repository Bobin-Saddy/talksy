import { useState, useEffect } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session.shop };
};

const BASE_URL = "";

const C = {
  primary    : "#F39C12",
  primaryDark: "#E67E22",
  bg         : "#f4f6f8",
  surface    : "#ffffff",
  surface2   : "#f9fafb",
  border     : "#e5e7eb",
  text       : "#111827",
  muted      : "#6b7280",
  success    : "#16a34a",
  danger     : "#dc2626",
};

const S = {
  root: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif" },
  header: {
    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
    padding: "22px 32px", display: "flex", alignItems: "center", gap: 14,
    boxShadow: "0 2px 12px rgba(243,156,18,0.25)",
  },
  headerIcon: { width: 42, height: 42, background: "rgba(255,255,255,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 },
  headerTitle: { fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 },
  headerSub  : { fontSize: 13, color: "rgba(255,255,255,0.85)", margin: 0 },
  container  : { maxWidth: 1080, margin: "0 auto", padding: "28px 20px" },
  grid       : { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  card       : { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  cardTitle  : { fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 },
  label      : { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "block" },
  input      : { width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 13px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14 },
  textarea   : { width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 13px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 76, marginBottom: 14, fontFamily: "inherit" },
  select     : { width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 13px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14, cursor: "pointer" },
  btn        : { background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: "#fff", border: "none", borderRadius: 9, padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 2px 8px rgba(243,156,18,0.3)" },
  btnSec     : { background: C.surface2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  btnDanger  : { background: "rgba(220,38,38,0.08)", color: C.danger, border: "1px solid rgba(220,38,38,0.15)", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  statsRow   : { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 22 },
  statCard   : { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  statNum    : { fontSize: 26, fontWeight: 800, background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  statLabel  : { fontSize: 12, color: C.muted, marginTop: 3 },
  qCard      : { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 11, padding: "14px 16px", marginBottom: 10 },
  tag        : { display: "inline-block", background: "rgba(243,156,18,0.1)", border: "1px solid rgba(243,156,18,0.2)", color: C.primary, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 600, marginRight: 5, marginBottom: 3 },
  toggleRow  : { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${C.border}` },
  toggle     : (a) => ({ width: 42, height: 23, borderRadius: 12, background: a ? C.primary : "#d1d5db", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", display: "inline-block" }),
  toggleDot  : (a) => ({ position: "absolute", top: 2, left: a ? 19 : 2, width: 17, height: 17, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left 0.2s" }),
  toast      : (t) => ({ position: "fixed", top: 18, right: 18, background: t === "success" ? "#15803d" : "#b91c1c", color: "#fff", padding: "11px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 9 }),
  emptyState : { textAlign: "center", padding: "36px 16px", color: C.muted },
  divider    : { height: 1, background: C.border, margin: "16px 0" },
};

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return <div style={S.toast(type)}><span>{type === "success" ? "✅" : "❌"}</span>{msg}</div>;
}

function Toggle({ active, onChange }) {
  return (
    <div style={S.toggle(active)} onClick={() => onChange(!active)}>
      <div style={S.toggleDot(active)} />
    </div>
  );
}

export default function AnimationQuestion() {
  const { shop } = useLoaderData();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);
  const [saving, setSaving]       = useState(false);

  const [form, setForm] = useState({
    text: "", icon: "💬", category: "general", displayOrder: 0,
    isActive: true, animationType: "float", defaultAnswer: "",
  });
  const [editId, setEditId] = useState(null);

  const [settings, setSettings] = useState({
    enabled: true, maxVisible: 3, showDelay: 2000,
    autoHide: false, autoHideDelay: 8000,
  });

  const ICONS      = ["💬","🛍️","📦","🔥","✨","🤔","💡","🚀","❓","👋","💳","🎁","🔧","📞","⭐"];
  const ANIMATIONS = [
    { value:"float",  label:"Float" },
    { value:"bounce", label:"Bounce" },
    { value:"pulse",  label:"Pulse" },
    { value:"slide",  label:"Slide In" },
  ];
  const CATEGORIES = ["general","products","orders","shipping","returns","payment","support"];

  useEffect(() => { if (shop) fetchQuestions(); else setLoading(false); }, [shop]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/animated-questions?shop=${encodeURIComponent(shop)}&admin=true`);
      const d = await r.json();
      setQuestions(d.questions || []);
      if (d.settings) setSettings(s => ({ ...s, ...d.settings }));
    } catch (_) { showToast("Failed to load questions", "error"); }
    finally { setLoading(false); }
  };

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const handleSave = async () => {
    if (!form.text.trim()) return showToast("Question text is required", "error");
    setSaving(true);
    try {
      const res = await fetch(
        editId ? `${BASE_URL}/api/animated-questions/${editId}` : `${BASE_URL}/api/animated-questions`,
        { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, shop }) }
      );
      if (res.ok) { showToast(editId ? "Updated!" : "Created!"); resetForm(); fetchQuestions(); }
      else { const e = await res.json(); showToast(e.message || "Save failed", "error"); }
    } catch (_) { showToast("Connection error", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this question?")) return;
    try {
      await fetch(`${BASE_URL}/api/animated-questions/${id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shop })
      });
      showToast("Deleted!"); fetchQuestions();
    } catch (_) { showToast("Delete failed", "error"); }
  };

  const handleToggle = async (q) => {
    try {
      await fetch(`${BASE_URL}/api/animated-questions/${q.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...q, shop, isActive: !q.isActive })
      });
      fetchQuestions();
    } catch (_) { showToast("Update failed", "error"); }
  };

  const handleEdit = (q) => {
    setEditId(q.id);
    setForm({ text: q.text, icon: q.icon||"💬", category: q.category||"general", displayOrder: q.displayOrder||0, isActive: q.isActive!==false, animationType: q.animationType||"float", defaultAnswer: q.defaultAnswer||"" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ text:"", icon:"💬", category:"general", displayOrder:0, isActive:true, animationType:"float", defaultAnswer:"" });
  };

  const saveSettings = async () => {
    try {
      await fetch(`${BASE_URL}/api/animated-questions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, action: "settings", settings })
      });
      showToast("Settings saved!");
    } catch (_) { showToast("Failed", "error"); }
  };

  const activeCount = questions.filter(q => q.isActive).length;
  const totalClicks = questions.reduce((a, q) => a + (q.clickCount || 0), 0);
  const previewItems = form.text
    ? [{ text: form.text, icon: form.icon }]
    : questions.filter(q => q.isActive).slice(0, 3).map(q => ({ text: q.text, icon: q.icon || "💬" }));

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes floatUp { 0%{transform:translateY(0)} 100%{transform:translateY(-7px)} }
        @keyframes slideIn { from{transform:translateX(16px);opacity:0} to{transform:translateX(0);opacity:1} }
        input:focus, textarea:focus, select:focus { border-color: ${C.primary} !important; box-shadow: 0 0 0 3px rgba(243,156,18,0.12); }
        .q-card:hover { border-color: ${C.primary} !important; background: #fffbf2 !important; }
        .btn-p:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(243,156,18,0.4) !important; }
        .bubble-anim { animation: floatUp 2.2s ease-in-out infinite alternate; }
        .bubble-anim:nth-child(2) { animation-delay: 0.55s; }
        .bubble-anim:nth-child(3) { animation-delay: 1.1s; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerIcon}>✨</div>
        <div>
          <h1 style={S.headerTitle}>Animated Questions</h1>
          <p style={S.headerSub}>Show floating bubbles above the chat launcher to engage visitors</p>
        </div>
        {shop && (
          <div style={{ marginLeft:"auto", fontSize:12, color:"rgba(255,255,255,0.85)", background:"rgba(255,255,255,0.15)", padding:"5px 13px", borderRadius:20 }}>
            🏪 {shop}
          </div>
        )}
      </div>

      <div style={S.container}>

        {/* Stats */}
        <div style={S.statsRow}>
          {[
            { num: questions.length, label: "Total Questions" },
            { num: activeCount,      label: "Active" },
            { num: totalClicks,      label: "Total Clicks" },
          ].map(s => (
            <div key={s.label} style={S.statCard}>
              <div style={S.statNum}>{s.num}</div>
              <div style={S.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={S.grid}>

          {/* ── LEFT COLUMN ── */}
          <div>

            {/* Form */}
            <div style={S.card}>
              <div style={S.cardTitle}>
                <span>{editId ? "✏️" : "➕"}</span>
                {editId ? "Edit Question" : "Add New Question"}
                {editId && (
                  <button onClick={resetForm} style={{ ...S.btnSec, marginLeft:"auto", padding:"4px 12px", fontSize:12 }}>Cancel</button>
                )}
              </div>

              <label style={S.label}>Question Text *</label>
              <input
                style={S.input}
                placeholder="e.g. Where is my order? 🤔"
                value={form.text}
                onChange={e => setForm({ ...form, text: e.target.value })}
                maxLength={80}
              />
              <div style={{ fontSize:11, color:C.muted, marginTop:-10, marginBottom:14, textAlign:"right" }}>{form.text.length}/80</div>

              <label style={S.label}>Auto Reply (optional)</label>
              <textarea
                style={S.textarea}
                placeholder="Bot will send this reply automatically when user clicks this question. Leave empty and admin will reply manually."
                value={form.defaultAnswer}
                onChange={e => setForm({ ...form, defaultAnswer: e.target.value })}
              />

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={S.label}>Icon</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:14 }}>
                    {ICONS.map(ic => (
                      <button key={ic} onClick={() => setForm({ ...form, icon: ic })} style={{
                        width:34, height:34, fontSize:17, cursor:"pointer", borderRadius:7,
                        background: form.icon===ic ? "rgba(243,156,18,0.12)" : C.surface2,
                        border: form.icon===ic ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`,
                        transition:"all 0.15s",
                      }}>{ic}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={S.label}>Animation</label>
                  <select style={S.select} value={form.animationType} onChange={e => setForm({ ...form, animationType: e.target.value })}>
                    {ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                  <label style={S.label}>Category</label>
                  <select style={S.select} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", marginBottom:14, borderTop:`1px solid ${C.border}` }}>
                <span style={{ fontSize:14, color:C.muted }}>Show on launcher</span>
                <Toggle active={form.isActive} onChange={v => setForm({ ...form, isActive: v })} />
              </div>

              <button className="btn-p" style={S.btn} onClick={handleSave} disabled={saving}>
                {saving ? "⏳ Saving…" : editId ? "💾 Update" : "✨ Add Question"}
              </button>
            </div>

            {/* Settings */}
            <div style={{ ...S.card, marginTop:18 }}>
              <div style={S.cardTitle}>⚙️ Display Settings</div>

              <div style={S.toggleRow}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:C.text }}>Enable Animated Questions</div>
                  <div style={{ fontSize:12, color:C.muted }}>Show floating bubbles on storefront</div>
                </div>
                <Toggle active={settings.enabled} onChange={v => setSettings({ ...settings, enabled: v })} />
              </div>

              <div style={{ ...S.toggleRow, borderBottom:"none" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:C.text }}>Auto-hide Bubbles</div>
                  <div style={{ fontSize:12, color:C.muted }}>Hide after {settings.autoHideDelay/1000}s (recommended: OFF)</div>
                </div>
                <Toggle active={settings.autoHide} onChange={v => setSettings({ ...settings, autoHide: v })} />
              </div>

              <div style={{ marginTop:16 }}>
                <label style={S.label}>Max Visible Bubbles: <strong style={{ color:C.primary }}>{settings.maxVisible}</strong></label>
                <input type="range" min={1} max={5} value={settings.maxVisible}
                  onChange={e => setSettings({ ...settings, maxVisible: +e.target.value })}
                  style={{ width:"100%", accentColor:C.primary, marginBottom:14 }} />

                <label style={S.label}>Show Delay: <strong style={{ color:C.primary }}>{settings.showDelay/1000}s</strong></label>
                <input type="range" min={0} max={10000} step={500} value={settings.showDelay}
                  onChange={e => setSettings({ ...settings, showDelay: +e.target.value })}
                  style={{ width:"100%", accentColor:C.primary, marginBottom:16 }} />
              </div>

              <button className="btn-p" style={S.btn} onClick={saveSettings}>
                💾 Save Settings
              </button>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div>

            {/* Preview */}
            <div style={S.card}>
              <div style={S.cardTitle}>👁️ Live Preview</div>
              <div style={{
                background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                border: `1px solid ${C.border}`,
                borderRadius: 12, padding:"28px 18px",
                display:"flex", flexDirection:"column", alignItems:"flex-end",
                minHeight:200, position:"relative", overflow:"hidden",
              }}>
                {/* decorative bg */}
                <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at 70% 85%, rgba(243,156,18,0.07), transparent 55%)", pointerEvents:"none" }} />

                {previewItems.length === 0 ? (
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontSize:13 }}>
                    Add a question to preview
                  </div>
                ) : (
                  previewItems.map((item, i) => (
                    <div key={i} className="bubble-anim" style={{
                      background:"#fff", color:"#1e293b",
                      borderRadius:"18px 18px 4px 18px",
                      padding:"9px 13px", fontSize:12, fontWeight:500,
                      boxShadow:"0 3px 12px rgba(0,0,0,0.1)",
                      border:"1px solid #e8e8e8",
                      maxWidth:200, display:"flex", alignItems:"center",
                      gap:7, marginBottom:8,
                    }}>
                      <span style={{ fontSize:15 }}>{item.icon}</span>
                      <span>{item.text.substring(0,32)}{item.text.length>32?"…":""}</span>
                    </div>
                  ))
                )}

                {/* Launcher */}
                <div style={{ width:48, height:48, borderRadius:"50%", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(0,0,0,0.15)", marginTop:10, alignSelf:"flex-end" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div style={{ position:"absolute", bottom:10, left:14, fontSize:11, color:C.muted }}>
                  Preview — bubbles appear above launcher
                </div>
              </div>

              {/* How it works */}
              <div style={{ marginTop:14, padding:13, background:"rgba(243,156,18,0.06)", borderRadius:9, border:"1px solid rgba(243,156,18,0.15)" }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.primary, marginBottom:7 }}>💡 How It Works</div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.75 }}>
                  1️⃣ Bubbles float above chat launcher<br/>
                  2️⃣ User clicks → chat opens + question sent<br/>
                  3️⃣ Auto Reply set → instant bot response<br/>
                  4️⃣ No auto reply → "Thanks for reaching out" + admin notified
                </div>
              </div>
            </div>

            {/* Questions List */}
            <div style={{ ...S.card, marginTop:18 }}>
              <div style={S.cardTitle}>
                📋 All Questions
                <span style={{ marginLeft:"auto", background:"rgba(243,156,18,0.1)", border:"1px solid rgba(243,156,18,0.2)", color:C.primary, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                  {questions.length}
                </span>
              </div>

              {loading ? (
                <div style={S.emptyState}><div style={{ fontSize:28, marginBottom:8 }}>⏳</div><p>Loading…</p></div>
              ) : questions.length === 0 ? (
                <div style={S.emptyState}>
                  <div style={{ fontSize:36, marginBottom:10 }}>✨</div>
                  <p style={{ fontWeight:600, color:C.text }}>No questions yet</p>
                  <p style={{ fontSize:13 }}>Create your first animated question above</p>
                </div>
              ) : (
                questions.map(q => (
                  <div key={q.id} className="q-card" style={{ ...S.qCard, transition:"all 0.18s" }}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:11 }}>
                      <div style={{ width:36, height:36, background:"rgba(243,156,18,0.1)", border:"1px solid rgba(243,156,18,0.2)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>
                        {q.icon||"💬"}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:600, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:C.text }}>
                          {q.text}
                        </div>
                        <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                          <span style={S.tag}>{q.category||"general"}</span>
                          <span style={S.tag}>🎬 {q.animationType||"float"}</span>
                          {q.clickCount > 0 && <span style={{ fontSize:11, color:C.muted }}>👆 {q.clickCount}</span>}
                        </div>
                        {q.defaultAnswer && (
                          <div style={{ fontSize:11, color:C.muted, marginTop:6, padding:"5px 9px", background:"#fff", borderRadius:6, borderLeft:`2px solid ${C.primary}` }}>
                            🤖 {q.defaultAnswer.substring(0,55)}{q.defaultAnswer.length>55?"…":""}
                          </div>
                        )}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:7, flexShrink:0 }}>
                        <Toggle active={q.isActive!==false} onChange={() => handleToggle(q)} />
                        <div style={{ display:"flex", gap:5 }}>
                          <button onClick={() => handleEdit(q)} style={{ ...S.btnSec, padding:"4px 9px", fontSize:12 }}>✏️</button>
                          <button onClick={() => handleDelete(q.id)} style={S.btnDanger}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}