// app/routes/app.faq-page.jsx
import { useState, useEffect } from "react";
import { useLoaderData } from "react-router";
import { json } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Select,
  TextField,
  RadioButton,
  Checkbox,
  ColorPicker,
  RangeSlider,
  Button,
  Divider,
  Banner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
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

    // Load FAQ page settings
    const settings = await prisma.faqPageSettings.findUnique({
      where: { shop }
    });

    return json({ 
      categories, 
      shop,
      settings: settings || {
        layout: "list",
        appearanceTheme: "light",
        headerTitle: "Frequently Asked Questions",
        headerDescription: "Find answers to common questions about our products and services",
        backgroundColor: "#FFFFFF",
        textColor: "#000000",
        accentColor: "#5C6AC4",
        borderRadius: 8,
        showIcons: true,
        showSearch: true,
        enableAccordion: true,
        customCSS: ""
      }
    });
  } catch (error) {
    console.error("Error loading FAQ page:", error);
    return json({ 
      categories: [], 
      shop,
      settings: null
    });
  }
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("action");

  try {
    if (actionType === "saveSettings") {
      const settings = {
        shop,
        layout: formData.get("layout"),
        appearanceTheme: formData.get("appearanceTheme"),
        headerTitle: formData.get("headerTitle"),
        headerDescription: formData.get("headerDescription"),
        backgroundColor: formData.get("backgroundColor"),
        textColor: formData.get("textColor"),
        accentColor: formData.get("accentColor"),
        borderRadius: parseInt(formData.get("borderRadius")),
        showIcons: formData.get("showIcons") === "true",
        showSearch: formData.get("showSearch") === "true",
        enableAccordion: formData.get("enableAccordion") === "true",
        customCSS: formData.get("customCSS") || ""
      };

      await prisma.faqPageSettings.upsert({
        where: { shop },
        update: settings,
        create: settings
      });

      return json({ success: true });
    }

    return json({ success: false });
  } catch (error) {
    console.error("Error in FAQ page action:", error);
    return json({ success: false, error: error.message });
  }
}

export default function FaqPageSettings() {
  const { categories, shop, settings: initialSettings } = useLoaderData();

  // Layout settings
  const [layout, setLayout] = useState(initialSettings?.layout || "list");
  const [appearanceTheme, setAppearanceTheme] = useState(initialSettings?.appearanceTheme || "light");

  // Header settings
  const [headerTitle, setHeaderTitle] = useState(initialSettings?.headerTitle || "Frequently Asked Questions");
  const [headerDescription, setHeaderDescription] = useState(initialSettings?.headerDescription || "");

  // Appearance settings
  const [backgroundColor, setBackgroundColor] = useState(initialSettings?.backgroundColor || "#FFFFFF");
  const [textColor, setTextColor] = useState(initialSettings?.textColor || "#000000");
  const [accentColor, setAccentColor] = useState(initialSettings?.accentColor || "#5C6AC4");
  const [borderRadius, setBorderRadius] = useState(initialSettings?.borderRadius || 8);

  // Feature toggles
  const [showIcons, setShowIcons] = useState(initialSettings?.showIcons ?? true);
  const [showSearch, setShowSearch] = useState(initialSettings?.showSearch ?? true);
  const [enableAccordion, setEnableAccordion] = useState(initialSettings?.enableAccordion ?? true);

  // Custom CSS
  const [customCSS, setCustomCSS] = useState(initialSettings?.customCSS || "");

  // Preview state
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleSaveSettings = async () => {
    const formData = new FormData();
    formData.append("action", "saveSettings");
    formData.append("layout", layout);
    formData.append("appearanceTheme", appearanceTheme);
    formData.append("headerTitle", headerTitle);
    formData.append("headerDescription", headerDescription);
    formData.append("backgroundColor", backgroundColor);
    formData.append("textColor", textColor);
    formData.append("accentColor", accentColor);
    formData.append("borderRadius", borderRadius.toString());
    formData.append("showIcons", showIcons.toString());
    formData.append("showSearch", showSearch.toString());
    formData.append("enableAccordion", enableAccordion.toString());
    formData.append("customCSS", customCSS);

    try {
      const response = await fetch(`/app/faq-page`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        shopify.toast.show("Settings saved successfully");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      shopify.toast.show("Error saving settings", { isError: true });
    }
  };

  const getIconComponent = (iconName) => {
    // Return icon based on name - simplified for preview
    return "❓";
  };

  const filteredCategories = categories.map(category => ({
    ...category,
    faqs: category.faqs.filter(faq =>
      searchQuery === "" ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.faqs.length > 0);

  return (
    <Page
      title="FAQs Page Settings"
      subtitle="Customize the appearance and layout of your public FAQs page"
      primaryAction={{
        content: "Save Settings",
        onAction: handleSaveSettings
      }}
    >
      <Layout>
        {/* Settings Panel */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Appearance Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Appearance</Text>
                
                <Select
                  label="Theme"
                  options={[
                    { label: "Light", value: "light" },
                    { label: "Dark", value: "dark" },
                    { label: "Custom", value: "custom" }
                  ]}
                  value={appearanceTheme}
                  onChange={setAppearanceTheme}
                />

                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">Layout Style</Text>
                  <BlockStack gap="200">
                    <RadioButton
                      label="List View - Simple list of questions, best for smaller FAQs"
                      checked={layout === "list"}
                      onChange={() => setLayout("list")}
                    />
                    <RadioButton
                      label="Grid View - Card-based layout for better visual grouping"
                      checked={layout === "grid"}
                      onChange={() => setLayout("grid")}
                    />
                    <RadioButton
                      label="Accordion - Collapsible sections for organized browsing"
                      checked={layout === "accordion"}
                      onChange={() => setLayout("accordion")}
                    />
                  </BlockStack>
                </BlockStack>

                {appearanceTheme === "custom" && (
                  <>
                    <div>
                      <Text variant="bodyMd" as="p">Background Color</Text>
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          style={{ width: '100%', height: '40px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <Text variant="bodyMd" as="p">Text Color</Text>
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          style={{ width: '100%', height: '40px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <Text variant="bodyMd" as="p">Accent Color</Text>
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          style={{ width: '100%', height: '40px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <Text variant="bodyMd" as="p">Border Radius: {borderRadius}px</Text>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={borderRadius}
                        onChange={(e) => setBorderRadius(parseInt(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </>
                )}
              </BlockStack>
            </Card>

            {/* Header Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Header</Text>
                
                <TextField
                  label="Page Title"
                  value={headerTitle}
                  onChange={setHeaderTitle}
                  placeholder="Frequently Asked Questions"
                  autoComplete="off"
                />

                <TextField
                  label="Description"
                  value={headerDescription}
                  onChange={setHeaderDescription}
                  placeholder="Find answers to common questions"
                  multiline={3}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            {/* Feature Toggles */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Features</Text>
                
                <Checkbox
                  label="Show Icons"
                  checked={showIcons}
                  onChange={setShowIcons}
                  helpText="Display icons next to FAQ questions"
                />

                <Checkbox
                  label="Enable Search"
                  checked={showSearch}
                  onChange={setShowSearch}
                  helpText="Allow users to search through FAQs"
                />

                <Checkbox
                  label="Accordion Mode"
                  checked={enableAccordion}
                  onChange={setEnableAccordion}
                  helpText="Collapse/expand FAQ answers"
                />
              </BlockStack>
            </Card>

            {/* Advanced Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Advanced</Text>
                
                <TextField
                  label="Custom CSS"
                  value={customCSS}
                  onChange={setCustomCSS}
                  placeholder="Add your custom CSS here..."
                  multiline={6}
                  autoComplete="off"
                  helpText="Add custom styles to further customize your FAQ page"
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Preview Panel */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Preview</Text>
                <Button>Open in New Tab</Button>
              </InlineStack>

              <Divider />

              {/* FAQ Preview */}
              <div
                style={{
                  backgroundColor: appearanceTheme === "dark" ? "#1a1a1a" : backgroundColor,
                  color: appearanceTheme === "dark" ? "#ffffff" : textColor,
                  padding: "32px",
                  borderRadius: `${borderRadius}px`,
                  minHeight: "600px"
                }}
              >
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                  <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>
                    {headerTitle}
                  </h1>
                  {headerDescription && (
                    <p style={{ fontSize: "16px", opacity: 0.7 }}>
                      {headerDescription}
                    </p>
                  )}
                </div>

                {/* Search */}
                {showSearch && (
                  <div style={{ marginBottom: "24px", maxWidth: "600px", margin: "0 auto 24px" }}>
                    <input
                      type="text"
                      placeholder="Search FAQs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: `1px solid ${appearanceTheme === "dark" ? "#444" : "#ddd"}`,
                        borderRadius: `${borderRadius}px`,
                        fontSize: "14px",
                        backgroundColor: appearanceTheme === "dark" ? "#2a2a2a" : "#fff",
                        color: appearanceTheme === "dark" ? "#fff" : "#000"
                      }}
                    />
                  </div>
                )}

                {/* FAQs */}
                {filteredCategories.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px", opacity: 0.5 }}>
                    <p>No FAQs to display</p>
                  </div>
                ) : (
                  <div style={{
                    display: layout === "grid" ? "grid" : "block",
                    gridTemplateColumns: layout === "grid" ? "repeat(auto-fill, minmax(300px, 1fr))" : "1fr",
                    gap: "16px",
                    maxWidth: layout === "list" || layout === "accordion" ? "800px" : "100%",
                    margin: "0 auto"
                  }}>
                    {filteredCategories.map((category) => (
                      <div key={category.id} style={{ marginBottom: layout === "accordion" ? "24px" : "0" }}>
                        {/* Category Title */}
                        <h2 style={{
                          fontSize: "20px",
                          fontWeight: "600",
                          marginBottom: "16px",
                          color: accentColor
                        }}>
                          {category.title}
                        </h2>

                        {/* FAQs */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {category.faqs.map((faq) => (
                            <div
                              key={faq.id}
                              style={{
                                backgroundColor: appearanceTheme === "dark" ? "#2a2a2a" : "#f9f9f9",
                                padding: "16px",
                                borderRadius: `${borderRadius}px`,
                                border: `1px solid ${appearanceTheme === "dark" ? "#444" : "#e5e5e5"}`,
                                cursor: enableAccordion ? "pointer" : "default"
                              }}
                              onClick={() => {
                                if (enableAccordion) {
                                  setExpandedFaq(expandedFaq === faq.id ? null : faq.id);
                                }
                              }}
                            >
                              {/* Question */}
                              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: enableAccordion && expandedFaq !== faq.id ? "0" : "12px" }}>
                                {showIcons && (
                                  <span style={{ fontSize: "20px" }}>
                                    {getIconComponent(faq.icon)}
                                  </span>
                                )}
                                <h3 style={{
                                  fontSize: "16px",
                                  fontWeight: "500",
                                  flex: 1
                                }}>
                                  {faq.question}
                                </h3>
                                {enableAccordion && (
                                  <span style={{ fontSize: "20px", transition: "transform 0.2s" }}>
                                    {expandedFaq === faq.id ? "−" : "+"}
                                  </span>
                                )}
                              </div>

                              {/* Answer */}
                              {(!enableAccordion || expandedFaq === faq.id) && (
                                <p style={{
                                  fontSize: "14px",
                                  lineHeight: "1.6",
                                  opacity: 0.8,
                                  paddingLeft: showIcons ? "32px" : "0"
                                }}>
                                  {faq.answer}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Banner tone="info">
                <p>
                  This is a preview of how your FAQ page will appear. Changes are saved when you click "Save Settings" above.
                </p>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}