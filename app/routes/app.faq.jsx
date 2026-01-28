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
  TextContainer,
  Icon,
  EmptyState,
  Banner,
  Divider,
  Tabs
} from "@shopify/polaris";

import {
  PlusIcon,
  DeleteIcon,
  EditIcon,
  DragHandleIcon,
  QuestionCircleIcon
} from "@shopify/polaris-icons";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const categories = await prisma.faqCategory.findMany({
    where: { shop },
    include: { faqs: { orderBy: { position: "asc" } } },
    orderBy: { position: "asc" }
  });

  return json({ categories, shop });
}

export default function FaqPage() {
  const { categories: initialCategories, shop } = useLoaderData();

  const [selectedTab, setSelectedTab] = useState(0);

  const [categories, setCategories] = useState(initialCategories);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingFaq, setEditingFaq] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [categoryTitle, setCategoryTitle] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");

  const tabs = [
    { id: "faq", content: "FAQ Management" },
    { id: "widget", content: "Widget Questions" }
  ];

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryTitle("");
    setShowCategoryModal(true);
  };

  const handleAddFaq = (category) => {
    setSelectedCategory(category);
    setEditingFaq(null);
    setFaqQuestion("");
    setFaqAnswer("");
    setShowFaqModal(true);
  };

  return (
    <Page
      title="FAQ System"
      subtitle="Manage all questions for your AI Chat Widget"
      primaryAction={{
        content: "Add Category",
        icon: PlusIcon,
        onAction: handleAddCategory
      }}
    >
      <Layout>
        <Layout.Section>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />

          <BlockStack gap="400">

            {/* ================= TAB 1 ================= */}
            {selectedTab === 0 && (
              <>
                <Banner tone="info">
                  FAQs will appear in your AI widget automatically.
                </Banner>

                {categories.length === 0 ? (
                  <Card>
                    <EmptyState
                      heading="Create your first FAQ category"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <Button primary onClick={handleAddCategory}>
                        Add Category
                      </Button>
                    </EmptyState>
                  </Card>
                ) : (
                  categories.map((category) => (
                    <Card key={category.id}>
                      <BlockStack gap="400">
                        <InlineStack align="space-between">
                          <InlineStack gap="200">
                            <Icon source={DragHandleIcon} />
                            <Text variant="headingMd">{category.title}</Text>
                            <Badge>{category.faqs.length} FAQs</Badge>
                          </InlineStack>

                          <Button icon={PlusIcon} onClick={() => handleAddFaq(category)}>
                            Add FAQ
                          </Button>
                        </InlineStack>

                        <Divider />

                        {category.faqs.length === 0 ? (
                          <Text tone="subdued">No questions yet.</Text>
                        ) : (
                          category.faqs.map((faq) => (
                            <Card key={faq.id} background="bg-surface-secondary">
                              <InlineStack align="space-between">
                                <BlockStack>
                                  <InlineStack gap="200">
                                    <Icon source={QuestionCircleIcon} />
                                    <Text variant="headingSm">{faq.question}</Text>
                                  </InlineStack>
                                  <Text tone="subdued">{faq.answer}</Text>
                                </BlockStack>

                                <InlineStack gap="200">
                                  <Button icon={EditIcon} size="slim" />
                                  <Button icon={DeleteIcon} size="slim" tone="critical" />
                                </InlineStack>
                              </InlineStack>
                            </Card>
                          ))
                        )}
                      </BlockStack>
                    </Card>
                  ))
                )}
              </>
            )}

            {/* ================= TAB 2 ================= */}
            {selectedTab === 1 && (
              <>
                <Banner tone="warning">
                  These questions are used directly by AI auto-reply engine.
                </Banner>

                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text variant="headingMd">AI Training Questions</Text>
                      <Button icon={PlusIcon}>Add Question</Button>
                    </InlineStack>

                    <Divider />

                    <Card background="bg-surface-secondary">
                      <InlineStack align="space-between">
                        <BlockStack>
                          <Text variant="headingSm">How does your chatbot work?</Text>
                          <Text tone="subdued">
                            Our chatbot answers automatically using your FAQ database.
                          </Text>
                        </BlockStack>

                        <InlineStack gap="200">
                          <Button icon={EditIcon} size="slim" />
                          <Button icon={DeleteIcon} size="slim" tone="critical" />
                        </InlineStack>
                      </InlineStack>
                    </Card>

                    <Card background="bg-surface-secondary">
                      <InlineStack align="space-between">
                        <BlockStack>
                          <Text variant="headingSm">How to contact support?</Text>
                          <Text tone="subdued">
                            You can contact us using live chat or email support.
                          </Text>
                        </BlockStack>

                        <InlineStack gap="200">
                          <Button icon={EditIcon} size="slim" />
                          <Button icon={DeleteIcon} size="slim" tone="critical" />
                        </InlineStack>
                      </InlineStack>
                    </Card>

                  </BlockStack>
                </Card>
              </>
            )}

          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* ================= CATEGORY MODAL ================= */}
      <Modal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Add Category"
        primaryAction={{ content: "Save" }}
      >
        <Modal.Section>
          <TextField
            label="Category Title"
            value={categoryTitle}
            onChange={setCategoryTitle}
          />
        </Modal.Section>
      </Modal>

      {/* ================= FAQ MODAL ================= */}
      <Modal
        open={showFaqModal}
        onClose={() => setShowFaqModal(false)}
        title="Add FAQ"
        primaryAction={{ content: "Save" }}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField label="Question" value={faqQuestion} onChange={setFaqQuestion} />
            <TextField label="Answer" value={faqAnswer} onChange={setFaqAnswer} multiline={4} />
          </BlockStack>
        </Modal.Section>
      </Modal>

    </Page>
  );
}
