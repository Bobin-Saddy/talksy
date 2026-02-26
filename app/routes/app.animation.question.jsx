import { useState, useEffect } from "react";

const BASE_URL = "";

// ── Color palette inspired by Talksy's orange brand ──
const COLORS = {
  primary: "#F39C12",
  primaryDark: "#E67E22",
  bg: "#0f0f0f",
  surface: "#1a1a1a",
  surface2: "#232323",
  border: "#2e2e2e",
  text: "#f0f0f0",
  muted: "#888",
  success: "#22c55e",
  danger: "#ef4444",
};

const styles = {
  root: {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
    padding: "0",
  },
  header: {
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    padding: "24px 32px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    boxShadow: "0 4px 20px rgba(243,156,18,0.3)",
  },
  headerIcon: {
    width: 44,
    height: 44,
    background: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#fff",
    margin: 0,
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    margin: 0,
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "32px 24px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
  },
  card: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: 24,
    position: "relative",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 8,
    display: "block",
  },
  input: {
    width: "100%",
    background: COLORS.surface2,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: "11px 14px",
    color: COLORS.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
    marginBottom: 16,
  },
  textarea: {
    width: "100%",
    background: COLORS.surface2,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: "11px 14px",
    color: COLORS.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 80,
    transition: "border-color 0.2s",
    marginBottom: 16,
    fontFamily: "inherit",
  },
  select: {
    width: "100%",
    background: COLORS.surface2,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: "11px 14px",
    color: COLORS.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 16,
    appearance: "none",
    cursor: "pointer",
  },
  btn: {
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 22px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 3px 12px rgba(243,156,18,0.3)",
  },
  btnSecondary: {
    background: COLORS.surface2,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "background 0.15s",
  },
  btnDanger: {
    background: "rgba(239,68,68,0.1)",
    color: COLORS.danger,
    border: `1px solid rgba(239,68,68,0.2)`,
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  badge: (color) => ({
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    background: color === "green" ? "rgba(34,197,94,0.15)" : color === "orange" ? "rgba(243,156,18,0.15)" : "rgba(99,102,241,0.15)",
    color: color === "green" ? COLORS.success : color === "orange" ? COLORS.primary : "#818cf8",
    border: `1px solid ${color === "green" ? "rgba(34,197,94,0.25)" : color === "orange" ? "rgba(243,156,18,0.25)" : "rgba(99,102,241,0.25)"}`,
  }),
  questionCard: {
    background: COLORS.surface2,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: "16px 18px",
    marginBottom: 12,
    position: "relative",
    transition: "border-color 0.2s",
  },
  previewBubble: {
    position: "absolute",
    bottom: 90,
    right: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "flex-end",
    pointerEvents: "none",
  },
  previewBubbleItem: {
    background: "#fff",
    color: "#1e293b",
    borderRadius: "18px 18px 4px 18px",
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 500,
    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
    border: "1px solid #eee",
    maxWidth: 200,
    display: "flex",
    alignItems: "center",
    gap: 8,
    animation: "floatUp 2s ease-in-out infinite alternate",
  },
  launcherPreview: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
    marginTop: 12,
    alignSelf: "flex-end",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: "16px 20px",
    textAlign: "center",
  },
  statNum: {
    fontSize: 28,
    fontWeight: 800,
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },
  divider: {
    height: 1,
    background: COLORS.border,
    margin: "20px 0",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    color: COLORS.muted,
  },
  tag: {
    display: "inline-block",
    background: "rgba(243,156,18,0.1)",
    border: "1px solid rgba(243,156,18,0.25)",
    color: COLORS.primary,
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 600,
    marginRight: 6,
    marginBottom: 4,
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: `1px solid ${COLORS.border}`,
  },
  toggle: (active) => ({
    width: 44,
    height: 24,
    borderRadius: 12,
    background: active ? COLORS.primary : COLORS.surface2,
    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    cursor: "pointer",
    position: "relative",
    transition: "background 0.2s, border-color 0.2s",
    display: "inline-block",
  }),
  toggleDot: (active) => ({
    position: "absolute",
    top: 2,
    left: active ? 20 : 2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
    transition: "left 0.2s",
  }),
  toast: (type) => ({
    position: "fixed",
    top: 20,
    right: 20,
    background: type === "success" ? "#166534" : "#7f1d1d",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    animation: "slideIn 0.3s ease",
  }),
};

// ── Toast Component ──
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={styles.toast(type)}>
      <span>{type === "success" ? "✅" : "❌"}</span>
      {msg}
    </div>
  );
}

// ── Toggle Switch ──
function Toggle({ active, onChange }) {
  return (
    <div style={styles.toggle(active)} onClick={() => onChange(!active)}>
      <div style={styles.toggleDot(active)} />
    </div>
  );
}

// ── Main Page ──
export default function AnimationQuestion() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [shop, setShop] = useState("");

  // Form state
  const [form, setForm] = useState({
    text: "",
    icon: "💬",
    category: "general",
    displayOrder: 0,
    isActive: true,
    animationType: "float", // float | bounce | pulse | slide
    defaultAnswer: "", // Pre-filled answer from admin
  });

  // Edit state
  const [editId, setEditId] = useState(null);

  // Global settings
  const [globalSettings, setGlobalSettings] = useState({
    enabled: true,
    maxVisible: 3,
    showDelay: 2000,
    autoHide: true,
    autoHideDelay: 8000,
  });

  const ICONS = ["💬", "🛍️", "📦", "🔥", "✨", "🤔", "💡", "🚀", "❓", "👋", "💳", "🎁", "🔧", "📞", "⭐"];
  const ANIMATIONS = [
    { value: "float", label: "Float (Bounce Up/Down)" },
    { value: "bounce", label: "Bounce (Spring)" },
    { value: "pulse", label: "Pulse (Glow)" },
    { value: "slide", label: "Slide In" },
  ];
  const CATEGORIES = ["general", "products", "orders", "shipping", "returns", "payment", "support"];

  useEffect(() => {
    // Get shop from URL params or localStorage
    const params = new URLSearchParams(window.location.search);
    const s = params.get("shop") || localStorage.getItem("talksy_shop") || "";
    setShop(s);
    if (s) fetchQuestions(s);
    else setLoading(false);
  }, []);

  const fetchQuestions = async (s) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/animated-questions?shop=${s}`);
      const data = await res.json();
      setQuestions(data.questions || []);
      if (data.settings) setGlobalSettings(data.settings);
    } catch (e) {
      showToast("Failed to load questions", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const handleSave = async () => {
    if (!form.text.trim()) return showToast("Question text is required", "error");
    if (!shop) return showToast("Shop not found. Please refresh.", "error");

    setSaving(true);
    try {
      const endpoint = editId
        ? `${BASE_URL}/api/animated-questions/${editId}`
        : `${BASE_URL}/api/animated-questions`;
      const method = editId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, shop }),
      });

      if (res.ok) {
        showToast(editId ? "Question updated!" : "Question created!");
        resetForm();
        fetchQuestions(shop);
      } else {
        const err = await res.json();
        showToast(err.message || "Save failed", "error");
      }
    } catch (e) {
      showToast("Connection error", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this question?")) return;
    try {
      await fetch(`${BASE_URL}/api/animated-questions/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop }),
      });
      showToast("Deleted!");
      fetchQuestions(shop);
    } catch (_) {
      showToast("Delete failed", "error");
    }
  };

  const handleToggleActive = async (q) => {
    try {
      await fetch(`${BASE_URL}/api/animated-questions/${q.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...q, shop, isActive: !q.isActive }),
      });
      fetchQuestions(shop);
    } catch (_) {
      showToast("Update failed", "error");
    }
  };

  const handleEdit = (q) => {
    setEditId(q.id);
    setForm({
      text: q.text,
      icon: q.icon || "💬",
      category: q.category || "general",
      displayOrder: q.displayOrder || 0,
      isActive: q.isActive !== false,
      animationType: q.animationType || "float",
      defaultAnswer: q.defaultAnswer || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ text: "", icon: "💬", category: "general", displayOrder: 0, isActive: true, animationType: "float", defaultAnswer: "" });
  };

  const saveGlobalSettings = async () => {
    try {
      await fetch(`${BASE_URL}/api/animated-questions/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, settings: globalSettings }),
      });
      showToast("Settings saved!");
    } catch (_) {
      showToast("Failed to save settings", "error");
    }
  };

  const activeCount = questions.filter((q) => q.isActive).length;
  const totalClicks = questions.reduce((a, q) => a + (q.clickCount || 0), 0);

  return (
    <div style={styles.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes floatUp {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-8px); }
        }
        @keyframes slideIn {
          from { transform: translateX(20px); opacity:0; }
          to { transform: translateX(0); opacity:1; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(243,156,18,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(243,156,18,0); }
        }
        input:focus, textarea:focus, select:focus {
          border-color: ${COLORS.primary} !important;
          box-shadow: 0 0 0 3px rgba(243,156,18,0.15);
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(243,156,18,0.4) !important; }
        .btn-secondary:hover { background: ${COLORS.border} !important; }
        .q-card:hover { border-color: ${COLORS.primary} !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${COLORS.surface}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 2px; }
        .icon-btn:hover { background: rgba(243,156,18,0.15) !important; }
        .bubble-animated {
          animation: floatUp 2s ease-in-out infinite alternate;
        }
        .bubble-animated:nth-child(2) { animation-delay: 0.6s; }
        .bubble-animated:nth-child(3) { animation-delay: 1.2s; }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>✨</div>
        <div>
          <h1 style={styles.headerTitle}>Animated Questions</h1>
          <p style={styles.headerSub}>
            Show floating questions above the chat launcher to engage visitors
          </p>
        </div>
        {shop && (
          <div style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.1)", padding: "6px 14px", borderRadius: 20 }}>
            🏪 {shop}
          </div>
        )}
      </div>

      <div style={styles.container}>

        {/* ── Stats Row ── */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{questions.length}</div>
            <div style={styles.statLabel}>Total Questions</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{activeCount}</div>
            <div style={styles.statLabel}>Active Questions</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{totalClicks}</div>
            <div style={styles.statLabel}>Total Clicks</div>
          </div>
        </div>

        <div style={styles.grid}>
          {/* ── Left: Form + Preview ── */}
          <div>
            {/* Form Card */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>
                <span>{editId ? "✏️" : "➕"}</span>
                {editId ? "Edit Question" : "Create New Question"}
                {editId && (
                  <button onClick={resetForm} style={{ ...styles.btnSecondary, marginLeft: "auto", fontSize: 12, padding: "4px 12px" }}>
                    Cancel
                  </button>
                )}
              </div>

              <label style={styles.label}>Question Text *</label>
              <input
                style={styles.input}
                placeholder="e.g. Where is my order? 🤔"
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                maxLength={80}
              />
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: -12, marginBottom: 16, textAlign: "right" }}>
                {form.text.length}/80
              </div>

              <label style={styles.label}>Pre-filled Answer (Admin)</label>
              <textarea
                style={styles.textarea}
                placeholder="Enter the automatic answer that will be sent when admin responds... Leave empty to require manual reply."
                value={form.defaultAnswer}
                onChange={(e) => setForm({ ...form, defaultAnswer: e.target.value })}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={styles.label}>Icon</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                    {ICONS.map((ic) => (
                      <button
                        key={ic}
                        className="icon-btn"
                        onClick={() => setForm({ ...form, icon: ic })}
                        style={{
                          width: 36, height: 36, fontSize: 18, border: "none", cursor: "pointer",
                          borderRadius: 8, background: form.icon === ic ? "rgba(243,156,18,0.2)" : COLORS.surface2,
                          border: form.icon === ic ? `1.5px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
                          transition: "all 0.15s",
                        }}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={styles.label}>Animation</label>
                  <select style={styles.select} value={form.animationType} onChange={(e) => setForm({ ...form, animationType: e.target.value })}>
                    {ANIMATIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>

                  <label style={styles.label}>Category</label>
                  <select style={styles.select} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", marginBottom: 16 }}>
                <span style={{ fontSize: 14, color: COLORS.muted }}>Show on launcher</span>
                <Toggle active={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
              </div>

              <button className="btn-primary" style={styles.btn} onClick={handleSave} disabled={saving}>
                {saving ? "⏳ Saving…" : editId ? "💾 Update Question" : "✨ Create Question"}
              </button>
            </div>

            {/* ── Global Settings Card ── */}
            <div style={{ ...styles.card, marginTop: 20 }}>
              <div style={styles.cardTitle}>⚙️ Display Settings</div>

              <div style={styles.toggleRow}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Enable Animated Questions</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>Show floating questions above launcher</div>
                </div>
                <Toggle active={globalSettings.enabled} onChange={(v) => setGlobalSettings({ ...globalSettings, enabled: v })} />
              </div>

              <div style={{ ...styles.toggleRow }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Auto-hide After Delay</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>Hide bubbles after {globalSettings.autoHideDelay / 1000}s</div>
                </div>
                <Toggle active={globalSettings.autoHide} onChange={(v) => setGlobalSettings({ ...globalSettings, autoHide: v })} />
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={styles.label}>Max Visible Bubbles: {globalSettings.maxVisible}</label>
                <input type="range" min={1} max={5} value={globalSettings.maxVisible}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, maxVisible: +e.target.value })}
                  style={{ width: "100%", accentColor: COLORS.primary }} />
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={styles.label}>Show Delay: {globalSettings.showDelay / 1000}s</label>
                <input type="range" min={0} max={10000} step={500} value={globalSettings.showDelay}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, showDelay: +e.target.value })}
                  style={{ width: "100%", accentColor: COLORS.primary }} />
              </div>

              <div style={{ marginTop: 16 }}>
                <button className="btn-primary" style={styles.btn} onClick={saveGlobalSettings}>
                  💾 Save Settings
                </button>
              </div>
            </div>
          </div>

          {/* ── Right: Preview + Questions List ── */}
          <div>
            {/* Live Preview */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>👁️ Live Preview</div>
              <div style={{
                background: "#0a0a0a",
                borderRadius: 12,
                padding: "30px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                minHeight: 220,
                position: "relative",
                overflow: "hidden",
                border: `1px solid ${COLORS.border}`,
              }}>
                {/* Background gradient */}
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 80%, rgba(243,156,18,0.08), transparent 60%)", pointerEvents: "none" }} />

                {/* Preview bubbles */}
                {(form.text ? [{ text: form.text, icon: form.icon }] : questions.filter(q => q.isActive).slice(0, 3).map(q => ({ text: q.text, icon: q.icon || "💬" }))).map((item, i) => (
                  <div key={i} className="bubble-animated" style={{
                    ...styles.previewBubbleItem,
                    animationDelay: `${i * 0.5}s`,
                    marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    <span style={{ fontSize: 12 }}>{item.text.substring(0, 35)}{item.text.length > 35 ? "…" : ""}</span>
                  </div>
                ))}

                {/* Launcher button preview */}
                <div style={styles.launcherPreview}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>

                <div style={{ position: "absolute", bottom: 12, left: 16, fontSize: 11, color: COLORS.muted }}>
                  Preview — bubbles appear above launcher
                </div>
              </div>

              {/* How it works */}
              <div style={{ marginTop: 16, padding: 14, background: "rgba(243,156,18,0.06)", borderRadius: 10, border: `1px solid rgba(243,156,18,0.15)` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.primary, marginBottom: 8 }}>💡 How It Works</div>
                <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.7 }}>
                  1️⃣ Questions float above launcher<br/>
                  2️⃣ User clicks → opens chat + sends question<br/>
                  3️⃣ If defaultAnswer set → auto-sends to user<br/>
                  4️⃣ Admin gets notification + can reply manually
                </div>
              </div>
            </div>

            {/* Questions List */}
            <div style={{ ...styles.card, marginTop: 20 }}>
              <div style={styles.cardTitle}>
                📋 All Questions
                <span style={{ ...styles.badge("orange"), marginLeft: "auto", fontSize: 11 }}>
                  {questions.length} total
                </span>
              </div>

              {loading ? (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <p>Loading questions…</p>
                </div>
              ) : questions.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
                  <p style={{ fontWeight: 600 }}>No questions yet</p>
                  <p style={{ fontSize: 13 }}>Create your first animated question above</p>
                </div>
              ) : (
                questions.map((q) => (
                  <div key={q.id} className="q-card" style={styles.questionCard}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Icon */}
                      <div style={{
                        width: 38, height: 38, background: "rgba(243,156,18,0.1)",
                        border: "1px solid rgba(243,156,18,0.2)", borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0
                      }}>
                        {q.icon || "💬"}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {q.text}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={styles.tag}>{q.category || "general"}</span>
                          <span style={styles.tag}>🎬 {q.animationType || "float"}</span>
                          {q.clickCount > 0 && (
                            <span style={{ fontSize: 11, color: COLORS.muted }}>👆 {q.clickCount} clicks</span>
                          )}
                        </div>
                        {q.defaultAnswer && (
                          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6, padding: "6px 10px", background: COLORS.bg, borderRadius: 6, borderLeft: `2px solid ${COLORS.primary}` }}>
                            🤖 Auto: {q.defaultAnswer.substring(0, 60)}{q.defaultAnswer.length > 60 ? "…" : ""}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                        <Toggle active={q.isActive !== false} onChange={() => handleToggleActive(q)} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => handleEdit(q)}
                            style={{ ...styles.btnSecondary, padding: "5px 10px", fontSize: 12 }}
                            className="btn-secondary"
                          >
                            ✏️
                          </button>
                          <button onClick={() => handleDelete(q.id)} style={styles.btnDanger}>
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Integration Guide ── */}
            <div style={{ ...styles.card, marginTop: 20 }}>
              <div style={styles.cardTitle}>🔌 Frontend Integration</div>
              <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.7 }}>
                Add this API call in your chat widget JS to fetch active questions:
              </div>
              <div style={{
                background: "#0a0a0a", borderRadius: 8, padding: "12px 14px",
                fontFamily: "monospace", fontSize: 12, color: "#86efac",
                marginTop: 10, border: `1px solid ${COLORS.border}`, overflowX: "auto",
                lineHeight: 1.8,
              }}>
                {`fetch(\`\${BASE_URL}/api/animated-questions?shop=\${shop}\`)\n  .then(r => r.json())\n  .then(d => showAnimatedBubbles(d.questions));`}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: COLORS.muted }}>
                📌 Questions auto-send to chat when clicked. If <code style={{ color: COLORS.primary }}>defaultAnswer</code> is set, it's sent as bot reply instantly. Admin gets notified either way.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}