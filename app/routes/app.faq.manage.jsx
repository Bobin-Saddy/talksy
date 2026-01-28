// app/routes/app.faq.manage.jsx
import { useState, useEffect } from "react";
import { useLoaderData } from "react-router";
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
  Icon,
  Popover,
  ActionList,
  Select
} from "@shopify/polaris";
import {
  PlusIcon,
  DeleteIcon,
  EditIcon,
  DragHandleIcon,
  QuestionCircleIcon,
  MenuVerticalIcon
} from "@shopify/polaris-icons";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

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

    return json({ categories, shop });
  } catch (error) {
    console.error("Error loading FAQs:", error);
    return json({ categories: [], shop });
  }
}

// Available FAQ icons
const FAQ_ICONS = [
  { value: "QuestionCircleIcon", label: "Question Circle" },
  { value: "HelpIcon", label: "Help" },
  { value: "InfoIcon", label: "Info" },
  { value: "ChatIcon", label: "Chat" },
  { value: "SupportIcon", label: "Support" },
  { value: "DocumentIcon", label: "Document" },
  { value: "PackageIcon", label: "Package" },
  { value: "DeliveryIcon", label: "Delivery" },
  { value: "PaymentIcon", label: "Payment" },
  { value: "ReturnIcon", label: "Return" }
];

export default function FaqManagePage() {
  const { categories: initialCategories, shop } = useLoaderData();

  const [categories, setCategories] = useState(initialCategories);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingFaq, setEditingFaq] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Category form state
  const [categoryTitle, setCategoryTitle] = useState("");

  // FAQ form state
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqIcon, setFaqIcon] = useState("QuestionCircleIcon");
  const [faqIsActive, setFaqIsActive] = useState(true);

  // Popover states
  const [activePopover, setActivePopover] = useState(null);

  // Reset form when modal closes
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
      setFaqIsActive(true);
      setEditingFaq(null);
      setSelectedCategory(null);
    }
  }, [showFaqModal]);

  // Drag and Drop handlers
  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === "CATEGORY") {
      const reorderedCategories = Array.from(categories);
      const [removed] = reorderedCategories.splice(source.index, 1);
      reorderedCategories.splice(destination.index, 0, removed);

      const updatedCategories = reorderedCategories.map((cat, index) => ({
        ...cat,
        position: index
      }));

      setCategories(updatedCategories);

      try {
        await fetch(`/api/faq/categories/reorder?shop=${shop}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: updatedCategories.map(c => ({ id: c.id, position: c.position }))
          })
        });
      } catch (error) {
        console.error("Error reordering categories:", error);
      }
    } else if (type === "FAQ") {
      const categoryId = result.source.droppableId;
      const category = categories.find(c => c.id === categoryId);
      
      const reorderedFaqs = Array.from(category.faqs);
      const [removed] = reorderedFaqs.splice(source.index, 1);
      reorderedFaqs.splice(destination.index, 0, removed);

      const updatedFaqs = reorderedFaqs.map((faq, index) => ({
        ...faq,
        position: index
      }));

      setCategories(categories.map(cat => 
        cat.id === categoryId ? { ...cat, faqs: updatedFaqs } : cat
      ));

      try {
        await fetch(`/api/faq/items/reorder?shop=${shop}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            faqs: updatedFaqs.map(f => ({ id: f.id, position: f.position }))
          })
        });
      } catch (error) {
        console.error("Error reordering FAQs:", error);
      }
    }
  };

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
        const categoriesResponse = await fetch(`/api/faq/categories?shop=${shop}`);
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData.categories);
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

  const handleToggleCategoryStatus = async (categoryId, currentStatus) => {
    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("id", categoryId);
    formData.append("isActive", (!currentStatus).toString());
    formData.append("action", "toggleStatus");

    try {
      const response = await fetch(`/api/faq/categories?shop=${shop}`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setCategories(categories.map(cat => 
          cat.id === categoryId ? { ...cat, isActive: !currentStatus } : cat
        ));
      }
    } catch (error) {
      console.error("Error toggling category status:", error);
    }
  };

  // FAQ handlers
  const handleAddFaq = (category) => {
    setSelectedCategory(category);
    setEditingFaq(null);
    setFaqQuestion("");
    setFaqAnswer("");
    setFaqIcon("QuestionCircleIcon");
    setFaqIsActive(true);
    setShowFaqModal(true);
  };

  const handleEditFaq = (faq, category) => {
    setSelectedCategory(category);
    setEditingFaq(faq);
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setFaqIcon(faq.icon || "QuestionCircleIcon");
    setFaqIsActive(faq.isActive);
    setShowFaqModal(true);
  };

  const handleSaveFaq = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;

    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("question", faqQuestion);
    formData.append("answer", faqAnswer);
    formData.append("icon", faqIcon);
    formData.append("isActive", faqIsActive.toString());
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
        const categoriesResponse = await fetch(`/api/faq/categories?shop=${shop}`);
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData.categories);
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

  const handleToggleFaqStatus = async (faqId, categoryId, currentStatus) => {
    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("id", faqId);
    formData.append("isActive", (!currentStatus).toString());
    formData.append("action", "toggleStatus");

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
              faqs: cat.faqs.map(faq => 
                faq.id === faqId ? { ...faq, isActive: !currentStatus } : faq
              )
            };
          }
          return cat;
        }));
      }
    } catch (error) {
      console.error("Error toggling FAQ status:", error);
    }
  };

  return (
    <Page
      title="Manage FAQs"
      subtitle="Create and organize FAQ categories and questions"
      primaryAction={{
        content: "Add Category",
        icon: PlusIcon,
        onAction: handleAddCategory
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              <p>
                Create FAQs here, then customize their appearance in the FAQs tab. Drag to reorder.
              </p>
            </Banner>

            {categories.length === 0 ? (
              <Card>
                <EmptyState
                  heading="Create your first FAQ category"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Add categories to organize your frequently asked questions</p>
                  <Button primary onClick={handleAddCategory}>
                    Add Category
                  </Button>
                </EmptyState>
              </Card>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="categories" type="CATEGORY">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      <BlockStack gap="400">
                        {categories.map((category, categoryIndex) => (
                          <Draggable
                            key={category.id}
                            draggableId={category.id}
                            index={categoryIndex}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  opacity: snapshot.isDragging ? 0.9 : 1
                                }}
                              >
                                <Card>
                                  <BlockStack gap="400">
                                    {/* Category Header */}
                                    <InlineStack align="space-between" blockAlign="center">
                                      <InlineStack gap="200" blockAlign="center">
                                        <div {...provided.dragHandleProps}>
                                          <Icon source={DragHandleIcon} tone="base" />
                                        </div>
                                        <Text variant="headingMd" as="h2">
                                          {category.title}
                                        </Text>
                                        <Badge tone={category.isActive ? "success" : "critical"}>
                                          {category.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                        <Badge>{category.faqs.length} FAQs</Badge>
                                      </InlineStack>
                                      
                                      <InlineStack gap="200">
                                        <Button
                                          icon={PlusIcon}
                                          onClick={() => handleAddFaq(category)}
                                        >
                                          Add FAQ
                                        </Button>
                                        
                                        <Popover
                                          active={activePopover === `category-${category.id}`}
                                          activator={
                                            <Button
                                              icon={MenuVerticalIcon}
                                              onClick={() => 
                                                setActivePopover(
                                                  activePopover === `category-${category.id}` 
                                                    ? null 
                                                    : `category-${category.id}`
                                                )
                                              }
                                            />
                                          }
                                          onClose={() => setActivePopover(null)}
                                        >
                                          <ActionList
                                            items={[
                                              {
                                                content: "Edit",
                                                icon: EditIcon,
                                                onAction: () => {
                                                  handleEditCategory(category);
                                                  setActivePopover(null);
                                                }
                                              },
                                              {
                                                content: category.isActive ? "Deactivate" : "Activate",
                                                onAction: () => {
                                                  handleToggleCategoryStatus(category.id, category.isActive);
                                                  setActivePopover(null);
                                                }
                                              },
                                              {
                                                content: "Delete",
                                                icon: DeleteIcon,
                                                destructive: true,
                                                onAction: () => {
                                                  handleDeleteCategory(category.id);
                                                  setActivePopover(null);
                                                }
                                              }
                                            ]}
                                          />
                                        </Popover>
                                      </InlineStack>
                                    </InlineStack>

                                    <Divider />

                                    {/* FAQs List with Drag and Drop */}
                                    {category.faqs.length === 0 ? (
                                      <Text tone="subdued">
                                        No FAQs yet. Click "Add FAQ" to create your first question.
                                      </Text>
                                    ) : (
                                      <Droppable droppableId={category.id} type="FAQ">
                                        {(provided) => (
                                          <div {...provided.droppableProps} ref={provided.innerRef}>
                                            <BlockStack gap="300">
                                              {category.faqs.map((faq, faqIndex) => (
                                                <Draggable
                                                  key={faq.id}
                                                  draggableId={faq.id}
                                                  index={faqIndex}
                                                >
                                                  {(provided, snapshot) => (
                                                    <div
                                                      ref={provided.innerRef}
                                                      {...provided.draggableProps}
                                                      style={{
                                                        ...provided.draggableProps.style,
                                                        opacity: snapshot.isDragging ? 0.9 : 1
                                                      }}
                                                    >
                                                      <Card background="bg-surface-secondary">
                                                        <InlineStack align="space-between" blockAlign="start">
                                                          <InlineStack gap="300" blockAlign="start">
                                                            <div {...provided.dragHandleProps}>
                                                              <Icon source={DragHandleIcon} tone="subdued" />
                                                            </div>
                                                            
                                                            <BlockStack gap="200">
                                                              <InlineStack gap="200" blockAlign="center">
                                                                <Icon source={QuestionCircleIcon} tone="base" />
                                                                <Text variant="headingSm" as="h3" fontWeight="semibold">
                                                                  {faq.question}
                                                                </Text>
                                                                <Badge tone={faq.isActive ? "success" : "critical"}>
                                                                  {faq.isActive ? "Active" : "Inactive"}
                                                                </Badge>
                                                              </InlineStack>
                                                              <Text tone="subdued">{faq.answer}</Text>
                                                            </BlockStack>
                                                          </InlineStack>

                                                          <Popover
                                                            active={activePopover === `faq-${faq.id}`}
                                                            activator={
                                                              <Button
                                                                icon={MenuVerticalIcon}
                                                                size="slim"
                                                                onClick={() => 
                                                                  setActivePopover(
                                                                    activePopover === `faq-${faq.id}` 
                                                                      ? null 
                                                                      : `faq-${faq.id}`
                                                                  )
                                                                }
                                                              />
                                                            }
                                                            onClose={() => setActivePopover(null)}
                                                          >
                                                            <ActionList
                                                              items={[
                                                                {
                                                                  content: "Edit",
                                                                  icon: EditIcon,
                                                                  onAction: () => {
                                                                    handleEditFaq(faq, category);
                                                                    setActivePopover(null);
                                                                  }
                                                                },
                                                                {
                                                                  content: faq.isActive ? "Deactivate" : "Activate",
                                                                  onAction: () => {
                                                                    handleToggleFaqStatus(faq.id, category.id, faq.isActive);
                                                                    setActivePopover(null);
                                                                  }
                                                                },
                                                                {
                                                                  content: "Delete",
                                                                  icon: DeleteIcon,
                                                                  destructive: true,
                                                                  onAction: () => {
                                                                    handleDeleteFaq(faq.id, category.id);
                                                                    setActivePopover(null);
                                                                  }
                                                                }
                                                              ]}
                                                            />
                                                          </Popover>
                                                        </InlineStack>
                                                      </Card>
                                                    </div>
                                                  )}
                                                </Draggable>
                                              ))}
                                              {provided.placeholder}
                                            </BlockStack>
                                          </div>
                                        )}
                                      </Droppable>
                                    )}
                                  </BlockStack>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </BlockStack>
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </BlockStack>
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
              <Text tone="subdued">
                Category: <strong>{selectedCategory.title}</strong>
              </Text>
            )}

            <Select
              label="Icon"
              options={FAQ_ICONS.map(icon => ({
                label: icon.label,
                value: icon.value
              }))}
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

            <Select
              label="Status"
              options={[
                { label: "Active", value: "true" },
                { label: "Inactive", value: "false" }
              ]}
              value={faqIsActive.toString()}
              onChange={(value) => setFaqIsActive(value === "true")}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}