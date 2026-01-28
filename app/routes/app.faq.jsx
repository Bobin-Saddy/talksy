import { useState, useEffect } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "react-router";
import {
  Page, Layout, Card, Button, Text, BlockStack, InlineStack, Badge, Modal,
  TextField, Icon, EmptyState, Banner, Divider, Tabs, Box, Grid, Link, Scrollable
} from "@shopify/polaris";
import {
  PlusIcon, DeleteIcon, EditIcon, DragHandleIcon, QuestionCircleIcon,
  ViewIcon, DesktopIcon, SearchIcon, ChevronDownIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// --- SERVER SIDE: LOADER ---
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

// --- SERVER SIDE: ACTION (Dynamic Updates) ---
export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("action");

  try {
    switch (actionType) {
      case "toggleStatus":
        const id = parseInt(formData.get("id"));
        const isCat = formData.get("type") === "category";
        const currentStatus = formData.get("currentStatus") === "true";
        
        if (isCat) {
          await prisma.faqCategory.update({ where: { id }, data: { isActive: !currentStatus } });
        } else {
          await prisma.faqItem.update({ where: { id }, data: { isActive: !currentStatus } });
        }
        break;

      case "delete":
        const delId = parseInt(formData.get("id"));
        if (formData.get("type") === "category") {
          await prisma.faqCategory.delete({ where: { id: delId } });
        } else {
          await prisma.faqItem.delete({ where: { id: delId } });
        }
        break;

      case "upsertCategory":
        const catId = formData.get("id");
        const catTitle = formData.get("title");
        if (catId) {
          await prisma.faqCategory.update({ where: { id: parseInt(catId) }, data: { title: catTitle } });
        } else {
          await prisma.faqCategory.create({ data: { title: catTitle, shop, isActive: true, position: 0 } });
        }
        break;
    }
    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: error.message });
  }
}

// --- CLIENT SIDE: COMPONENT ---
export default function FaqPage() {
  const { categories: initialCategories } = useLoaderData();
  const fetcher = useFetcher();
  
  const [categories, setCategories] = useState(initialCategories);
  const [selectedTab, setSelectedTab] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Sync state with Database changes
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setCategories(initialCategories); 
    }
  }, [fetcher, initialCategories]);

  const tabs = [
    { id: 'manage', content: 'Manage FAQs' },
    { id: 'page', content: 'FAQs page' },
    { id: 'block', content: 'FAQs block' },
  ];

  // Handlers
  const handleToggle = (id, currentStatus, type) => {
    fetcher.submit({ id, currentStatus, type, action: "toggleStatus" }, { method: "POST" });
  };

  const handleDelete = (id, type) => {
    if (confirm("Are you sure?")) {
      fetcher.submit({ id, type, action: "delete" }, { method: "POST" });
    }
  };

  const handleSaveCategory = (e) => {
    const formData = new FormData(e.currentTarget);
    formData.append("action", "upsertCategory");
    if (editingCategory) formData.append("id", editingCategory.id);
    fetcher.submit(formData, { method: "POST" });
    setIsModalOpen(false);
  };

  // --- UI SECTIONS ---

  const renderManageFaqs = () => (
    <BlockStack gap="400">
      <Banner tone="info">Drag icons to reorder. Active FAQs appear in your widget instantly.</Banner>
      {categories.map((cat) => (
        <Card key={cat.id}>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <InlineStack gap="200">
                <Icon source={DragHandleIcon} tone="base" />
                <Text variant="headingMd">{cat.title}</Text>
                <Button size="micro" onClick={() => handleToggle(cat.id, cat.isActive, 'category')}>
                  {cat.isActive ? "Active" : "Draft"}
                </Button>
              </InlineStack>
              <InlineStack gap="200">
                <Button icon={PlusIcon} size="slim">Add FAQ</Button>
                <Button icon={EditIcon} size="slim" onClick={() => { setEditingCategory(cat); setIsModalOpen(true); }} />
                <Button icon={DeleteIcon} tone="critical" size="slim" onClick={() => handleDelete(cat.id, 'category')} />
              </InlineStack>
            </InlineStack>
            <Divider />
            {cat.faqs.map((faq) => (
              <Box key={faq.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                <InlineStack align="space-between">
                  <InlineStack gap="300">
                    <Icon source={QuestionCircleIcon} />
                    <BlockStack>
                      <Text fontWeight="bold">{faq.question}</Text>
                      <Text tone="subdued" variant="bodySm">{faq.answer}</Text>
                    </BlockStack>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Button size="slim" onClick={() => handleToggle(faq.id, faq.isActive, 'faq')}>
                      {faq.isActive ? "Active" : "Draft"}
                    </Button>
                    <Button icon={DeleteIcon} tone="critical" size="slim" onClick={() => handleDelete(faq.id, 'faq')} />
                  </InlineStack>
                </InlineStack>
              </Box>
            ))}
          </BlockStack>
        </Card>
      ))}
    </BlockStack>
  );

  const renderFaqPageSettings = () => (
    <Grid>
      <Grid.Cell columnSpan={{ xs: 6, md: 7 }}>
        <BlockStack gap="400">
          <Card>
            <InlineStack align="space-between">
              <Text variant="headingSm">Enable FAQ Page</Text>
              <Button variant="primary">Turn on</Button>
            </InlineStack>
          </Card>
          <Card title="Appearance">
            <BlockStack gap="400">
              <Text variant="headingMd">Layout Style</Text>
              <InlineStack gap="400">
                <Box borderStyle="solid" borderWidth="2px" borderColor="border-brand" padding="400" borderRadius="200" flex="1">
                  <Text fontWeight="bold">List View</Text>
                </Box>
                <Box borderStyle="solid" borderWidth="1px" borderColor="border" padding="400" borderRadius="200" flex="1">
                  <Text fontWeight="bold">Card View</Text>
                </Box>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Grid.Cell>
      <Grid.Cell columnSpan={{ xs: 6, md: 5 }}>
        <Card>
          <Box padding="400" background="bg-surface-secondary" borderRadius="200" minHeight="300px">
            <Text alignment="center" variant="headingLg">Preview</Text>
            <Box paddingBlock="400" background="bg-surface" borderRadius="100" marginTop="400">
               <InlineStack align="space-between" padding="200"><Text>Example Question?</Text><Icon source={ChevronDownIcon} /></InlineStack>
            </Box>
          </Box>
        </Card>
      </Grid.Cell>
    </Grid>
  );

  return (
    <Page title="FAQs" primaryAction={{ content: 'Add Category', onAction: () => { setEditingCategory(null); setIsModalOpen(true); } }}>
      <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
        <Box paddingBlockStart="400">
          {selectedTab === 0 && renderManageFaqs()}
          {selectedTab === 1 && renderFaqPageSettings()}
          {selectedTab === 2 && (
            <Card>
              <EmptyState heading="Add FAQ Block" action={{ content: 'Add Block' }} image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
                <p>Add specific FAQs to any page using theme editor.</p>
              </EmptyState>
            </Card>
          )}
        </Box>
      </Tabs>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? "Edit Category" : "Add New Category"}
      >
        <Modal.Section>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveCategory(e); }}>
            <BlockStack gap="400">
              <TextField label="Category Title" name="title" defaultValue={editingCategory?.title} autoFocus autoComplete="off" />
              <Button submit variant="primary">Save Category</Button>
            </BlockStack>
          </form>
        </Modal.Section>
      </Modal>

      <Box paddingBlock="600" textAlign="center">
        <Text tone="subdued">Created by <Link url="#">Chatty</Link> with love</Text>
      </Box>
    </Page>
  );
}