// app/routes/apps.faq-page.jsx
// This is the PUBLIC FAQ page that customers will see
import { json } from "@remix-run/node";
import { useLoaderData } from "react-router";
import prisma from "../db.server";

export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400 });
  }

  try {
    // Load settings
    const settings = await prisma.faqPageSettings.findUnique({
      where: { shop }
    });

    // Load active categories and FAQs
    const categories = await prisma.faqCategory.findMany({
      where: { shop, isActive: true },
      include: {
        faqs: {
          where: { isActive: true },
          orderBy: { position: "asc" }
        }
      },
      orderBy: { position: "asc" }
    });

    return json({ 
      settings: settings || getDefaultSettings(),
      categories 
    });
  } catch (error) {
    console.error("Error loading FAQ page:", error);
    return json({ error: "Failed to load FAQs" }, { status: 500 });
  }
}

// Handle contact form submission
export async function action({ request }) {
  const formData = await request.formData();
  const shop = formData.get("shop");
  const email = formData.get("email");
  const message = formData.get("message");

  // Here you would typically send an email or save to database
  // For now, just return success
  console.log("Contact form submission:", { shop, email, message });

  return json({ success: true, message: "Message sent successfully!" });
}

function getDefaultSettings() {
  return {
    layout: "list",
    appearanceTheme: "light",
    customBackgroundColor: "#FFFFFF",
    customTextColor: "#000000",
    customAccentColor: "#5C6AC4",
    customBorderRadius: 8,
    headerEnabled: true,
    headerTitle: "Frequently Asked Questions",
    headerDescription: "Find answers to common questions",
    headerAlignment: "center",
    searchEnabled: true,
    searchPlaceholder: "Search FAQs...",
    showIcons: true,
    showCategories: true,
    enableAccordion: true,
    faqSpacing: "comfortable",
    contactFormEnabled: false,
    contactFormTitle: "Can't find what you're looking for?",
    contactFormDescription: "Contact us and we'll be happy to help.",
    contactFormEmailLabel: "Your Email",
    contactFormEmailPlaceholder: "you@example.com",
    contactFormMessageLabel: "Message",
    contactFormMessagePlaceholder: "How can we help you?",
    contactFormButtonText: "Send Message",
    customCSS: ""
  };
}

const FAQ_ICON_MAP = {
  "QuestionCircleIcon": "❓",
  "HelpIcon": "❔",
  "InfoIcon": "ℹ️",
  "ChatIcon": "💬",
  "SupportIcon": "🎧",
  "DocumentIcon": "📄",
  "PackageIcon": "📦",
  "DeliveryIcon": "🚚",
  "PaymentIcon": "💳",
  "ReturnIcon": "↩️"
};

export default function PublicFaqPage() {
  const { settings, categories, error } = useLoaderData();

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Error loading FAQs</h1>
        <p>{error}</p>
      </div>
    );
  }

  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedFaqs, setExpandedFaqs] = React.useState(new Set());
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactMessage, setContactMessage] = React.useState("");
  const [submitStatus, setSubmitStatus] = React.useState(null);

  // Get theme colors
  const backgroundColor = settings.appearanceTheme === "dark" 
    ? "#1a1a1a" 
    : settings.appearanceTheme === "custom" 
      ? settings.customBackgroundColor 
      : "#FFFFFF";
      
  const textColor = settings.appearanceTheme === "dark" 
    ? "#ffffff" 
    : settings.appearanceTheme === "custom" 
      ? settings.customTextColor 
      : "#000000";
      
  const accentColor = settings.appearanceTheme === "custom" 
    ? settings.customAccentColor 
    : "#5C6AC4";

  // Filter FAQs based on search
  const filteredCategories = categories.map(category => ({
    ...category,
    faqs: category.faqs.filter(faq =>
      searchQuery === "" ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.faqs.length > 0);

  // Spacing values
  const spacingMap = {
    compact: { gap: "8px", padding: "12px" },
    comfortable: { gap: "12px", padding: "16px" },
    spacious: { gap: "16px", padding: "20px" }
  };
  const spacing = spacingMap[settings.faqSpacing] || spacingMap.comfortable;

  const toggleFaq = (faqId) => {
    if (!settings.enableAccordion) return;
    
    const newExpanded = new Set(expandedFaqs);
    if (newExpanded.has(faqId)) {
      newExpanded.delete(faqId);
    } else {
      newExpanded.add(faqId);
    }
    setExpandedFaqs(newExpanded);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus("loading");

    const formData = new FormData();
    formData.append("shop", new URL(window.location.href).searchParams.get("shop"));
    formData.append("email", contactEmail);
    formData.append("message", contactMessage);

    try {
      const response = await fetch(window.location.href, {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        setSubmitStatus("success");
        setContactEmail("");
        setContactMessage("");
        setTimeout(() => setSubmitStatus(null), 3000);
      } else {
        setSubmitStatus("error");
      }
    } catch (error) {
      setSubmitStatus("error");
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: settings.customCSS }} />
      
      <div
        style={{
          backgroundColor,
          color: textColor,
          minHeight: "100vh",
          padding: "40px 20px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Header */}
          {settings.headerEnabled && (
            <div style={{ 
              textAlign: settings.headerAlignment, 
              marginBottom: "40px" 
            }}>
              <h1 style={{ 
                fontSize: "36px", 
                fontWeight: "bold", 
                marginBottom: "12px",
                color: textColor
              }}>
                {settings.headerTitle}
              </h1>
              {settings.headerDescription && (
                <p style={{ 
                  fontSize: "18px", 
                  opacity: 0.7,
                  maxWidth: "600px",
                  margin: settings.headerAlignment === "center" ? "0 auto" : "0"
                }}>
                  {settings.headerDescription}
                </p>
              )}
            </div>
          )}

          {/* Search */}
          {settings.searchEnabled && (
            <div style={{ marginBottom: "32px", maxWidth: "600px", margin: "0 auto 32px" }}>
              <input
                type="text"
                placeholder={settings.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  border: `1px solid ${settings.appearanceTheme === "dark" ? "#444" : "#ddd"}`,
                  borderRadius: `${settings.customBorderRadius}px`,
                  fontSize: "16px",
                  backgroundColor: settings.appearanceTheme === "dark" ? "#2a2a2a" : "#fff",
                  color: textColor,
                  outline: "none"
                }}
              />
            </div>
          )}

          {/* FAQs */}
          {filteredCategories.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", opacity: 0.5 }}>
              <p style={{ fontSize: "18px" }}>
                {searchQuery ? "No FAQs match your search" : "No FAQs available"}
              </p>
            </div>
          ) : (
            <div style={{
              display: settings.layout === "grid" ? "grid" : "block",
              gridTemplateColumns: settings.layout === "grid" ? "repeat(auto-fill, minmax(350px, 1fr))" : "1fr",
              gap: "24px",
              maxWidth: settings.layout !== "grid" ? "900px" : "100%",
              margin: "0 auto"
            }}>
              {filteredCategories.map((category) => (
                <div key={category.id} style={{ marginBottom: settings.layout === "accordion" ? "32px" : "0" }}>
                  {/* Category Title */}
                  {settings.showCategories && (
                    <h2 style={{
                      fontSize: "24px",
                      fontWeight: "600",
                      marginBottom: "16px",
                      color: accentColor
                    }}>
                      {category.title}
                    </h2>
                  )}

                  {/* FAQs */}
                  <div style={{ display: "flex", flexDirection: "column", gap: spacing.gap }}>
                    {category.faqs.map((faq) => {
                      const isExpanded = expandedFaqs.has(faq.id);
                      const shouldShowAnswer = !settings.enableAccordion || isExpanded;

                      return (
                        <div
                          key={faq.id}
                          style={{
                            backgroundColor: settings.appearanceTheme === "dark" ? "#2a2a2a" : "#f9f9f9",
                            padding: spacing.padding,
                            borderRadius: `${settings.customBorderRadius}px`,
                            border: `1px solid ${settings.appearanceTheme === "dark" ? "#444" : "#e5e5e5"}`,
                            cursor: settings.enableAccordion ? "pointer" : "default",
                            transition: "all 0.2s ease"
                          }}
                          onClick={() => toggleFaq(faq.id)}
                        >
                          {/* Question */}
                          <div style={{ 
                            display: "flex", 
                            alignItems: "flex-start", 
                            gap: "12px",
                            marginBottom: shouldShowAnswer ? "12px" : "0"
                          }}>
                            {settings.showIcons && (
                              <span style={{ fontSize: "24px", flexShrink: 0 }}>
                                {FAQ_ICON_MAP[faq.icon] || FAQ_ICON_MAP["QuestionCircleIcon"]}
                              </span>
                            )}
                            <h3 style={{
                              fontSize: "18px",
                              fontWeight: "600",
                              flex: 1,
                              lineHeight: "1.4"
                            }}>
                              {faq.question}
                            </h3>
                            {settings.enableAccordion && (
                              <span style={{ 
                                fontSize: "24px", 
                                transition: "transform 0.2s",
                                transform: isExpanded ? "rotate(45deg)" : "rotate(0deg)",
                                flexShrink: 0
                              }}>
                                +
                              </span>
                            )}
                          </div>

                          {/* Answer */}
                          {shouldShowAnswer && (
                            <p style={{
                              fontSize: "16px",
                              lineHeight: "1.6",
                              opacity: 0.85,
                              paddingLeft: settings.showIcons ? "36px" : "0",
                              whiteSpace: "pre-wrap"
                            }}>
                              {faq.answer}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contact Form */}
          {settings.contactFormEnabled && (
            <div style={{
              maxWidth: "600px",
              margin: "60px auto 0",
              padding: "32px",
              backgroundColor: settings.appearanceTheme === "dark" ? "#2a2a2a" : "#f9f9f9",
              borderRadius: `${settings.customBorderRadius}px`,
              border: `1px solid ${settings.appearanceTheme === "dark" ? "#444" : "#e5e5e5"}`
            }}>
              <h2 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "8px" }}>
                {settings.contactFormTitle}
              </h2>
              {settings.contactFormDescription && (
                <p style={{ fontSize: "16px", opacity: 0.7, marginBottom: "24px" }}>
                  {settings.contactFormDescription}
                </p>
              )}

              <form onSubmit={handleContactSubmit}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
                    {settings.contactFormEmailLabel}
                  </label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder={settings.contactFormEmailPlaceholder}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: `1px solid ${settings.appearanceTheme === "dark" ? "#444" : "#ddd"}`,
                      borderRadius: `${settings.customBorderRadius}px`,
                      fontSize: "16px",
                      backgroundColor: settings.appearanceTheme === "dark" ? "#1a1a1a" : "#fff",
                      color: textColor
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
                    {settings.contactFormMessageLabel}
                  </label>
                  <textarea
                    required
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder={settings.contactFormMessagePlaceholder}
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: `1px solid ${settings.appearanceTheme === "dark" ? "#444" : "#ddd"}`,
                      borderRadius: `${settings.customBorderRadius}px`,
                      fontSize: "16px",
                      backgroundColor: settings.appearanceTheme === "dark" ? "#1a1a1a" : "#fff",
                      color: textColor,
                      fontFamily: "inherit",
                      resize: "vertical"
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitStatus === "loading"}
                  style={{
                    padding: "14px 28px",
                    backgroundColor: accentColor,
                    color: "#fff",
                    border: "none",
                    borderRadius: `${settings.customBorderRadius}px`,
                    fontSize: "16px",
                    fontWeight: "600",
                    cursor: submitStatus === "loading" ? "not-allowed" : "pointer",
                    opacity: submitStatus === "loading" ? 0.6 : 1,
                    transition: "all 0.2s"
                  }}
                >
                  {submitStatus === "loading" 
                    ? "Sending..." 
                    : submitStatus === "success" 
                      ? "Sent!" 
                      : settings.contactFormButtonText
                  }
                </button>

                {submitStatus === "error" && (
                  <p style={{ marginTop: "12px", color: "#d82c0d" }}>
                    Failed to send message. Please try again.
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}