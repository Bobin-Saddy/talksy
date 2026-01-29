import React, { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Badge,
  ProgressBar,
  TextField,
  Collapsible,
  Icon,
  BlockStack,
  InlineStack,
  Box,
  Divider,
} from '@shopify/polaris';
import {
  RefreshIcon,
  CalendarIcon,
} from '@shopify/polaris-icons';

export default function ChatAnalytics() {
  const [analytics, setAnalytics] = useState({
    totalConversations: 0,
    resolutionRate: 0,
    assistedRevenue: 0,
    chatToSalesRate: 0,
    totalSalesShare: 0,
    loading: true,
  });

  const [dateRange, setDateRange] = useState('Last 3 days');
  const [setupProgress] = useState({ completed: 3, total: 11 });
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [featureTitle, setFeatureTitle] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalytics((prev) => ({ ...prev, loading: true }));
      
      const response = await fetch('/api/chat-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dateRange }),
      });

      const data = await response.json();

      setAnalytics({
        totalConversations: data.totalConversations || 0,
        resolutionRate: data.resolutionRate || 0,
        assistedRevenue: data.assistedRevenue || 0,
        chatToSalesRate: data.chatToSalesRate || 0,
        totalSalesShare: data.totalSalesShare || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics((prev) => ({ ...prev, loading: false }));
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleReload = useCallback(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleSubmitFeature = useCallback(() => {
    if (!featureTitle || !featureDescription) {
      return;
    }
    
    // Handle feature submission
    console.log('Feature submitted:', { featureTitle, featureDescription });
    
    // Reset form
    setFeatureTitle('');
    setFeatureDescription('');
  }, [featureTitle, featureDescription]);

  const progressPercent = (setupProgress.completed / setupProgress.total) * 100;

  return (
    <Page
      title="Overview"
      secondaryActions={[
        {
          content: 'Reload',
          icon: RefreshIcon,
          onAction: handleReload,
          loading: analytics.loading,
        },
      ]}
    >
      <Layout>
        {/* Date Range and Metadata */}
        <Layout.Section>
          <InlineStack gap="400" align="start" blockAlign="center">
            <Badge icon={CalendarIcon}>{dateRange}</Badge>
            <Text as="span" variant="bodySm" tone="subdued">
              Compare to: 24 Jan - 26 Jan 2026
            </Text>
            <Box as="span" paddingInlineStart="auto">
              <Text as="span" variant="bodySm" tone="subdued">
                Updated 33m ago
              </Text>
            </Box>
          </InlineStack>
        </Layout.Section>

        {/* Metrics - Row 1 */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <Box width="33.33%">
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Total conversations
                  </Text>
                  <Text as="h2" variant="heading2xl">
                    {analytics.totalConversations}
                  </Text>
                </BlockStack>
              </Card>
            </Box>
            
            <Box width="33.33%">
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Resolution rate
                  </Text>
                  <Text as="h2" variant="heading2xl">
                    {analytics.resolutionRate}%
                  </Text>
                </BlockStack>
              </Card>
            </Box>
            
            <Box width="33.33%">
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Assisted revenue
                  </Text>
                  <Text as="h2" variant="heading2xl">
                    ₹{analytics.assistedRevenue}
                  </Text>
                </BlockStack>
              </Card>
            </Box>
          </InlineStack>
        </Layout.Section>

        {/* Metrics - Row 2 */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <Box width="50%">
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Chat-to-sales rate
                  </Text>
                  <Text as="h2" variant="heading2xl">
                    {analytics.chatToSalesRate}%
                  </Text>
                </BlockStack>
              </Card>
            </Box>
            
            <Box width="50%">
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Total sales share contributed by Chatty
                  </Text>
                  <Text as="h2" variant="heading2xl">
                    {analytics.totalSalesShare}%
                  </Text>
                </BlockStack>
              </Card>
            </Box>
          </InlineStack>
        </Layout.Section>

        {/* Setup Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Set up live chat
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Use this guide to start setup app on your store
                  </Text>
                </BlockStack>
              </InlineStack>

              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  {setupProgress.completed} of {setupProgress.total} tasks completed
                </Text>
                <ProgressBar progress={progressPercent} size="small" />
              </BlockStack>

              <Divider />

              {/* Set up live chat collapsible */}
              <BlockStack gap="200">
                <Button
                  onClick={() => setLiveChatOpen(!liveChatOpen)}
                  ariaExpanded={liveChatOpen}
                  ariaControls="live-chat-collapsible"
                  fullWidth
                  textAlign="left"
                  disclosure={liveChatOpen ? 'up' : 'down'}
                >
                  Set up live chat
                </Button>
                <Collapsible
                  open={liveChatOpen}
                  id="live-chat-collapsible"
                  transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                >
                  <Box paddingBlockStart="200">
                    <Text as="p" variant="bodySm">
                      Configure your live chat settings and appearance.
                    </Text>
                  </Box>
                </Collapsible>
              </BlockStack>

              {/* Set up AI assistant collapsible */}
              <BlockStack gap="200">
                <Button
                  onClick={() => setAiAssistantOpen(!aiAssistantOpen)}
                  ariaExpanded={aiAssistantOpen}
                  ariaControls="ai-assistant-collapsible"
                  fullWidth
                  textAlign="left"
                  disclosure={aiAssistantOpen ? 'up' : 'down'}
                >
                  Set up AI assistant
                </Button>
                <Collapsible
                  open={aiAssistantOpen}
                  id="ai-assistant-collapsible"
                  transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                >
                  <Box paddingBlockStart="200">
                    <Text as="p" variant="bodySm">
                      Configure AI responses and automation rules.
                    </Text>
                  </Box>
                </Collapsible>
              </BlockStack>

              {/* Set up FAQs collapsible */}
              <BlockStack gap="200">
                <Button
                  onClick={() => setFaqOpen(!faqOpen)}
                  ariaExpanded={faqOpen}
                  ariaControls="faq-collapsible"
                  fullWidth
                  textAlign="left"
                  disclosure={faqOpen ? 'up' : 'down'}
                >
                  Set up FAQs
                </Button>
                <Collapsible
                  open={faqOpen}
                  id="faq-collapsible"
                  transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                >
                  <Box paddingBlockStart="200">
                    <Text as="p" variant="bodySm">
                      Add frequently asked questions and answers.
                    </Text>
                  </Box>
                </Collapsible>
              </BlockStack>

              <Divider />

              <Button plain>Let us set up for you</Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Suggest Features Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Suggest Features
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Share your feature ideas
                </Text>
              </BlockStack>

              <TextField
                label="Title"
                value={featureTitle}
                onChange={setFeatureTitle}
                placeholder="Name your feature"
                autoComplete="off"
              />

              <TextField
                label="Description"
                value={featureDescription}
                onChange={setFeatureDescription}
                placeholder="How would this feature help you?"
                multiline={4}
                autoComplete="off"
              />

              <Button
                primary
                onClick={handleSubmitFeature}
                disabled={!featureTitle || !featureDescription}
              >
                Add idea
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}