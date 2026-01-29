import { useState, useEffect, useCallback } from "react";
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
  BlockStack,
  InlineStack,
  Box,
  Divider,
} from "@shopify/polaris";
import { RefreshIcon, CalendarIcon } from "@shopify/polaris-icons";

export default function ChatAnalytics() {
  const [analytics, setAnalytics] = useState({
    totalConversations: 0,
    resolutionRate: 0,
    assistedRevenue: 0,
    chatToSalesRate: 0,
    totalSalesShare: 0,
    loading: false,
  });

  const [dateRange] = useState("Last 3 days");
  const [setupProgress] = useState({ completed: 3, total: 11 });
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalytics((prev) => ({ ...prev, loading: true }));

      // fake API delay
      setTimeout(() => {
        setAnalytics({
          totalConversations: 12,
          resolutionRate: 85,
          assistedRevenue: 1240,
          chatToSalesRate: 22,
          totalSalesShare: 18,
          loading: false,
        });
      }, 800);
    } catch (e) {
      setAnalytics((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleSubmitFeature = () => {
    if (!featureTitle || !featureDescription) return;

    console.log("Feature submitted:", featureTitle, featureDescription);

    setFeatureTitle("");
    setFeatureDescription("");
  };

  const progressPercent = (setupProgress.completed / setupProgress.total) * 100;

  return (
    <Page
      title="Overview"
      secondaryActions={[
        {
          content: "Reload",
          icon: RefreshIcon,
          onAction: fetchAnalytics,
          loading: analytics.loading,
        },
      ]}
    >
      <Layout>
        {/* Header Row */}
        <Layout.Section>
          <InlineStack gap="400" align="start">
            <Badge icon={CalendarIcon}>{dateRange}</Badge>
            <Text tone="subdued">Compare to: 24 Jan - 26 Jan 2026</Text>
            <Box paddingInlineStart="auto">
              <Text tone="subdued">Updated 33m ago</Text>
            </Box>
          </InlineStack>
        </Layout.Section>

        {/* Metrics */}
        <Layout.Section>
          <InlineStack gap="400">
            <Card>
              <Text tone="subdued">Total conversations</Text>
              <Text variant="heading2xl">{analytics.totalConversations}</Text>
            </Card>
            <Card>
              <Text tone="subdued">Resolution rate</Text>
              <Text variant="heading2xl">{analytics.resolutionRate}%</Text>
            </Card>
            <Card>
              <Text tone="subdued">Assisted revenue</Text>
              <Text variant="heading2xl">₹{analytics.assistedRevenue}</Text>
            </Card>
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <InlineStack gap="400">
            <Card>
              <Text tone="subdued">Chat-to-sales rate</Text>
              <Text variant="heading2xl">{analytics.chatToSalesRate}%</Text>
            </Card>
            <Card>
              <Text tone="subdued">Sales share by Chatty</Text>
              <Text variant="heading2xl">{analytics.totalSalesShare}%</Text>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Setup */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Set up live chat</Text>
              <Text tone="subdued">
                {setupProgress.completed} of {setupProgress.total} tasks completed
              </Text>

              <ProgressBar progress={progressPercent} size="small" />

              <Divider />

              <Button
                fullWidth
                textAlign="left"
                disclosure={liveChatOpen ? "up" : "down"}
                onClick={() => setLiveChatOpen(!liveChatOpen)}
              >
                Set up live chat
              </Button>
              <Collapsible open={liveChatOpen}>
                <Box padding="200">
                  Configure your live chat settings.
                </Box>
              </Collapsible>

              <Button
                fullWidth
                textAlign="left"
                disclosure={aiAssistantOpen ? "up" : "down"}
                onClick={() => setAiAssistantOpen(!aiAssistantOpen)}
              >
                Set up AI assistant
              </Button>
              <Collapsible open={aiAssistantOpen}>
                <Box padding="200">Configure AI assistant.</Box>
              </Collapsible>

              <Button
                fullWidth
                textAlign="left"
                disclosure={faqOpen ? "up" : "down"}
                onClick={() => setFaqOpen(!faqOpen)}
              >
                Set up FAQs
              </Button>
              <Collapsible open={faqOpen}>
                <Box padding="200">Add FAQs.</Box>
              </Collapsible>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Suggest Feature */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Suggest Feature</Text>

              <TextField
                label="Title"
                value={featureTitle}
                onChange={setFeatureTitle}
              />

              <TextField
                label="Description"
                value={featureDescription}
                onChange={setFeatureDescription}
                multiline={4}
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
