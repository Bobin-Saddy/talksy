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
    loading: true,
  });

  const [dateRange, setDateRange] = useState("Last 3 days");
  const [setupProgress] = useState({ completed: 3, total: 11 });
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalytics((p) => ({ ...p, loading: true }));

      const res = await fetch("/api/chat-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateRange }),
      });

      const data = await res.json();

      setAnalytics({
        totalConversations: data.totalConversations || 0,
        resolutionRate: data.resolutionRate || 0,
        assistedRevenue: data.assistedRevenue || 0,
        chatToSalesRate: data.chatToSalesRate || 0,
        totalSalesShare: data.totalSalesShare || 0,
        loading: false,
      });
    } catch (e) {
      console.error(e);
      setAnalytics((p) => ({ ...p, loading: false }));
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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

        {/* Header */}
        <Layout.Section>
          <InlineStack gap="400">
            <Badge icon={CalendarIcon}>{dateRange}</Badge>
            <Text tone="subdued">Compare to: 24 Jan - 26 Jan 2026</Text>
            <Box paddingInlineStart="auto">
              <Text tone="subdued">Live data</Text>
            </Box>
          </InlineStack>
        </Layout.Section>

        {/* Metrics */}
        <Layout.Section>
          <InlineStack gap="400">
            <Metric title="Total conversations" value={analytics.totalConversations} />
            <Metric title="Resolution rate" value={`${analytics.resolutionRate}%`} />
            <Metric title="Assisted revenue" value={`₹${analytics.assistedRevenue}`} />
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <InlineStack gap="400">
            <Metric title="Chat-to-sales rate" value={`${analytics.chatToSalesRate}%`} />
            <Metric title="Sales share by Chatty" value={`${analytics.totalSalesShare}%`} />
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

              <SetupItem title="Set up live chat" open={liveChatOpen} setOpen={setLiveChatOpen} />
              <SetupItem title="Set up AI assistant" open={aiAssistantOpen} setOpen={setAiAssistantOpen} />
              <SetupItem title="Set up FAQs" open={faqOpen} setOpen={setFaqOpen} />

            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Feature */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Suggest Feature</Text>

              <TextField label="Title" value={featureTitle} onChange={setFeatureTitle} />
              <TextField label="Description" value={featureDescription} onChange={setFeatureDescription} multiline={4} />

              <Button primary disabled={!featureTitle || !featureDescription}>
                Add idea
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

      </Layout>
    </Page>
  );
}

function Metric({ title, value }) {
  return (
    <Card>
      <Text tone="subdued">{title}</Text>
      <Text variant="heading2xl">{value}</Text>
    </Card>
  );
}

function SetupItem({ title, open, setOpen }) {
  return (
    <>
      <Button fullWidth textAlign="left" disclosure={open ? "up" : "down"} onClick={() => setOpen(!open)}>
        {title}
      </Button>
      <Collapsible open={open}>
        <Box padding="200">Configure {title}</Box>
      </Collapsible>
    </>
  );
}
