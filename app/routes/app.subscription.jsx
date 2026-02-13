// app/routes/app.subscription.jsx - FIXED WITH BILLING CANCELLATION HANDLING
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, Form, useSearchParams, useActionData } from "react-router";
import { useEffect } from "react";
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
      "2 free user chats included",
      "Chat history available for 30 days",
    ],
    limits: {
      maxChats: 2,
      maxSearchUsers: 2,
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

  // Use upsert to handle race conditions - creates if not exists, returns existing if it does
  const subscription = await prisma.subscription.upsert({
    where: { shop },
    update: {}, // Don't modify if it exists
    create: {
      shop,
      plan: "FREE",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for free
    },
  });

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
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const selectedPlan = formData.get("plan");

  console.log("🔵 Action triggered - Selected plan:", selectedPlan);

  if (selectedPlan === "FREE") {
    // Downgrade to free - cancel any active subscription
    try {
      const currentSub = await prisma.subscription.findUnique({
        where: { shop },
      });

      if (currentSub?.billingId) {
        await admin.graphql(
          `#graphql
          mutation AppSubscriptionCancel($id: ID!) {
            appSubscriptionCancel(id: $id) {
              appSubscription {
                id
                status
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              id: currentSub.billingId,
            },
          }
        );
      }
    } catch (error) {
      console.error("Error canceling subscription:", error);
    }

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

  // For paid plans, create subscription via GraphQL
  const planConfig = PLANS[selectedPlan];
  
  console.log("🔵 Creating LIVE subscription for:", planConfig.name);
  
  try {
    console.log("🔵 Calling GraphQL API...");
    
    // ✅ PRODUCTION BILLING - NO TEST MODE
    const response = await admin.graphql(
      `#graphql
      mutation AppSubscriptionCreate(
        $name: String!
        $returnUrl: URL!
        $trialDays: Int
        $lineItems: [AppSubscriptionLineItemInput!]!
      ) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          trialDays: $trialDays
          lineItems: $lineItems
        ) {
          appSubscription {
            id
            status
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          name: `${planConfig.name} Plan`,
          returnUrl: `https://${shop}/admin/apps/${process.env.SHOPIFY_APP_HANDLE || 'talksy'}/app/subscription/confirm?plan=${selectedPlan}`,
          trialDays: planConfig.trialDays || 0,
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  price: { 
                    amount: planConfig.price, 
                    currencyCode: "USD" 
                  },
                  interval: "EVERY_30_DAYS",
                }
              }
            }
          ]
        }
      }
    );

    const result = await response.json();
    
    console.log("🔵 GraphQL Response:", JSON.stringify(result, null, 2));
    
    if (result.data?.appSubscriptionCreate?.userErrors?.length > 0) {
      const errorMsg = result.data.appSubscriptionCreate.userErrors[0].message;
      console.error("❌ GraphQL Error:", errorMsg);
      throw new Error(errorMsg);
    }

    const subscriptionData = result.data?.appSubscriptionCreate;
    
    if (!subscriptionData?.appSubscription?.id) {
      console.error("❌ No subscription ID returned");
      throw new Error("Failed to create subscription - no ID returned");
    }

    const subscriptionId = subscriptionData.appSubscription.id;
    const confirmationUrl = subscriptionData.confirmationUrl;

    console.log("✅ LIVE Subscription created:", subscriptionId);
    console.log("🔵 Confirmation URL:", confirmationUrl);

    // ✅ IMPORTANT: Mark subscription as "pending_approval" not "pending"
    // This way we can differentiate between "waiting for billing" vs "billing approved"
    await prisma.subscription.update({
      where: { shop },
      data: {
        plan: selectedPlan,
        status: "pending_approval", // ✅ Custom status for tracking
        billingId: subscriptionId,
      },
    });

    console.log("🔵 Redirecting to billing confirmation...");

    return json({ 
      confirmationUrl,
      redirect: true 
    });

  } catch (error) {
    console.error("❌ Billing error:", error);
    console.error("❌ Error stack:", error.stack);
    return json({ 
      error: error.message,
      details: "Failed to create billing subscription. Please try again."
    }, { status: 500 });
  }
};

export default function Subscription() {
  const { currentPlan, subscription, chatCount, plans } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ✅ Handle App Bridge redirect for billing confirmation
  useEffect(() => {
    if (actionData?.confirmationUrl && actionData?.redirect) {
      console.log("🔵 Client-side redirect to:", actionData.confirmationUrl);
      // Redirect the parent window (breaks out of the iframe)
      window.top.location.href = actionData.confirmationUrl;
    }
  }, [actionData]);

  // Get success/error messages from URL
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const upgradedPlan = searchParams.get('plan');
  
  // ✅ Check if user came back without approving billing
  const billingStatus = searchParams.get('billing');

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
        {/* ✅ SUCCESS BANNER - Only show if billing was actually approved */}
        {success === 'true' && upgradedPlan && (
          <Layout.Section>
            <Banner
              title="Subscription activated!"
              tone="success"
              onDismiss={() => navigate('/app/subscription')}
            >
              Your {PLANS[upgradedPlan]?.name} plan is now active. Enjoy your new features!
            </Banner>
          </Layout.Section>
        )}

        {success === 'downgraded' && (
          <Layout.Section>
            <Banner
              title="Plan downgraded"
              tone="info"
              onDismiss={() => navigate('/app/subscription')}
            >
              You've been downgraded to the Free plan. Your paid features will remain active until the end of your billing period.
            </Banner>
          </Layout.Section>
        )}

        {/* ✅ NEW: Show info banner if user cancelled billing */}
        {billingStatus === 'cancelled' && (
          <Layout.Section>
            <Banner
              title="Subscription not completed"
              tone="info"
              onDismiss={() => navigate('/app/subscription')}
            >
              You cancelled the billing approval. Your current plan remains unchanged. You can upgrade anytime!
            </Banner>
          </Layout.Section>
        )}

        {error && (
          <Layout.Section>
            <Banner
              title="Something went wrong"
              tone="critical"
              onDismiss={() => navigate('/app/subscription')}
            >
              {error === 'no-plan' && 'No plan was specified.'}
              {error === 'no-subscription' && 'No pending subscription found.'}
              {error === 'verification-failed' && 'Could not verify your subscription with Shopify.'}
              {error === 'confirmation-failed' && 'Failed to confirm your subscription.'}
              {!['no-plan', 'no-subscription', 'verification-failed', 'confirmation-failed'].includes(error) && 
                'An unexpected error occurred. Please try again or contact support.'}
            </Banner>
          </Layout.Section>
        )}

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
                {/* ✅ Show "Pending Approval" badge if user didn't complete billing */}
                {subscription.status === "pending_approval" && (
                  <Badge tone="warning">Pending Approval</Badge>
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