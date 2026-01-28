// app/routes/app.faq.jsx

import { useState, useEffect } from "react";
import { useLoaderData } from "react-router";
import { json } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Modal,
  TextField,
  EmptyState,
  Banner,
  Divider,
  Tabs,
  Select,
  Checkbox
} from "@shopify/polaris";
import {
  PlusIcon,
  DeleteIcon,
  EditIcon,
  QuestionCircleIcon
} from "@shopify/polaris-icons";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/* ---------------- LOADER ---------------- */
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const categories = await prisma.faqCategory.findMany({
    where: { shop },
    include: {
      faqs: {
        where: { isActive: true },
        orderBy: { position: "asc" }
      }
    },
    orderBy: { position: "asc" }
  });

  const settings =
    (await prisma.faqPageSettings.findUnique({ where: { shop } })) || {
      layout: "list",
      appearanceTheme: "light",
      headerTitle: "Frequently Asked Questions",
      headerDescription: "",
      backgroundColor: "#ffffff",
      textColor: "#000000",
      accentColor: "#5C6AC4",
      borderRadius: 8,
      showIcons: true,
      showSearch: true,
      enableAccordion: true,
      customCSS: ""
    };

  return json({ categories, settings, shop });
}

/* ---------------- ACTION ---------------- */
export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

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

/* ---------------- PAGE ---------------- */
export default function FaqUnifiedPage() {
  const { categories: initialCategories, settings: initialSettings, shop } =
    useLoaderData();

  const [selectedTab, setSelectedTab] = useState(0);
  const [categories, setCategories] = useState(initialCategories);

  /* ---------------- Settings State ---------------- */
  const [layout, setLayout] = useState(initialSettings.layout);
  const [appearanceTheme, setAppearanceTheme] = useState(initialSettings.appearanceTheme);
  const [headerTitle, setHeaderTitle] = useState(initialSettings.headerTitle);
  const [headerDescription, setHeaderDescription] = useState(initialSettings.headerDescription);
  const [backgroundColor, setBackgroundColor] = useState(initialSettings.backgroundColor);
  const [textColor, setTextColor] = useState(initialSettings.textColor);
  const [accentColor, setAccentColor] = useState(initialSettings.accentColor);
  const [borderRadius, setBorderRadius] = useState(initialSettings.borderRadius);
  const [showIcons, setShowIcons] = useState(initialSettings.showIcons);
  const [showSearch, setShowSearch] = useState(initialSettings.showSearch);
  const [enableAccordion, setEnableAccordion] = useState(initialSettings.enableAccordion);
  const [customCSS, setCustomCSS] = useState(initialSettings.customCSS);

  /* ---------------- Preview State ---------------- */
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState(null);

  /* ---------------- Modals ---------------- */
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [categoryTitle, setCategoryTitle] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);

  /* ---------------- Save Settings ---------------- */
  const saveSettings = async () => {
    const fd = new FormData();
    fd.append("layout", layout);
    fd.append("appearanceTheme", appearanceTheme);
    fd.append("headerTitle", headerTitle);
    fd.append("headerDescription", headerDescription);
    fd.append("backgroundColor", backgroundColor);
    fd.append("textColor", textColor);
    fd.append("accentColor", accentColor);
    fd.append("borderRadius", borderRadius);
    fd.append("showIcons", showIcons);
    fd.append("showSearch", showSearch);
    fd.append("enableAccordion", enableAccordion);
    fd.append("customCSS", customCSS);

    await fetch("/app/faq", { method: "POST", body: fd });

    shopify.toast.show("Settings saved");
  };

  const tabs = [
    { id: "manage", content: "Manage FAQs" },
    { id: "design", content: "Design & Page Settings" }
  ];

  return (
    <Page title="FAQ System">
      <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
        <Layout>
          <Layout.Section>
            {selectedTab === 0 && renderManage()}
            {selectedTab === 1 && renderDesign()}
          </Layout.Section>
        </Layout>
      </Tabs>
    </Page>
  );

  /* ---------------- TAB 1: MANAGE ---------------- */
  function renderManage() {
    return (
      <BlockStack gap="400">
        <Banner tone="info">
          <p>Manage FAQ categories and questions.</p>
        </Banner>

        {categories.map((category) => (
          <Card key={category.id}>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text variant="headingMd">{category.title}</Text>
                <Button
                  icon={PlusIcon}
                  onClick={() => {
                    setSelectedCategory(category);
                    setShowFaqModal(true);
                  }}
                >
                  Add FAQ
                </Button>
              </InlineStack>

              {category.faqs.map((faq) => (
                <Card key={faq.id} background="bg-surface-secondary">
                  <InlineStack align="space-between">
                    <Text>{faq.question}</Text>
                    <Button icon={DeleteIcon} tone="critical" />
                  </InlineStack>
                </Card>
              ))}
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    );
  }

  /* ---------------- TAB 2: DESIGN + FULL PREVIEW ---------------- */
  function renderDesign() {
    const filteredCategories = categories.map(cat => ({
      ...cat,
      faqs: cat.faqs.filter(f =>
        searchQuery === "" ||
        f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(cat => cat.faqs.length > 0);

    return (
      <Layout>
        {/* SETTINGS */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd">Design Settings</Text>

              <Select
                label="Layout"
                options={[
                  { label: "List", value: "list" },
                  { label: "Grid", value: "grid" },
                  { label: "Accordion", value: "accordion" }
                ]}
                value={layout}
                onChange={setLayout}
              />

              <TextField label="Title" value={headerTitle} onChange={setHeaderTitle} />
              <TextField
                label="Description"
                value={headerDescription}
                onChange={setHeaderDescription}
                multiline={3}
              />

              <Checkbox label="Show Search" checked={showSearch} onChange={setShowSearch} />
              <Checkbox label="Enable Accordion" checked={enableAccordion} onChange={setEnableAccordion} />

              <Button primary onClick={saveSettings}>
                Save Settings
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* PREVIEW */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd">Live Preview</Text>

              <div style={{ padding: 24 }}>
                <h1>{headerTitle}</h1>
                <p>{headerDescription}</p>

                {showSearch && (
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                  />
                )}

                {filteredCategories.map(cat => (
                  <div key={cat.id}>
                    <h3 style={{ color: accentColor }}>{cat.title}</h3>
                    {cat.faqs.map(faq => (
                      <div key={faq.id}>
                        <strong>{faq.question}</strong>
                        <p>{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    );
  }
}
