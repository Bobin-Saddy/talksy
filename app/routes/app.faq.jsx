	// app/routes/app.faq.jsx
	import { useState, useEffect } from "react";
	import { useLoaderData, useSubmit, useNavigate } from "react-router";
  import { Popover, ActionList } from "@shopify/polaris";
import { MenuVerticalIcon } from "@shopify/polaris-icons";

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
	  Divider
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

	export default function FaqPage() {
	  const { categories: initialCategories, shop } = useLoaderData();
	  const submit = useSubmit();
	  const navigate = useNavigate();

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
	      setEditingFaq(null);
	      setSelectedCategory(null);
	    }
	  }, [showFaqModal]);

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
		// Refresh categories
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

	  // FAQ handlers
	  const handleAddFaq = (category) => {
	    setSelectedCategory(category);
	    setEditingFaq(null);
	    setFaqQuestion("");
	    setFaqAnswer("");
	    setShowFaqModal(true);
	  };

	  const handleEditFaq = (faq, category) => {
	    setSelectedCategory(category);
	    setEditingFaq(faq);
	    setFaqQuestion(faq.question);
	    setFaqAnswer(faq.answer);
	    setShowFaqModal(true);
	  };

	  const handleSaveFaq = async () => {
	    if (!faqQuestion.trim() || !faqAnswer.trim()) return;

	    const formData = new FormData();
	    formData.append("shop", shop);
	    formData.append("question", faqQuestion);
	    formData.append("answer", faqAnswer);
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
		// Refresh categories to get updated FAQs
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

	  return (
	    <Page
	      title="FAQ Management"
	      subtitle="Create and manage FAQ categories and questions for your chat widget"
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
		        FAQs will automatically appear in your chat widget. Organize them by categories for better user experience.
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
		      categories.map((category) => (
		        <Card key={category.id}>
		          <BlockStack gap="400">
		            {/* Category Header */}
		            <InlineStack align="space-between" blockAlign="center">
		              <InlineStack gap="200" blockAlign="center">
		                <Icon source={DragHandleIcon} tone="base" />
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
		                <Button
		                  icon={EditIcon}
		                  onClick={() => handleEditCategory(category)}
		                />
		                <Button
		                  icon={DeleteIcon}
		                  tone="critical"
		                  onClick={() => handleDeleteCategory(category.id)}
		                />
		              </InlineStack>
		            </InlineStack>

		            <Divider />

		            {/* FAQs List */}
		            {category.faqs.length === 0 ? (
		              <TextContainer>
		                <Text tone="subdued">
		                  No FAQs yet. Click "Add FAQ" to create your first question.
		                </Text>
		              </TextContainer>
		            ) : (
		              <BlockStack gap="300">
		                {category.faqs.map((faq) => (
		                  <Card key={faq.id} background="bg-surface-secondary">
		                    <BlockStack gap="300">
		                      <InlineStack align="space-between" blockAlign="start">
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

		                        <InlineStack gap="200">
		                          <Button
		                            icon={EditIcon}
		                            size="slim"
		                            onClick={() => handleEditFaq(faq, category)}
		                          />
		                          <Button
		                            icon={DeleteIcon}
		                            tone="critical"
		                            size="slim"
		                            onClick={() => handleDeleteFaq(faq.id, category.id)}
		                          />
		                        </InlineStack>
		                      </InlineStack>
		                    </BlockStack>
		                  </Card>
		                ))}
		              </BlockStack>
		            )}
		          </BlockStack>
		        </Card>
		      ))
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
		      <TextContainer>
		        <Text tone="subdued">
		          Category: <strong>{selectedCategory.title}</strong>
		        </Text>
		      </TextContainer>
		    )}

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