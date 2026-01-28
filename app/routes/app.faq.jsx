// app/routes/app.faq.jsx - Enhanced with Tabs and Settings
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
  ColorPicker,
  Popover,
  ActionList,
  Box
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
  ImageIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const categories = await prisma.faqCategory.findMany({
      where: { shop },
      include: {
        faqs: {
          orderBy: { position: "asc" }
        }
      },
      orderBy: { position: "asc" }
    });

    // Get FAQ settings (you'll need to create this table)
    const settings = await prisma.faqSettings.findFirst({
      where: { shop }
    }) || {
      headerTitle: "Frequently Asked Questions",
      headerSubtitle: "Find quick answers to common questions",
      headerBgColor: "#6366f1",
      headerTextColor: "#ffffff",
      searchPlaceholder: "🔍 Search FAQs...",
      enableSearch: true,
      showCategoryBadges: true,
      iconStyle: "default" // default, circle, square
    };

    return json({ categories, shop, settings });
  } catch (error) {
    console.error("Error loading FAQs:", error);
    return json({ categories: [], shop, settings: {} });
  }
}

export default function FaqPage() {
  const { categories: initialCategories, shop, settings: initialSettings } = useLoaderData();

  const [selectedTab, setSelectedTab] = useState(0);
  const [categories, setCategories] = useState(initialCategories);
  const [settings, setSettings] = useState(initialSettings);
  
  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  
  // Editing states
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingFaq, setEditingFaq] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Form states
  const [categoryTitle, setCategoryTitle] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqIcon, setFaqIcon] = useState("❓");

  // Popover states
  const [activeCategoryPopover, setActiveCategoryPopover] = useState(null);
  const [activeFaqPopover, setActiveFaqPopover] = useState(null);

  const tabs = [
    { id: 'manage', content: 'Manage FAQs', panelID: 'manage-panel' },
    { id: 'settings', content: 'FAQ Page Settings', panelID: 'settings-panel' }
  ];

  // Reset forms
  useEffect(() => {
    if (!showCategoryModal) {
      setCategoryTitle("");
      setCategoryIcon("");
      setEditingCategory(null);
    }
  }, [showCategoryModal]);

  useEffect(() => {
    if (!showFaqModal) {
      setFaqQuestion("");
      setFaqAnswer("");
      setFaqIcon("❓");
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
    setCategoryIcon("📁");
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryTitle(category.title);
    setCategoryIcon(category.icon || "📁");
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryTitle.trim()) return;

    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("title", categoryTitle);
    formData.append("icon", categoryIcon);
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
    setFaqIcon("❓");
    setShowFaqModal(true);
  };

  const handleEditFaq = (faq, category) => {
    setSelectedCategory(category);
    setEditingFaq(faq);
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setFaqIcon(faq.icon || "❓");
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

  // Save settings
  const handleSaveSettings = async () => {
    try {
      const response = await fetch(`/api/faq/settings?shop=${shop}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });

      const result = await response.json();
      if (result.success) {
        alert("Settings saved successfully!");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const iconOptions = ["❓", "📌", "💡", "⭐", "🔥", "✅", "📝", "🎯", "💬", "🚀", "📦", "💳", "🏷️", "🎁"];

  return (
    <Page
      title="FAQ Management"
      subtitle="Create and manage FAQ categories and questions for your chat widget"
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
                      <p>FAQs will automatically appear in your chat widget. Organize them by categories.</p>
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
                                  <span style={{ fontSize: "24px" }}>{category.icon || "📁"}</span>
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
                                          <span style={{ fontSize: "20px", marginTop: "2px" }}>
                                            {faq.icon || "❓"}
                                          </span>
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
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">FAQ Page Appearance</Text>
                    
                    <Card>
                      <BlockStack gap="400">
                        <Text variant="headingSm" as="h3">Header Settings</Text>
                        
                        <TextField
                          label="Header Title"
                          value={settings.headerTitle}
                          onChange={(value) => setSettings({...settings, headerTitle: value})}
                          placeholder="Frequently Asked Questions"
                          autoComplete="off"
                        />

                        <TextField
                          label="Header Subtitle"
                          value={settings.headerSubtitle}
                          onChange={(value) => setSettings({...settings, headerSubtitle: value})}
                          placeholder="Find quick answers to common questions"
                          autoComplete="off"
                        />

                        <TextField
                          label="Header Background Color"
                          value={settings.headerBgColor}
                          onChange={(value) => setSettings({...settings, headerBgColor: value})}
                          placeholder="#6366f1"
                          type="color"
                          autoComplete="off"
                        />

                        <TextField
                          label="Header Text Color"
                          value={settings.headerTextColor}
                          onChange={(value) => setSettings({...settings, headerTextColor: value})}
                          placeholder="#ffffff"
                          type="color"
                          autoComplete="off"
                        />
                      </BlockStack>
                    </Card>

                    <Card>
                      <BlockStack gap="400">
                        <Text variant="headingSm" as="h3">Search Settings</Text>
                        
                        <TextField
                          label="Search Placeholder Text"
                          value={settings.searchPlaceholder}
                          onChange={(value) => setSettings({...settings, searchPlaceholder: value})}
                          placeholder="🔍 Search FAQs..."
                          autoComplete="off"
                        />

                        <Select
                          label="Enable Search"
                          options={[
                            { label: 'Yes', value: 'true' },
                            { label: 'No', value: 'false' }
                          ]}
                          value={settings.enableSearch?.toString()}
                          onChange={(value) => setSettings({...settings, enableSearch: value === 'true'})}
                        />

                        <Select
                          label="Show Category Badges"
                          options={[
                            { label: 'Yes', value: 'true' },
                            { label: 'No', value: 'false' }
                          ]}
                          value={settings.showCategoryBadges?.toString()}
                          onChange={(value) => setSettings({...settings, showCategoryBadges: value === 'true'})}
                        />
                      </BlockStack>
                    </Card>

                    <InlineStack align="end">
                      <Button variant="primary" onClick={handleSaveSettings}>
                        Save Settings
                      </Button>
                    </InlineStack>
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

            <div>
              <Text as="p" variant="bodyMd" fontWeight="medium">Category Icon</Text>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                {iconOptions.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setCategoryIcon(icon)}
                    style={{
                      fontSize: "24px",
                      padding: "8px",
                      border: categoryIcon === icon ? "2px solid #6366f1" : "1px solid #e2e8f0",
                      borderRadius: "8px",
                      background: categoryIcon === icon ? "#f0f0ff" : "white",
                      cursor: "pointer"
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
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

            <div>
              <Text as="p" variant="bodyMd" fontWeight="medium">Question Icon</Text>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                {iconOptions.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setFaqIcon(icon)}
                    style={{
                      fontSize: "20px",
                      padding: "6px",
                      border: faqIcon === icon ? "2px solid #6366f1" : "1px solid #e2e8f0",
                      borderRadius: "6px",
                      background: faqIcon === icon ? "#f0f0ff" : "white",
                      cursor: "pointer"
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

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