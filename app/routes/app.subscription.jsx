// app/routes/app.subscription.jsx - FIXED BILLING
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, Form } from "react-router";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Divider,
  Banner,
  Icon,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Plan definitions
const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    interval: "forever",
    features: [
      "100 free user chats included",
      "Search up to 100 chat users",
      "Chat history available for 30 days",
    ],
    limits: {
      maxChats: 100,
      maxSearchUsers: 100,
      chatHistoryDays: 30,
      canManageFAQs: false,
      canCustomizeWidget: false,
    },
  },
  STANDARD: {
    name: "Standard",
    price: 9.49,
    interval: "month",
    trialDays: 14,
    features: [
      "500 free user chats included",
      "Search up to 500 chat users",
      "Chat widget updates for 500 users",
      "Manage FAQs for up to 500 users",
      "14-day free trial",
    ],
    limits: {
      maxChats: 500,
      maxSearchUsers: 500,
      chatHistoryDays: 90,
      canManageFAQs: true,
      canCustomizeWidget: true,
    },
    badge: "Popular",
  },
  PREMIUM: {
    name: "Premium",
    price: 24.99,
    interval: "month",
    trialDays: 14,
    features: [
      "Unlimited users with free chat access",
      "Unlimited chat user search",
      "Unlimited chat widget updates",
      "Unlimited FAQ management",
      "Customizable FAQ page creation",
      "Priority support",
      "14-day free trial",
    ],
    limits: {
      maxChats: -1, // -1 means unlimited
      maxSearchUsers: -1,
      chatHistoryDays: -1,
      canManageFAQs: true,
      canCustomizeWidget: true,
      canCreateCustomFAQPage: true,
    },
    badge: "Best Value",
  },
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get current subscription from database
  let subscription = await prisma.subscription.findUnique({
    where: { shop },
  });

  // If no subscription exists, create a free one
  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        shop,
        plan: "FREE",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for free
      },
    });
  }

  // Get usage stats
  const chatCount = await prisma.chatSession.count({
    where: { shop },
  }).catch(() => 0);

  return json({
    shop,
    currentPlan: subscription.plan,
    subscription,
    chatCount,
    plans: PLANS,
  });
};

export const action = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const selectedPlan = formData.get("plan");

  if (selectedPlan === "FREE") {
    // Downgrade to free - cancel any active subscription
    try {
      const currentSub = await prisma.subscription.findUnique({
        where: { shop },
      });

      if (currentSub?.billingId) {
        // Cancel the Shopify subscription
        await billing.cancel({
          subscriptionId: currentSub.billingId,
        });
      }
    } catch (error) {
      console.error("Error canceling subscription:", error);
    }

    // Update database to free plan
    await prisma.subscription.update({
      where: { shop },
      data: {
        plan: "FREE",
        status: "active",
        billingId: null,
        cancelledAt: new Date(),
      },
    });
    
    return redirect("/app/subscription?success=downgraded");
  }

  // For paid plans, create Shopify billing charge
  const planConfig = PLANS[selectedPlan];
  
  try {
    // Use the correct Shopify billing API
    const billingResponse = await billing.request({
      plan: planConfig.name,
      amount: planConfig.price,
      currencyCode: "USD",
      interval: "EVERY_30_DAYS", // ✅ FIXED: Use string instead of billing.Interval
      trialDays: planConfig.trialDays || 0,
      returnUrl: `https://${shop}/admin/apps/chat-widget/app/subscription/confirm?plan=${selectedPlan}`,
    });

    // Save pending subscription
    await prisma.subscription.update({
      where: { shop },
      data: {
        plan: selectedPlan,
        status: "pending",
        billingId: billingResponse.id,
      },
    });

    // Redirect to Shopify's billing confirmation page
    return redirect(billingResponse.confirmationUrl);
  } catch (error) {
    console.error("Billing error:", error);
    return json({ 
      error: error.message,
      details: "Failed to create billing subscription. Check your Shopify app configuration."
    }, { status: 500 });
  }
};

export default function Subscription() {
  const { currentPlan, subscription, chatCount, plans } = useLoaderData();

  const currentPlanConfig = PLANS[currentPlan];
  const usagePercentage = currentPlanConfig.limits.maxChats > 0 
    ? (chatCount / currentPlanConfig.limits.maxChats) * 100 
    : 0;

  return (
    <Page
      title="Subscription Plans"
      subtitle="Choose the plan that fits your business needs"
    >
      <Layout>
        {/* Current Plan Status */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    Current Plan: {currentPlanConfig.name}
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    {currentPlanConfig.price === 0 
                      ? "Free forever" 
                      : `$${currentPlanConfig.price}/${currentPlanConfig.interval}`}
                  </Text>
                </BlockStack>
                {subscription.status === "trialing" && (
                  <Badge tone="info">Trial Active</Badge>
                )}
                {subscription.status === "active" && currentPlan !== "FREE" && (
                  <Badge tone="success">Active</Badge>
                )}
              </InlineStack>

              <Divider />

              {/* Usage Stats */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">
                  Usage This Month
                </Text>
                
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text>Chat Sessions</Text>
                    <Text>
                      {chatCount} / {currentPlanConfig.limits.maxChats === -1 
                        ? "Unlimited" 
                        : currentPlanConfig.limits.maxChats}
                    </Text>
                  </InlineStack>
                  
                  {currentPlanConfig.limits.maxChats > 0 && (
                    <div style={{ 
                      width: "100%", 
                      height: "8px", 
                      backgroundColor: "#e4e5e7", 
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}>
                      <div style={{ 
                        width: `${Math.min(usagePercentage, 100)}%`, 
                        height: "100%", 
                        backgroundColor: usagePercentage > 90 ? "#d72c0d" : "#008060",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                  )}

                  {usagePercentage > 90 && currentPlan !== "PREMIUM" && (
                    <Banner tone="warning">
                      You're approaching your plan limit. Consider upgrading to avoid interruptions.
                    </Banner>
                  )}
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Pricing Cards */}
        <Layout.Section>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
            gap: "20px" 
          }}>
            {Object.entries(plans).map(([planKey, plan]) => {
              const isCurrentPlan = currentPlan === planKey;
              const isUpgrade = 
                (currentPlan === "FREE" && planKey !== "FREE") ||
                (currentPlan === "STANDARD" && planKey === "PREMIUM");
              
              return (
                <Card key={planKey}>
                  <BlockStack gap="400">
                    {/* Plan Header */}
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="start">
                        <Text variant="headingLg" as="h3">
                          {plan.name}
                        </Text>
                        {plan.badge && !isCurrentPlan && (
                          <Badge tone="info">{plan.badge}</Badge>
                        )}
                        {isCurrentPlan && (
                          <Badge tone="success">Current Plan</Badge>
                        )}
                      </InlineStack>

                      <InlineStack gap="100" blockAlign="baseline">
                        <Text variant="heading2xl" as="p">
                          ${plan.price}
                        </Text>
                        {plan.price > 0 && (
                          <Text variant="bodyLg" tone="subdued">
                            / {plan.interval}
                          </Text>
                        )}
                      </InlineStack>

                      {plan.trialDays && !isCurrentPlan && (
                        <Text variant="bodySm" tone="subdued">
                          {plan.trialDays}-day free trial
                        </Text>
                      )}
                    </BlockStack>

                    <Divider />

                    {/* Features List */}
                    <BlockStack gap="300">
                      {plan.features.map((feature, index) => (
                        <InlineStack key={index} gap="200" blockAlign="start">
                          <div style={{ marginTop: "2px" }}>
                            <Icon source={CheckIcon} tone="success" />
                          </div>
                          <Text variant="bodyMd">{feature}</Text>
                        </InlineStack>
                      ))}
                    </BlockStack>

                    {/* Action Button */}
                    <Form method="post">
                      <input type="hidden" name="plan" value={planKey} />
                      <Button
                        submit
                        variant={isUpgrade ? "primary" : "secondary"}
                        disabled={isCurrentPlan}
                        fullWidth
                      >
                        {isCurrentPlan 
                          ? "Current Plan" 
                          : isUpgrade 
                          ? "Upgrade Now" 
                          : planKey === "FREE"
                          ? "Downgrade to Free"
                          : "Select Plan"}
                      </Button>
                    </Form>
                  </BlockStack>
                </Card>
              );
            })}
          </div>
        </Layout.Section>

        {/* FAQ Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Frequently Asked Questions
              </Text>

              <BlockStack gap="300">
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">
                    Can I change my plan anytime?
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    Yes! You can upgrade or downgrade your plan at any time. 
                    Upgrades take effect immediately, while downgrades will apply at the end of your current billing cycle.
                  </Text>
                </BlockStack>

                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">
                    What happens if I exceed my plan limits?
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    Your chat widget will continue working, but new chats may be restricted. 
                    We recommend upgrading before reaching your limit to ensure uninterrupted service.
                  </Text>
                </BlockStack>

                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">
                    How do free trials work?
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    Standard and Premium plans include a 14-day free trial. 
                    You won't be charged until the trial ends. Cancel anytime during the trial at no cost.
                  </Text>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}