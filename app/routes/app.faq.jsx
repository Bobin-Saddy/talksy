// app/routes/app.faq.jsx - Complete with 3 Tabs
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
  Icon,
  EmptyState,
  Banner,
  Divider,
  Tabs,
  Select,
  ChoiceList,
  RangeSlider,
  Popover,
  ActionList,
  Box,
  ButtonGroup,
  Checkbox,
  Thumbnail
} from "@shopify/polaris";
import {
  PlusIcon,
  DeleteIcon,
  EditIcon,
  DragHandleIcon,
  QuestionCircleIcon,
  MenuVerticalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ViewIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const [categories, settings] = await Promise.all([
      prisma.faqCategory.findMany({
        where: { shop },
        include: {
          faqs: {
            orderBy: { position: "asc" }
          }
        },
        orderBy: { position: "asc" }
      }),
      prisma.faqPageSettings.findFirst({
        where: { shop }
      })
    ]);

    // Default settings if not found
    const defaultSettings = settings || {
      layout: "list",
      appearanceTheme: "light",
      customBackgroundColor: "#FFFFFF",
      customTextColor: "#000000",
      customAccentColor: "#5C6AC4",
      customBorderRadius: 8,
      headerEnabled: true,
      headerTitle: "Frequently Asked Questions",
      headerDescription: "Got a question? We are here to answer!",
      headerAlignment: "center",
      searchEnabled: true,
      searchPlaceholder: "Search FAQs...",
      showIcons: true,
      showCategories: true,
      enableAccordion: true,
      faqSpacing: "comfortable",
      contactFormEnabled: false,
      contactFormTitle: "Can't find what you're looking for?",
      contactFormDescription: "Send us a message and we'll get back to you soon",
      contactFormEmailLabel: "Your Email",
      contactFormEmailPlaceholder: "you@example.com",
      contactFormMessageLabel: "Message",
      contactFormMessagePlaceholder: "How can we help?",
      contactFormButtonText: "Send Message",
      customCSS: ""
    };

    return json({ categories, settings: defaultSettings, shop });
  } catch (error) {
    console.error("Error loading FAQs:", error);
    return json({ categories: [], settings: {}, shop });
  }
}

export default function FaqPage() {
  const { categories: initialCategories, settings: initialSettings, shop } = useLoaderData();

  const [selectedTab, setSelectedTab] = useState(0);
  const [categories, setCategories] = useState(initialCategories);
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  
  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Editing states
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingFaq, setEditingFaq] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Form states
  const [categoryTitle, setCategoryTitle] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqIcon, setFaqIcon] = useState("QuestionCircleIcon");

  // Popover states
  const [activeCategoryPopover, setActiveCategoryPopover] = useState(null);
  const [activeFaqPopover, setActiveFaqPopover] = useState(null);

  const tabs = [
    { id: 'manage', content: 'Manage FAQs', panelID: 'manage-panel' },
    { id: 'page', content: 'FAQ Page', panelID: 'page-panel' },
    { id: 'block', content: 'FAQ Block', panelID: 'block-panel' }
  ];

  const iconOptions = [
    "QuestionCircleIcon",
    "ChatIcon",
    "InfoIcon",
    "LightbulbIcon",
    "StarIcon",
    "CheckCircleIcon"
  ];

  // Reset forms
  useEffect(() => {
    if (!showCategoryModal) {
      setCategoryTitle("");
      setEditingCategory(null);
    }
  }, [showCategoryModal]);

  useEffect(() => {
    if (!showFaqModal) {
      setFaqQuestion("");
      setFaqAnswer("");
      setFaqIcon("QuestionCircleIcon");
      setEditingFaq(null);
      setSelectedCategory(null);
    }
  }, [showFaqModal]);

  // Refresh data
  async function refreshCategories() {
    try {
      const response = await fetch(`/api/faq/categories?shop=${shop}`);
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Error refreshing:", error);
    }
  }

  // Category handlers
  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryTitle("");
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryTitle(category.title);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryTitle.trim()) return;

    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("title", categoryTitle);
    formData.append("position", editingCategory ? editingCategory.position : categories.length);
    formData.append("action", editingCategory ? "update" : "create");
    
    if (editingCategory) {
      formData.append("id", editingCategory.id);
    }

    try {
      const response = await fetch(`/api/faq/categories?shop=${shop}`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        await refreshCategories();
        setShowCategoryModal(false);
      }
    } catch (error) {
      console.error("Error saving category:", error);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm("Are you sure you want to delete this category and all its FAQs?")) return;

    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("id", categoryId);
    formData.append("action", "delete");

    try {
      const response = await fetch(`/api/faq/categories?shop=${shop}`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setCategories(categories.filter(cat => cat.id !== categoryId));
      }
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  const handleMoveCategoryUp = async (category, index) => {
    if (index === 0) return;
    
    const updates = [
      { id: category.id, position: index - 1 },
      { id: categories[index - 1].id, position: index }
    ];

    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("action", "reorder");
    formData.append("updates", JSON.stringify(updates));

    try {
      const response = await fetch(`/api/faq/categories?shop=${shop}`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      if (result.success) await refreshCategories();
    } catch (error) {
      console.error("Error moving category:", error);
    }
  };

  const handleMoveCategoryDown = async (category, index) => {
    if (index === categories.length - 1) return;
    
    const updates = [
      { id: category.id, position: index + 1 },
      { id: categories[index + 1].id, position: index }
    ];

    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("action", "reorder");
    formData.append("updates", JSON.stringify(updates));

    try {
      const response = await fetch(`/api/faq/categories?shop=${shop}`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      if (result.success) await refreshCategories();
    } catch (error) {
      console.error("Error moving category:", error);
    }
  };

  // FAQ handlers
  const handleAddFaq = (category) => {
    setSelectedCategory(category);
    setEditingFaq(null);
    setFaqQuestion("");
    setFaqAnswer("");
    setFaqIcon("QuestionCircleIcon");
    setShowFaqModal(true);
  };

  const handleEditFaq = (faq, category) => {
    setSelectedCategory(category);
    setEditingFaq(faq);
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setFaqIcon(faq.icon || "QuestionCircleIcon");
    setShowFaqModal(true);
  };

  const handleSaveFaq = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;

    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("question", faqQuestion);
    formData.append("answer", faqAnswer);
    formData.append("icon", faqIcon);
    formData.append("action", editingFaq ? "update" : "create");

    if (editingFaq) {
      formData.append("id", editingFaq.id);
      formData.append("position", editingFaq.position);
    } else {
      formData.append("categoryId", selectedCategory.id);
      formData.append("position", selectedCategory.faqs.length);
    }

    try {
      const response = await fetch(`/api/faq/items?shop=${shop}`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        await refreshCategories();
        setShowFaqModal(false);
      }
    } catch (error) {
      console.error("Error saving FAQ:", error);
    }
  };

  const handleDeleteFaq = async (faqId, categoryId) => {
    if (!confirm("Are you sure you want to delete this FAQ?")) return;

    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("id", faqId);
    formData.append("action", "delete");

    try {
      const response = await fetch(`/api/faq/items?shop=${shop}`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setCategories(categories.map(cat => {
          if (cat.id === categoryId) {
            return {
              ...cat,
              faqs: cat.faqs.filter(faq => faq.id !== faqId)
            };
          }
          return cat;
        }));
      }
    } catch (error) {
      console.error("Error deleting FAQ:", error);
    }
  };

  const handleMoveFaqUp = async (faq, category, index) => {
    if (index === 0) return;
    
    const updates = [
      { id: faq.id, position: index - 1 },
      { id: category.faqs[index - 1].id, position: index }
    ];

    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("action", "reorder");
    formData.append("updates", JSON.stringify(updates));

    try {
      const response = await fetch(`/api/faq/items?shop=${shop}`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      if (result.success) await refreshCategories();
    } catch (error) {
      console.error("Error moving FAQ:", error);
    }
  };

  const handleMoveFaqDown = async (faq, category, index) => {
    if (index === category.faqs.length - 1) return;
    
    const updates = [
      { id: faq.id, position: index + 1 },
      { id: category.faqs[index + 1].id, position: index }
    ];

    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("action", "reorder");
    formData.append("updates", JSON.stringify(updates));

    try {
      const response = await fetch(`/api/faq/items?shop=${shop}`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      if (result.success) await refreshCategories();
    } catch (error) {
      console.error("Error moving FAQ:", error);
    }
  };

  // Save FAQ Page Settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/faq/settings?shop=${shop}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, ...settings })
      });

      const result = await response.json();
      if (result.success) {
        shopify.toast.show("Settings saved successfully!");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      shopify.toast.show("Failed to save settings", { isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const faqPageUrl = `https://${shop}/pages/faqs`;

  return (
    <Page
      title="FAQ Management"
      subtitle="Create and manage FAQ categories and questions"
      secondaryActions={[
        {
          content: "Preview",
          icon: ViewIcon,
          onAction: () => window.open(faqPageUrl, '_blank')
        }
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              {/* TAB 1: MANAGE FAQs */}
              {selectedTab === 0 && (
                <Box padding="400">
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text variant="headingMd" as="h2">FAQ Categories</Text>
                      <Button
                        icon={PlusIcon}
                        variant="primary"
                        onClick={handleAddCategory}
                      >
                        Add Category
                      </Button>
                    </InlineStack>

                    <Banner tone="info">
                      <p>FAQs will automatically appear in your FAQ page. Organize them by categories.</p>
                    </Banner>

                    {categories.length === 0 ? (
                      <EmptyState
                        heading="Create your first FAQ category"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>Add categories to organize your frequently asked questions</p>
                        <Button variant="primary" onClick={handleAddCategory}>
                          Add Category
                        </Button>
                      </EmptyState>
                    ) : (
                      <BlockStack gap="300">
                        {categories.map((category, catIndex) => (
                          <Card key={category.id}>
                            <BlockStack gap="300">
                              {/* Category Header */}
                              <InlineStack align="space-between" blockAlign="center">
                                <InlineStack gap="200" blockAlign="center">
                                  <Icon source={DragHandleIcon} tone="base" />
                                  <Text variant="headingMd" as="h3">
                                    {category.title}
                                  </Text>
                                  <Badge tone={category.isActive ? "success" : "critical"}>
                                    {category.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                  <Badge>{category.faqs.length} FAQs</Badge>
                                </InlineStack>
                                
                                <InlineStack gap="100">
                                  <Button
                                    icon={ArrowUpIcon}
                                    onClick={() => handleMoveCategoryUp(category, catIndex)}
                                    disabled={catIndex === 0}
                                    size="slim"
                                  />
                                  <Button
                                    icon={ArrowDownIcon}
                                    onClick={() => handleMoveCategoryDown(category, catIndex)}
                                    disabled={catIndex === categories.length - 1}
                                    size="slim"
                                  />
                                  
                                  <Popover
                                    active={activeCategoryPopover === category.id}
                                    activator={
                                      <Button
                                        icon={MenuVerticalIcon}
                                        onClick={() => setActiveCategoryPopover(
                                          activeCategoryPopover === category.id ? null : category.id
                                        )}
                                        size="slim"
                                      />
                                    }
                                    onClose={() => setActiveCategoryPopover(null)}
                                  >
                                    <ActionList
                                      items={[
                                        {
                                          content: 'Add FAQ',
                                          icon: PlusIcon,
                                          onAction: () => {
                                            handleAddFaq(category);
                                            setActiveCategoryPopover(null);
                                          }
                                        },
                                        {
                                          content: 'Edit Category',
                                          icon: EditIcon,
                                          onAction: () => {
                                            handleEditCategory(category);
                                            setActiveCategoryPopover(null);
                                          }
                                        },
                                        {
                                          content: 'Delete Category',
                                          icon: DeleteIcon,
                                          destructive: true,
                                          onAction: () => {
                                            handleDeleteCategory(category.id);
                                            setActiveCategoryPopover(null);
                                          }
                                        }
                                      ]}
                                    />
                                  </Popover>
                                </InlineStack>
                              </InlineStack>

                              <Divider />

                              {/* FAQs List */}
                              {category.faqs.length === 0 ? (
                                <Box padding="300">
                                  <Text tone="subdued" alignment="center">
                                    No FAQs yet. Click the menu to add your first question.
                                  </Text>
                                </Box>
                              ) : (
                                <BlockStack gap="200">
                                  {category.faqs.map((faq, faqIndex) => (
                                    <Card key={faq.id} background="bg-surface-secondary">
                                      <InlineStack align="space-between" blockAlign="start">
                                        <InlineStack gap="200" blockAlign="start">
                                          <Icon source={QuestionCircleIcon} tone="base" />
                                          <BlockStack gap="100">
                                            <InlineStack gap="200" blockAlign="center">
                                              <Text variant="headingSm" as="h4" fontWeight="semibold">
                                                {faq.question}
                                              </Text>
                                              <Badge tone={faq.isActive ? "success" : "critical"}>
                                                {faq.isActive ? "Active" : "Inactive"}
                                              </Badge>
                                            </InlineStack>
                                            <Text tone="subdued" as="p">{faq.answer}</Text>
                                          </BlockStack>
                                        </InlineStack>

                                        <InlineStack gap="100">
                                          <Button
                                            icon={ArrowUpIcon}
                                            onClick={() => handleMoveFaqUp(faq, category, faqIndex)}
                                            disabled={faqIndex === 0}
                                            size="slim"
                                          />
                                          <Button
                                            icon={ArrowDownIcon}
                                            onClick={() => handleMoveFaqDown(faq, category, faqIndex)}
                                            disabled={faqIndex === category.faqs.length - 1}
                                            size="slim"
                                          />
                                          
                                          <Popover
                                            active={activeFaqPopover === faq.id}
                                            activator={
                                              <Button
                                                icon={MenuVerticalIcon}
                                                onClick={() => setActiveFaqPopover(
                                                  activeFaqPopover === faq.id ? null : faq.id
                                                )}
                                                size="slim"
                                              />
                                            }
                                            onClose={() => setActiveFaqPopover(null)}
                                          >
                                            <ActionList
                                              items={[
                                                {
                                                  content: 'Edit FAQ',
                                                  icon: EditIcon,
                                                  onAction: () => {
                                                    handleEditFaq(faq, category);
                                                    setActiveFaqPopover(null);
                                                  }
                                                },
                                                {
                                                  content: 'Delete FAQ',
                                                  icon: DeleteIcon,
                                                  destructive: true,
                                                  onAction: () => {
                                                    handleDeleteFaq(faq.id, category.id);
                                                    setActiveFaqPopover(null);
                                                  }
                                                }
                                              ]}
                                            />
                                          </Popover>
                                        </InlineStack>
                                      </InlineStack>
                                    </Card>
                                  ))}
                                </BlockStack>
                              )}
                            </BlockStack>
                          </Card>
                        ))}
                      </BlockStack>
                    )}
                  </BlockStack>
                </Box>
              )}

              {/* TAB 2: FAQ PAGE SETTINGS */}
              {selectedTab === 1 && (
                <Box padding="400">
                  <BlockStack gap="500">
                    {/* Embed app to theme */}
                    <Card>
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="headingSm" as="h3">Embed app to your theme</Text>
                          <Button onClick={() => window.open(`https://${shop}/admin/themes/current/editor`, '_blank')}>
                            Open theme editor
                          </Button>
                        </InlineStack>
                        <Text tone="subdued">
                          Add the FAQ app block to your theme to display FAQs on your store
                        </Text>
                      </BlockStack>
                    </Card>

                    {/* Display FAQ page */}
                    <Card>
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="headingSm" as="h3">Display FAQ page</Text>
                          <Checkbox
                            checked={settings.headerEnabled}
                            onChange={(value) => setSettings({...settings, headerEnabled: value})}
                          />
                        </InlineStack>
                      </BlockStack>
                    </Card>

                    {/* FAQ page URL */}
                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingSm" as="h3">FAQ page URL</Text>
                        <TextField
                          value={faqPageUrl}
                          readOnly
                          autoComplete="off"
                          connectedRight={
                            <Button onClick={() => {
                              navigator.clipboard.writeText(faqPageUrl);
                              shopify.toast.show("URL copied!");
                            }}>
                              Copy
                            </Button>
                          }
                        />
                      </BlockStack>
                    </Card>

                    {/* Appearance */}
                    <Card>
                      <BlockStack gap="400">
                        <Text variant="headingMd" as="h3">Appearance</Text>

                        {/* Layout */}
                        <BlockStack gap="200">
                          <Text variant="headingSm" as="h4">Layout</Text>
                          <ButtonGroup segmented>
                            <Button
                              pressed={settings.layout === "list"}
                              onClick={() => setSettings({...settings, layout: "list"})}
                            >
                              1-page layout
                            </Button>
                            <Button
                              pressed={settings.layout === "grid"}
                              onClick={() => setSettings({...settings, layout: "grid"})}
                            >
                              Card layout
                            </Button>
                          </ButtonGroup>
                          <Text tone="subdued" variant="bodySm">
                            {settings.layout === "list" 
                              ? "Best for simple FAQs, showing all questions in one list" 
                              : "Best for detailed help center, grouping questions into categories"}
                          </Text>
                        </BlockStack>

                        {/* Color */}
                        <BlockStack gap="200">
                          <Text variant="headingSm" as="h4">Color</Text>
                          <InlineStack gap="200">
                            <ButtonGroup segmented>
                              <Button
                                pressed={settings.appearanceTheme === "preset"}
                                onClick={() => setSettings({...settings, appearanceTheme: "preset"})}
                              >
                                Preset
                              </Button>
                              <Button
                                pressed={settings.appearanceTheme === "custom"}
                                onClick={() => setSettings({...settings, appearanceTheme: "custom"})}
                              >
                                Custom
                              </Button>
                            </ButtonGroup>
                          </InlineStack>

                          {settings.appearanceTheme === "custom" && (
                            <BlockStack gap="300">
                              <TextField
                                label="Page background"
                                value={settings.customBackgroundColor}
                                onChange={(value) => setSettings({...settings, customBackgroundColor: value})}
                                type="color"
                                autoComplete="off"
                              />
                              <TextField
                                label="Question text"
                                value={settings.customTextColor}
                                onChange={(value) => setSettings({...settings, customTextColor: value})}
                                type="color"
                                autoComplete="off"
                              />
                              <TextField
                                label="Answer text"
                                value={settings.customAccentColor}
                                onChange={(value) => setSettings({...settings, customAccentColor: value})}
                                type="color"
                                autoComplete="off"
                              />
                              <TextField
                                label="Button label"
                                value={settings.customAccentColor}
                                onChange={(value) => setSettings({...settings, customAccentColor: value})}
                                type="color"
                                autoComplete="off"
                              />
                            </BlockStack>
                          )}
                        </BlockStack>
                      </BlockStack>
                    </Card>

                    {/* Header */}
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between">
                          <Text variant="headingMd" as="h3">Header</Text>
                          <Button onClick={() => {}}>^</Button>
                        </InlineStack>

                        <TextField
                          label="Heading"
                          value={settings.headerTitle}
                          onChange={(value) => setSettings({...settings, headerTitle: value})}
                          placeholder="Frequently Asked Questions"
                          autoComplete="off"
                        />

                        <TextField
                          label="Description"
                          value={settings.headerDescription}
                          onChange={(value) => setSettings({...settings, headerDescription: value})}
                          placeholder="Got a question? We are here to answer!"
                          multiline={2}
                          autoComplete="off"
                        />

                        <Checkbox
                          label="Banner"
                          checked={settings.headerEnabled}
                          onChange={(value) => setSettings({...settings, headerEnabled: value})}
                        />
                      </BlockStack>
                    </Card>

                    {/* Contact us */}
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between">
                          <Text variant="headingMd" as="h3">Contact us</Text>
                          <Checkbox
                            checked={settings.contactFormEnabled}
                            onChange={(value) => setSettings({...settings, contactFormEnabled: value})}
                          />
                        </InlineStack>

                        {settings.contactFormEnabled && (
                          <Text tone="subdued">
                            Allow customers to contact you via chatbox or email.
                          </Text>
                        )}
                      </BlockStack>
                    </Card>

                    {/* Advanced settings */}
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between">
                          <Text variant="headingMd" as="h3">Advanced settings</Text>
                          <Button onClick={() => {}}>^</Button>
                        </InlineStack>

                        <TextField
                          label="Customize CSS"
                          value={settings.customCSS}
                          onChange={(value) => setSettings({...settings, customCSS: value})}
                          placeholder=".faq-item { margin-bottom: 10px; }"
                          multiline={4}
                          autoComplete="off"
                        />

                        <Text tone="subdued" variant="bodySm">
                          Chat with us to style FAQs page fit with your theme. Chat now.
                        </Text>
                      </BlockStack>
                    </Card>

                    <InlineStack align="end">
                      <Button 
                        variant="primary" 
                        onClick={handleSaveSettings}
                        loading={isSaving}
                      >
                        Save Settings
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Box>
              )}

              {/* TAB 3: FAQ BLOCK */}
              {selectedTab === 2 && (
                <Box padding="400">
                  <BlockStack gap="400">
                    <Banner tone="info">
                      <p>Add the FAQ block to your pages using the theme customizer.</p>
                    </Banner>

                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">How to add FAQ block</Text>
                        <BlockStack gap="200">
                          <Text>1. Go to Online Store → Themes</Text>
                          <Text>2. Click "Customize" on your active theme</Text>
                          <Text>3. Navigate to the page where you want to add FAQs</Text>
                          <Text>4. Click "Add section" and search for "FAQ"</Text>
                          <Text>5. Select your FAQ category to display</Text>
                        </BlockStack>
                        <Button 
                          variant="primary"
                          onClick={() => window.open(`https://${shop}/admin/themes/current/editor`, '_blank')}
                        >
                          Open Theme Editor
                        </Button>
                      </BlockStack>
                    </Card>
                  </BlockStack>
                </Box>
              )}
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Category Modal */}
      <Modal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={editingCategory ? "Edit Category" : "Add Category"}
        primaryAction={{
          content: "Save",
          onAction: handleSaveCategory,
          disabled: !categoryTitle.trim()
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowCategoryModal(false)
          }
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Category Title"
              value={categoryTitle}
              onChange={setCategoryTitle}
              placeholder="e.g., Shipping, Returns, Payment"
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        open={showFaqModal}
        onClose={() => setShowFaqModal(false)}
        title={editingFaq ? "Edit FAQ" : "Add FAQ"}
        primaryAction={{
          content: "Save",
          onAction: handleSaveFaq,
          disabled: !faqQuestion.trim() || !faqAnswer.trim()
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowFaqModal(false)
          }
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {selectedCategory && (
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Text tone="subdued">
                  Category: <strong>{selectedCategory.title}</strong>
                </Text>
              </Box>
            )}

            <Select
              label="Question Icon"
              options={iconOptions.map(icon => ({ label: icon, value: icon }))}
              value={faqIcon}
              onChange={setFaqIcon}
            />

            <TextField
              label="Question"
              value={faqQuestion}
              onChange={setFaqQuestion}
              placeholder="What is your question?"
              autoComplete="off"
            />

            <TextField
              label="Answer"
              value={faqAnswer}
              onChange={setFaqAnswer}
              placeholder="Provide a detailed answer"
              multiline={4}
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}