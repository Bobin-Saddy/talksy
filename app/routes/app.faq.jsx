// app/routes/app.faq.jsx
import { useState, useEffect, useCallback } from "react";
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
  TextContainer,
  Icon,
  EmptyState,
  Banner,
  Divider,
  Popover,
  ActionList,
} from "@shopify/polaris";
import {
  PlusIcon,
  MenuVerticalIcon,
  DragHandleIcon,
  QuestionCircleIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/* ---------------- LOADER ---------------- */

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const categories = await prisma.faqCategory.findMany({
    where: { shop },
    include: { faqs: { orderBy: { position: "asc" } } },
    orderBy: { position: "asc" },
  });

  return json({ categories, shop });
}

/* ---------------- PAGE ---------------- */

export default function FaqPage() {
  const { categories: initialCategories, shop } = useLoaderData();

  const [categories, setCategories] = useState(initialCategories);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);

  const [editingCategory, setEditingCategory] = useState(null);
  const [editingFaq, setEditingFaq] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [categoryTitle, setCategoryTitle] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");

  /* ---------------- HELPERS ---------------- */

  const refresh = async () => {
    const res = await fetch(`/api/faq/categories?shop=${shop}`);
    const data = await res.json();
    setCategories(data.categories);
  };

  /* ---------------- CATEGORY ACTIONS ---------------- */

  const saveCategory = async () => {
    const fd = new FormData();
    fd.append("shop", shop);
    fd.append("title", categoryTitle);
    fd.append("action", editingCategory ? "update" : "create");
    if (editingCategory) fd.append("id", editingCategory.id);

    await fetch(`/api/faq/categories`, { method: "POST", body: fd });
    setShowCategoryModal(false);
    refresh();
  };

  const deleteCategory = async (id) => {
    if (!confirm("Delete category and all FAQs?")) return;
    const fd = new FormData();
    fd.append("id", id);
    fd.append("action", "delete");
    await fetch(`/api/faq/categories`, { method: "POST", body: fd });
    refresh();
  };

  const toggleCategory = async (id) => {
    const fd = new FormData();
    fd.append("id", id);
    fd.append("action", "toggle");
    await fetch(`/api/faq/categories`, { method: "POST", body: fd });
    refresh();
  };

  const moveCategory = async (id, dir) => {
    const fd = new FormData();
    fd.append("id", id);
    fd.append("direction", dir);
    fd.append("action", "reorder");
    await fetch(`/api/faq/categories`, { method: "POST", body: fd });
    refresh();
  };

  /* ---------------- FAQ ACTIONS ---------------- */

  const saveFaq = async () => {
    const fd = new FormData();
    fd.append("shop", shop);
    fd.append("question", faqQuestion);
    fd.append("answer", faqAnswer);
    fd.append("action", editingFaq ? "update" : "create");

    if (editingFaq) fd.append("id", editingFaq.id);
    else fd.append("categoryId", selectedCategory.id);

    await fetch(`/api/faq/items`, { method: "POST", body: fd });
    setShowFaqModal(false);
    refresh();
  };

  const deleteFaq = async (id) => {
    if (!confirm("Delete FAQ?")) return;
    const fd = new FormData();
    fd.append("id", id);
    fd.append("action", "delete");
    await fetch(`/api/faq/items`, { method: "POST", body: fd });
    refresh();
  };

  const toggleFaq = async (id) => {
    const fd = new FormData();
    fd.append("id", id);
    fd.append("action", "toggle");
    await fetch(`/api/faq/items`, { method: "POST", body: fd });
    refresh();
  };

  const moveFaq = async (id, dir) => {
    const fd = new FormData();
    fd.append("id", id);
    fd.append("direction", dir);
    fd.append("action", "reorder");
    await fetch(`/api/faq/items`, { method: "POST", body: fd });
    refresh();
  };

  /* ---------------- UI ---------------- */

  return (
    <Page
      title="FAQs"
      primaryAction={{
        content: "Add Category",
        icon: PlusIcon,
        onAction: () => {
          setEditingCategory(null);
          setCategoryTitle("");
          setShowCategoryModal(true);
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            FAQs will appear automatically in your widget.
          </Banner>

          <BlockStack gap="400">
            {categories.length === 0 && (
              <Card>
                <EmptyState heading="Create your first category">
                  <Button onClick={() => setShowCategoryModal(true)}>
                    Add Category
                  </Button>
                </EmptyState>
              </Card>
            )}

            {categories.map((category) => (
              <Card key={category.id}>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <InlineStack gap="200">
                      <Icon source={DragHandleIcon} />
                      <Text variant="headingMd">{category.title}</Text>
                      <Badge tone={category.isActive ? "success" : "critical"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge>{category.faqs.length} FAQs</Badge>
                    </InlineStack>

                    <InlineStack gap="200">
                      <Button onClick={() => {
                        setSelectedCategory(category);
                        setEditingFaq(null);
                        setFaqQuestion("");
                        setFaqAnswer("");
                        setShowFaqModal(true);
                      }}>
                        Add FAQ
                      </Button>

                      <CategoryActions
                        category={category}
                        onEdit={() => {
                          setEditingCategory(category);
                          setCategoryTitle(category.title);
                          setShowCategoryModal(true);
                        }}
                        onDelete={() => deleteCategory(category.id)}
                        onToggle={() => toggleCategory(category.id)}
                        onMoveUp={() => moveCategory(category.id, "up")}
                        onMoveDown={() => moveCategory(category.id, "down")}
                      />
                    </InlineStack>
                  </InlineStack>

                  <Divider />

                  <BlockStack gap="200">
                    {category.faqs.map((faq) => (
                      <Card key={faq.id} background="bg-surface-secondary">
                        <InlineStack align="space-between">
                          <BlockStack>
                            <InlineStack gap="200">
                              <Icon source={QuestionCircleIcon} />
                              <Text fontWeight="semibold">{faq.question}</Text>
                              <Badge tone={faq.isActive ? "success" : "critical"}>
                                {faq.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </InlineStack>
                            <Text tone="subdued">{faq.answer}</Text>
                          </BlockStack>

                          <FaqActions
                            onEdit={() => {
                              setEditingFaq(faq);
                              setSelectedCategory(category);
                              setFaqQuestion(faq.question);
                              setFaqAnswer(faq.answer);
                              setShowFaqModal(true);
                            }}
                            onDelete={() => deleteFaq(faq.id)}
                            onToggle={() => toggleFaq(faq.id)}
                            onMoveUp={() => moveFaq(faq.id, "up")}
                            onMoveDown={() => moveFaq(faq.id, "down")}
                          />
                        </InlineStack>
                      </Card>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* CATEGORY MODAL */}
      <Modal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Category"
        primaryAction={{ content: "Save", onAction: saveCategory }}
      >
        <Modal.Section>
          <TextField
            label="Title"
            value={categoryTitle}
            onChange={setCategoryTitle}
          />
        </Modal.Section>
      </Modal>

      {/* FAQ MODAL */}
      <Modal
        open={showFaqModal}
        onClose={() => setShowFaqModal(false)}
        title="FAQ"
        primaryAction={{ content: "Save", onAction: saveFaq }}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <TextField label="Question" value={faqQuestion} onChange={setFaqQuestion} />
            <TextField multiline={4} label="Answer" value={faqAnswer} onChange={setFaqAnswer} />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

/* ---------------- ACTION COMPONENTS ---------------- */

function CategoryActions({ onEdit, onDelete, onToggle, onMoveUp, onMoveDown }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      active={open}
      activator={<Button icon={MenuVerticalIcon} onClick={() => setOpen(!open)} />}
      onClose={() => setOpen(false)}
    >
      <ActionList
        items={[
          { content: "Edit", onAction: onEdit },
          { content: "Enable / Disable", onAction: onToggle },
          { content: "Move Up", onAction: onMoveUp },
          { content: "Move Down", onAction: onMoveDown },
          { content: "Delete", destructive: true, onAction: onDelete },
        ]}
      />
    </Popover>
  );
}

function FaqActions({ onEdit, onDelete, onToggle, onMoveUp, onMoveDown }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      active={open}
      activator={<Button size="slim" icon={MenuVerticalIcon} onClick={() => setOpen(!open)} />}
      onClose={() => setOpen(false)}
    >
      <ActionList
        items={[
          { content: "Edit", onAction: onEdit },
          { content: "Enable / Disable", onAction: onToggle },
          { content: "Move Up", onAction: onMoveUp },
          { content: "Move Down", onAction: onMoveDown },
          { content: "Delete", destructive: true, onAction: onDelete },
        ]}
      />
    </Popover>
  );
}
