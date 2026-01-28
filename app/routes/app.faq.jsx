// app/routes/app.faq.jsx
import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useSubmit, useNavigate } from "react-router";
import {
  Page, Layout, Card, Button, Text, BlockStack, InlineStack, Badge, Modal,
  TextField, Icon, EmptyState, Banner, Divider, Tabs, Box, Grid, Select, RangeSlider,
  TextContainer, Link, Bleed
} from "@shopify/polaris";
import {
  PlusIcon, DeleteIcon, EditIcon, DragHandleIcon, QuestionCircleIcon,
  ViewIcon, LayoutIcon, DesktopIcon, SearchIcon, ChevronDownIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  try {
    const categories = await prisma.faqCategory.findMany({
      where: { shop },
      include: { faqs: { orderBy: { position: "asc" } } },
      orderBy: { position: "asc" }
    });
    return { categories, shop };
  } catch (error) {
    return { categories: [], shop };
  }
}

export default function FaqPage() {
  const { categories: initialCategories, shop } = useLoaderData();
  const [categories, setCategories] = useState(initialCategories);
  const [selectedTab, setSelectedTab] = useState(0);

  // Tab Definitions
  const tabs = [
    { id: 'manage-faqs', content: 'Manage FAQs' },
    { id: 'faq-page', content: 'FAQs page' },
    { id: 'faq-block', content: 'FAQs block' },
  ];

  // Appearance State (For Tab 2)
  const [layout, setLayout] = useState('one-page'); // 'one-page' or 'card'
  const [faqTitleColor, setFaqTitleColor] = useState('#3B3B3B');

  // --- HANDLERS ---

  const handleToggleStatus = (id, type) => {
    // Logic to toggle Active/Draft
    setCategories(prev => prev.map(cat => {
      if (type === 'category' && cat.id === id) return { ...cat, isActive: !cat.isActive };
      if (type === 'faq') {
        return {
          ...cat,
          faqs: cat.faqs.map(f => f.id === id ? { ...f, isActive: !f.isActive } : f)
        };
      }
      return cat;
    }));
  };

  // --- RENDER FUNCTIONS ---

  // TAB 1: MANAGE FAQS
  const renderManageFaqs = () => (
    <BlockStack gap="400">
      <Banner tone="info">
        FAQs will automatically appear in your chat widget. Organize them by categories for better user experience.
      </Banner>
      {categories.length === 0 ? (
        <Card><EmptyState heading="No FAQs yet" action={{ content: 'Add Category' }} image="" /></Card>
      ) : (
        categories.map((category) => (
          <Card key={category.id}>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <InlineStack gap="200">
                  <Icon source={DragHandleIcon} tone="base" />
                  <Text variant="headingMd">{category.title}</Text>
                  <Button size="micro" onClick={() => handleToggleStatus(category.id, 'category')}>
                    {category.isActive ? "Active" : "Draft"}
                  </Button>
                </InlineStack>
                <InlineStack gap="200">
                  <Button icon={PlusIcon}>Add FAQ</Button>
                  <Button icon={EditIcon} />
                  <Button icon={DeleteIcon} tone="critical" />
                </InlineStack>
              </InlineStack>
              <Divider />
              {category.faqs.map((faq) => (
                <Box key={faq.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                  <InlineStack align="space-between">
                    <InlineStack gap="300">
                       <Icon source={QuestionCircleIcon} />
                       <BlockStack>
                          <Text variant="bodyMd" fontWeight="bold">{faq.question}</Text>
                          <Text tone="subdued">{faq.answer}</Text>
                       </BlockStack>
                    </InlineStack>
                    <InlineStack gap="100">
                       <Button size="slim" onClick={() => handleToggleStatus(faq.id, 'faq')}>
                         {faq.isActive ? "Active" : "Draft"}
                       </Button>
                       <Button icon={EditIcon} size="slim" />
                       <Button icon={DeleteIcon} tone="critical" size="slim" />
                    </InlineStack>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          </Card>
        ))
      )}
    </BlockStack>
  );

  // TAB 2: FAQ PAGE SETTINGS
  const renderFaqPageSettings = () => (
    <Grid>
      <Grid.Cell columnSpan={{ xs: 6, md: 7 }}>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text variant="headingSm">Embed app to your theme</Text>
                <Button variant="primary">Turn on</Button>
              </InlineStack>
              <Divider />
              <InlineStack align="space-between">
                <Text>Display FAQs page</Text>
                <Button variant="tertiary" icon={ViewIcon} />
              </InlineStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Appearance</Text>
              <Text variant="headingSm">Layout</Text>
              <InlineStack gap="400">
                <div 
                  onClick={() => setLayout('one-page')}
                  style={{ 
                    cursor: 'pointer', border: layout === 'one-page' ? '2px solid #008060' : '1px solid #ddd',
                    padding: '12px', borderRadius: '8px', flex: 1 
                  }}
                >
                  <Box background="bg-surface-secondary" height="60px" marginBottom="200" />
                  <Text fontWeight="bold">1 page layout</Text>
                  <Text variant="bodyXs" tone="subdued">Simple list for all FAQs</Text>
                </div>
                <div 
                  onClick={() => setLayout('card')}
                  style={{ 
                    cursor: 'pointer', border: layout === 'card' ? '2px solid #008060' : '1px solid #ddd',
                    padding: '12px', borderRadius: '8px', flex: 1 
                  }}
                >
                  <Box background="bg-surface-secondary" height="60px" marginBottom="200" />
                  <Text fontWeight="bold">Card layout</Text>
                  <Text variant="bodyXs" tone="subdued">Detailed help center style</Text>
                </div>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Grid.Cell>

      <Grid.Cell columnSpan={{ xs: 6, md: 5 }}>
        <Card padding="0">
          <Box padding="400" borderBottomWidth="1px" borderColor="border">
            <InlineStack align="space-between">
               <Text variant="headingSm">Preview</Text>
               <Button size="slim" icon={DesktopIcon}>Desktop</Button>
            </InlineStack>
          </Box>
          <Box padding="600" background="bg-surface-secondary">
             <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <Text variant="headingLg" alignment="center">Frequently Asked Questions</Text>
                <div style={{ marginTop: '15px', padding: '8px', border: '1px solid #eee', borderRadius: '4px' }}>
                   <InlineStack align="space-between"><Text tone="subdued">Search...</Text><Icon source={SearchIcon} /></InlineStack>
                </div>
                <div style={{ marginTop: '20px' }}>
                   <Text fontWeight="bold">Order & Shipping</Text>
                   <Box paddingBlock="200" borderBottomWidth="1px" borderColor="border">
                      <InlineStack align="space-between"><Text variant="bodySm">How to track my order?</Text><Icon source={ChevronDownIcon} /></InlineStack>
                   </Box>
                </div>
             </div>
          </Box>
        </Card>
      </Grid.Cell>
    </Grid>
  );

  // TAB 3: FAQ BLOCKS
  const renderFaqBlocks = () => (
    <Card>
      <Box padding="1000">
        <EmptyState
          heading="Add FAQs block"
          action={{ content: 'Add block' }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Add an FAQs block to display specific FAQs on any pages of your store.</p>
        </EmptyState>
      </Box>
    </Card>
  );

  return (
    <Page 
      title="FAQs" 
      primaryAction={selectedTab === 0 ? { content: 'Add Category', icon: PlusIcon } : null}
    >
      <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
        <Box paddingBlockStart="400">
          {selectedTab === 0 && renderManageFaqs()}
          {selectedTab === 1 && renderFaqPageSettings()}
          {selectedTab === 2 && renderFaqBlocks()}
        </Box>
      </Tabs>
      
      <Box paddingBlock="600" textAlign="center">
        <Text tone="subdued">Created by <Link url="#">Chatty</Link> with love</Text>
      </Box>
    </Page>
  );
}