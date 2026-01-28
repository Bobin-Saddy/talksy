// app/routes/app.faq.jsx
import { useState, useEffect } from "react";
import { useLoaderData, useSubmit } from "react-router";
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
  Button,
  Divider,
  Banner,
  Link
} from "@shopify/polaris";
import { ExternalIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    // Load FAQ page settings
    const settings = await prisma.faqPageSettings.findUnique({
      where: { shop }
    });

    // Generate FAQ page URL
    const shopDomain = shop.replace('.myshopify.com', '');
    const faqPageUrl = `https://${shop}/apps/faq-page`;

    return json({ 
      shop,
      faqPageUrl,
      settings: settings || {
        // Layout settings
        layout: "list",
        
        // Appearance settings
        appearanceTheme: "light",
        customBackgroundColor: "#FFFFFF",
        customTextColor: "#000000",
        customAccentColor: "#5C6AC4",
        customBorderRadius: 8,
        
        // Header settings
        headerEnabled: true,
        headerTitle: "Frequently Asked Questions",
        headerDescription: "Find answers to common questions about our products and services",
        headerAlignment: "center",
        
        // Search settings
        searchEnabled: true,
        searchPlaceholder: "Search FAQs...",
        
        // FAQ Item settings
        showIcons: true,
        showCategories: true,
        enableAccordion: true,
        faqSpacing: "comfortable",
        
        // Contact Form settings
        contactFormEnabled: false,
        contactFormTitle: "Can't find what you're looking for?",
        contactFormDescription: "Contact us and we'll be happy to help.",
        contactFormEmailLabel: "Your Email",
        contactFormEmailPlaceholder: "you@example.com",
        contactFormMessageLabel: "Message",
        contactFormMessagePlaceholder: "How can we help you?",
        contactFormButtonText: "Send Message",
        
        // Advanced settings
        customCSS: ""
      }
    });
  } catch (error) {
    console.error("Error loading FAQ settings:", error);
    return json({ 
      shop,
      faqPageUrl: "",
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
        // Layout
        layout: formData.get("layout"),
        
        // Appearance
        appearanceTheme: formData.get("appearanceTheme"),
        customBackgroundColor: formData.get("customBackgroundColor"),
        customTextColor: formData.get("customTextColor"),
        customAccentColor: formData.get("customAccentColor"),
        customBorderRadius: parseInt(formData.get("customBorderRadius")),
        
        // Header
        headerEnabled: formData.get("headerEnabled") === "true",
        headerTitle: formData.get("headerTitle"),
        headerDescription: formData.get("headerDescription"),
        headerAlignment: formData.get("headerAlignment"),
        
        // Search
        searchEnabled: formData.get("searchEnabled") === "true",
        searchPlaceholder: formData.get("searchPlaceholder"),
        
        // FAQ Items
        showIcons: formData.get("showIcons") === "true",
        showCategories: formData.get("showCategories") === "true",
        enableAccordion: formData.get("enableAccordion") === "true",
        faqSpacing: formData.get("faqSpacing"),
        
        // Contact Form
        contactFormEnabled: formData.get("contactFormEnabled") === "true",
        contactFormTitle: formData.get("contactFormTitle"),
        contactFormDescription: formData.get("contactFormDescription"),
        contactFormEmailLabel: formData.get("contactFormEmailLabel"),
        contactFormEmailPlaceholder: formData.get("contactFormEmailPlaceholder"),
        contactFormMessageLabel: formData.get("contactFormMessageLabel"),
        contactFormMessagePlaceholder: formData.get("contactFormMessagePlaceholder"),
        contactFormButtonText: formData.get("contactFormButtonText"),
        
        // Advanced
        customCSS: formData.get("customCSS") || ""
      };

      await prisma.faqPageSettings.upsert({
        where: { shop },
        update: settings,
        create: settings
      });

      return json({ success: true, message: "Settings saved successfully!" });
    }

    return json({ success: false, error: "Invalid action" });
  } catch (error) {
    console.error("Error in FAQ settings action:", error);
    return json({ success: false, error: error.message });
  }
}

export default function FaqSettingsPage() {
  const { shop, faqPageUrl, settings: initialSettings } = useLoaderData();
  const submit = useSubmit();

  // Layout settings
  const [layout, setLayout] = useState(initialSettings?.layout || "list");
  
  // Appearance settings
  const [appearanceTheme, setAppearanceTheme] = useState(initialSettings?.appearanceTheme || "light");
  const [customBackgroundColor, setCustomBackgroundColor] = useState(initialSettings?.customBackgroundColor || "#FFFFFF");
  const [customTextColor, setCustomTextColor] = useState(initialSettings?.customTextColor || "#000000");
  const [customAccentColor, setCustomAccentColor] = useState(initialSettings?.customAccentColor || "#5C6AC4");
  const [customBorderRadius, setCustomBorderRadius] = useState(initialSettings?.customBorderRadius || 8);
  
  // Header settings
  const [headerEnabled, setHeaderEnabled] = useState(initialSettings?.headerEnabled ?? true);
  const [headerTitle, setHeaderTitle] = useState(initialSettings?.headerTitle || "Frequently Asked Questions");
  const [headerDescription, setHeaderDescription] = useState(initialSettings?.headerDescription || "");
  const [headerAlignment, setHeaderAlignment] = useState(initialSettings?.headerAlignment || "center");
  
  // Search settings
  const [searchEnabled, setSearchEnabled] = useState(initialSettings?.searchEnabled ?? true);
  const [searchPlaceholder, setSearchPlaceholder] = useState(initialSettings?.searchPlaceholder || "Search FAQs...");
  
  // FAQ Item settings
  const [showIcons, setShowIcons] = useState(initialSettings?.showIcons ?? true);
  const [showCategories, setShowCategories] = useState(initialSettings?.showCategories ?? true);
  const [enableAccordion, setEnableAccordion] = useState(initialSettings?.enableAccordion ?? true);
  const [faqSpacing, setFaqSpacing] = useState(initialSettings?.faqSpacing || "comfortable");
  
  // Contact Form settings
  const [contactFormEnabled, setContactFormEnabled] = useState(initialSettings?.contactFormEnabled ?? false);
  const [contactFormTitle, setContactFormTitle] = useState(initialSettings?.contactFormTitle || "Can't find what you're looking for?");
  const [contactFormDescription, setContactFormDescription] = useState(initialSettings?.contactFormDescription || "");
  const [contactFormEmailLabel, setContactFormEmailLabel] = useState(initialSettings?.contactFormEmailLabel || "Your Email");
  const [contactFormEmailPlaceholder, setContactFormEmailPlaceholder] = useState(initialSettings?.contactFormEmailPlaceholder || "");
  const [contactFormMessageLabel, setContactFormMessageLabel] = useState(initialSettings?.contactFormMessageLabel || "Message");
  const [contactFormMessagePlaceholder, setContactFormMessagePlaceholder] = useState(initialSettings?.contactFormMessagePlaceholder || "");
  const [contactFormButtonText, setContactFormButtonText] = useState(initialSettings?.contactFormButtonText || "Send Message");
  
  // Advanced settings
  const [customCSS, setCustomCSS] = useState(initialSettings?.customCSS || "");

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    const formData = new FormData();
    formData.append("action", "saveSettings");
    
    // Layout
    formData.append("layout", layout);
    
    // Appearance
    formData.append("appearanceTheme", appearanceTheme);
    formData.append("customBackgroundColor", customBackgroundColor);
    formData.append("customTextColor", customTextColor);
    formData.append("customAccentColor", customAccentColor);
    formData.append("customBorderRadius", customBorderRadius.toString());
    
    // Header
    formData.append("headerEnabled", headerEnabled.toString());
    formData.append("headerTitle", headerTitle);
    formData.append("headerDescription", headerDescription);
    formData.append("headerAlignment", headerAlignment);
    
    // Search
    formData.append("searchEnabled", searchEnabled.toString());
    formData.append("searchPlaceholder", searchPlaceholder);
    
    // FAQ Items
    formData.append("showIcons", showIcons.toString());
    formData.append("showCategories", showCategories.toString());
    formData.append("enableAccordion", enableAccordion.toString());
    formData.append("faqSpacing", faqSpacing);
    
    // Contact Form
    formData.append("contactFormEnabled", contactFormEnabled.toString());
    formData.append("contactFormTitle", contactFormTitle);
    formData.append("contactFormDescription", contactFormDescription);
    formData.append("contactFormEmailLabel", contactFormEmailLabel);
    formData.append("contactFormEmailPlaceholder", contactFormEmailPlaceholder);
    formData.append("contactFormMessageLabel", contactFormMessageLabel);
    formData.append("contactFormMessagePlaceholder", contactFormMessagePlaceholder);
    formData.append("contactFormButtonText", contactFormButtonText);
    
    // Advanced
    formData.append("customCSS", customCSS);

    try {
      const response = await fetch(`/app/faq`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        shopify.toast.show("Settings saved successfully");
      } else {
        shopify.toast.show("Error saving settings", { isError: true });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      shopify.toast.show("Error saving settings", { isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(faqPageUrl);
    shopify.toast.show("URL copied to clipboard");
  };

  return (
    <Page
      title="FAQs"
      subtitle="Customize your FAQ page appearance and settings"
      primaryAction={{
        content: "Save Settings",
        onAction: handleSaveSettings,
        loading: isSaving
      }}
      secondaryActions={[
        {
          content: "Manage FAQs",
          url: "/app/faq/manage"
        }
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* FAQ Page URL */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">FAQ Page URL</Text>
                <Text tone="subdued">
                  Use this URL in your Shopify theme to display the FAQ page
                </Text>
                
                <InlineStack gap="200" align="start">
                  <div style={{ flex: 1 }}>
                    <TextField
                      value={faqPageUrl}
                      readOnly
                      autoComplete="off"
                      connectedRight={
                        <Button onClick={copyToClipboard}>Copy</Button>
                      }
                    />
                  </div>
                  <Button
                    icon={ExternalIcon}
                    url={faqPageUrl}
                    external
                  >
                    Preview
                  </Button>
                </InlineStack>
                
                <Banner tone="info">
                  <p>
                    To add this FAQ page to your theme, create a new page template and include this URL, 
                    or use the liquid snippet provided in the documentation.
                  </p>
                </Banner>
              </BlockStack>
            </Card>

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

                {appearanceTheme === "custom" && (
                  <BlockStack gap="400">
                    <div>
                      <Text variant="bodyMd" as="p">Background Color</Text>
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="color"
                          value={customBackgroundColor}
                          onChange={(e) => setCustomBackgroundColor(e.target.value)}
                          style={{ width: '100%', height: '40px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <Text variant="bodyMd" as="p">Text Color</Text>
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="color"
                          value={customTextColor}
                          onChange={(e) => setCustomTextColor(e.target.value)}
                          style={{ width: '100%', height: '40px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <Text variant="bodyMd" as="p">Accent Color</Text>
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="color"
                          value={customAccentColor}
                          onChange={(e) => setCustomAccentColor(e.target.value)}
                          style={{ width: '100%', height: '40px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <Text variant="bodyMd" as="p">Border Radius: {customBorderRadius}px</Text>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={customBorderRadius}
                        onChange={(e) => setCustomBorderRadius(parseInt(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </BlockStack>
                )}

                <Divider />

                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p" fontWeight="semibold">Layout Style</Text>
                  <BlockStack gap="200">
                    <RadioButton
                      label={
                        <BlockStack gap="100">
                          <Text as="span">List View</Text>
                          <Text as="span" tone="subdued">Simple list of questions, best for smaller FAQs</Text>
                        </BlockStack>
                      }
                      checked={layout === "list"}
                      onChange={() => setLayout("list")}
                    />
                    <RadioButton
                      label={
                        <BlockStack gap="100">
                          <Text as="span">Grid View</Text>
                          <Text as="span" tone="subdued">Card-based layout for better visual grouping</Text>
                        </BlockStack>
                      }
                      checked={layout === "grid"}
                      onChange={() => setLayout("grid")}
                    />
                    <RadioButton
                      label={
                        <BlockStack gap="100">
                          <Text as="span">Accordion</Text>
                          <Text as="span" tone="subdued">Collapsible sections for organized browsing</Text>
                        </BlockStack>
                      }
                      checked={layout === "accordion"}
                      onChange={() => setLayout("accordion")}
                    />
                  </BlockStack>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Header Settings */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Header</Text>
                  <Checkbox
                    label="Enable header"
                    checked={headerEnabled}
                    onChange={setHeaderEnabled}
                  />
                </InlineStack>
                
                {headerEnabled && (
                  <>
                    <TextField
                      label="Page Title"
                      value={headerTitle}
                      onChange={setHeaderTitle}
                      placeholder="Frequently Asked Questions"
                      autoComplete="off"
                    />

                    <TextField
                      label="Description (optional)"
                      value={headerDescription}
                      onChange={setHeaderDescription}
                      placeholder="Find answers to common questions"
                      multiline={2}
                      autoComplete="off"
                      helpText="Leave blank to hide description"
                    />

                    <Select
                      label="Text Alignment"
                      options={[
                        { label: "Left", value: "left" },
                        { label: "Center", value: "center" },
                        { label: "Right", value: "right" }
                      ]}
                      value={headerAlignment}
                      onChange={setHeaderAlignment}
                    />
                  </>
                )}
              </BlockStack>
            </Card>

            {/* Search Settings */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Search</Text>
                  <Checkbox
                    label="Enable search"
                    checked={searchEnabled}
                    onChange={setSearchEnabled}
                  />
                </InlineStack>
                
                {searchEnabled && (
                  <TextField
                    label="Search Placeholder"
                    value={searchPlaceholder}
                    onChange={setSearchPlaceholder}
                    placeholder="Search FAQs..."
                    autoComplete="off"
                  />
                )}
              </BlockStack>
            </Card>

            {/* FAQ Item Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">FAQ Items</Text>
                
                <Checkbox
                  label="Show icons"
                  checked={showIcons}
                  onChange={setShowIcons}
                  helpText="Display icons next to FAQ questions"
                />

                <Checkbox
                  label="Show categories"
                  checked={showCategories}
                  onChange={setShowCategories}
                  helpText="Display category names above FAQs"
                />

                <Checkbox
                  label="Enable accordion"
                  checked={enableAccordion}
                  onChange={setEnableAccordion}
                  helpText="Allow users to collapse/expand answers"
                />

                <Select
                  label="FAQ Spacing"
                  options={[
                    { label: "Compact", value: "compact" },
                    { label: "Comfortable", value: "comfortable" },
                    { label: "Spacious", value: "spacious" }
                  ]}
                  value={faqSpacing}
                  onChange={setFaqSpacing}
                />
              </BlockStack>
            </Card>

            {/* Contact Form Settings */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Contact Form</Text>
                  <Checkbox
                    label="Enable form"
                    checked={contactFormEnabled}
                    onChange={setContactFormEnabled}
                  />
                </InlineStack>
                
                <Text tone="subdued">
                  Display a contact form at the bottom of the FAQ page
                </Text>

                {contactFormEnabled && (
                  <>
                    <Divider />
                    
                    <TextField
                      label="Form Title"
                      value={contactFormTitle}
                      onChange={setContactFormTitle}
                      placeholder="Can't find what you're looking for?"
                      autoComplete="off"
                    />

                    <TextField
                      label="Form Description (optional)"
                      value={contactFormDescription}
                      onChange={setContactFormDescription}
                      placeholder="Contact us and we'll be happy to help"
                      multiline={2}
                      autoComplete="off"
                    />

                    <Divider />

                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h3">Form Fields</Text>
                      
                      <TextField
                        label="Email Label"
                        value={contactFormEmailLabel}
                        onChange={setContactFormEmailLabel}
                        placeholder="Your Email"
                        autoComplete="off"
                      />

                      <TextField
                        label="Email Placeholder"
                        value={contactFormEmailPlaceholder}
                        onChange={setContactFormEmailPlaceholder}
                        placeholder="you@example.com"
                        autoComplete="off"
                      />

                      <TextField
                        label="Message Label"
                        value={contactFormMessageLabel}
                        onChange={setContactFormMessageLabel}
                        placeholder="Message"
                        autoComplete="off"
                      />

                      <TextField
                        label="Message Placeholder"
                        value={contactFormMessagePlaceholder}
                        onChange={setContactFormMessagePlaceholder}
                        placeholder="How can we help you?"
                        autoComplete="off"
                      />

                      <TextField
                        label="Button Text"
                        value={contactFormButtonText}
                        onChange={setContactFormButtonText}
                        placeholder="Send Message"
                        autoComplete="off"
                      />
                    </BlockStack>
                  </>
                )}
              </BlockStack>
            </Card>

            {/* Advanced Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Advanced Settings</Text>
                
                <TextField
                  label="Custom CSS"
                  value={customCSS}
                  onChange={setCustomCSS}
                  placeholder="/* Add your custom CSS here */"
                  multiline={8}
                  autoComplete="off"
                  helpText="Add custom styles to further customize your FAQ page appearance"
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}