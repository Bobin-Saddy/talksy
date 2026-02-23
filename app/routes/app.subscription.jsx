// app/routes/app.subscription.jsx - UPDATED WITH ACCURATE FEATURES
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
import { CheckIcon, XIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const TEST_MODE = true; // ⚠️ CHANGE TO false FOR PRODUCTION O

// ✅ Updated plan features based on all implemented modules
const PLANS = {
  FREE: {
    name    : "Free",
    price   : 0,
    interval: "forever",
    features: [
      { text: "100 chat sessions included",                included: true  },
      { text: "30-day chat history",                       included: true  },
      { text: "Email alerts (30 min delay)",               included: true  },
      { text: "Product & order search in widget",          included: false },
      { text: "Push notifications",                        included: false },
      { text: "FAQ management",                            included: false },
      { text: "Widget customization",                      included: false },
      { text: "Custom FAQ page",                           included: false },
      { text: "Hide \"Powered by Talksy\" branding",      included: false },
    ],
    limits: {
      maxChats          : 100,
      maxSearchUsers    : 100,
      chatHistoryDays   : 30,
      canManageFAQs     : false,
      canCustomizeWidget: false,
    },
  },
  STANDARD: {
    name    : "Standard",
    price   : 9.49,
    interval: "month",
    trialDays: 14,
    badge   : "Popular",
    features: [
      { text: "500 chat sessions included",                included: true  },
      { text: "6-month chat history",                      included: true  },
      { text: "Push notifications (instant)",              included: true  },
      { text: "Email alerts (5 min delay)",                included: true  },
      { text: "Search up to 500 users",                    included: true  },
      { text: "FAQ management",                            included: true  },
      { text: "Widget customization",                      included: true  },
      { text: "Custom FAQ page",                           included: true },
      { text: "Hide \"Powered by Talksy\" branding",      included: false },
      { text: "14-day free trial",                         included: true  },
    ],
    limits: {
      maxChats          : 500,
      maxSearchUsers    : 500,
      chatHistoryDays   : 180,
      canManageFAQs     : true,
      canCustomizeWidget: true,
    },
  },
  PREMIUM: {
    name    : "Premium",
    price   : 24.99,
    interval: "month",
    trialDays: 14,
    badge   : "Best Value",
    features: [
      { text: "Unlimited chat sessions",                   included: true  },
      { text: "Unlimited chat history",                    included: true  },
      { text: "Push notifications (instant)",              included: true  },
      { text: "Email alerts (1 min delay)",                included: true  },
      { text: "Unlimited user search",                     included: true  },
      { text: "FAQ management",                            included: true  },
      { text: "Widget customization",                      included: true  },
      { text: "Custom FAQ page",                           included: true  },
      { text: "Hide \"Powered by Talksy\" branding",      included: true  }, // ✅ Premium only
      { text: "14-day free trial",                         included: true  },
    ],
    limits: {
      maxChats              : -1,
      maxSearchUsers        : -1,
      chatHistoryDays       : -1,
      canManageFAQs         : true,
      canCustomizeWidget    : true,
      canCreateCustomFAQPage: true,
    },
  },
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url           = new URL(request.url);
  const billingStatus = url.searchParams.get("billing");

  const subscription = await prisma.subscription.upsert({
    where : { shop },
    update: {},
    create: {
      shop,
      plan    : "FREE",
      status  : "active",
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  if (billingStatus === "cancelled" && subscription.status === "pending_approval") {
    await prisma.subscription.update({
      where: { shop },
      data : { plan: "FREE", status: "active", billingId: null },
    });
    const updatedSubscription = await prisma.subscription.findUnique({ where: { shop } });
    const chatCount = await prisma.chatSession.count({ where: { shop } }).catch(() => 0);
    return json({ shop, currentPlan: "FREE", actualPlan: "FREE", subscription: updatedSubscription, chatCount, plans: PLANS, testMode: TEST_MODE });
  }

  const chatCount = await prisma.chatSession.count({ where: { shop } }).catch(() => 0);
  let displayPlan = subscription.plan;
  if (subscription.status === "pending_approval") displayPlan = "FREE";

  return json({ shop, currentPlan: displayPlan, actualPlan: subscription.plan, subscription, chatCount, plans: PLANS, testMode: TEST_MODE });
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop        = session.shop;
  const formData    = await request.formData();
  const selectedPlan = formData.get("plan");

  if (selectedPlan === "FREE") {
    try {
      const currentSub = await prisma.subscription.findUnique({ where: { shop } });
      if (currentSub?.billingId) {
        await admin.graphql(
          `#graphql
          mutation AppSubscriptionCancel($id: ID!) {
            appSubscriptionCancel(id: $id) {
              appSubscription { id status }
              userErrors { field message }
            }
          }`,
          { variables: { id: currentSub.billingId } }
        );
      }
    } catch (err) { console.error("Cancel error:", err); }

    await prisma.subscription.update({
      where: { shop },
      data : { plan: "FREE", status: "active", billingId: null, cancelledAt: new Date() },
    });
    return redirect("/app/subscription?success=downgraded");
  }

  const planConfig = PLANS[selectedPlan];
  try {
    const response = await admin.graphql(
      `#graphql
      mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $trialDays: Int, $test: Boolean, $lineItems: [AppSubscriptionLineItemInput!]!) {
        appSubscriptionCreate(name: $name returnUrl: $returnUrl trialDays: $trialDays test: $test lineItems: $lineItems) {
          appSubscription { id status test }
          confirmationUrl
          userErrors { field message }
        }
      }`,
      {
        variables: {
          name      : `${planConfig.name} Plan`,
          returnUrl : `https://${shop}/admin/apps/${process.env.SHOPIFY_APP_HANDLE || "talksy"}/app/subscription/confirm?plan=${selectedPlan}`,
          trialDays : planConfig.trialDays || 0,
          test      : TEST_MODE,
          lineItems : [{ plan: { appRecurringPricingDetails: { price: { amount: planConfig.price, currencyCode: "USD" }, interval: "EVERY_30_DAYS" } } }],
        },
      }
    );

    const result = await response.json();
    if (result.data?.appSubscriptionCreate?.userErrors?.length > 0)
      throw new Error(result.data.appSubscriptionCreate.userErrors[0].message);

    const subscriptionData = result.data?.appSubscriptionCreate;
    if (!subscriptionData?.appSubscription?.id) throw new Error("No subscription ID returned");

    await prisma.subscription.update({
      where: { shop },
      data : { plan: selectedPlan, status: "pending_approval", billingId: subscriptionData.appSubscription.id },
    });

    return json({ confirmationUrl: subscriptionData.confirmationUrl, redirect: true });
  } catch (error) {
    console.error("❌ Billing error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

// ── Feature row component ──────────────────────────────────
function FeatureRow({ text, included }) {
  return (
    <InlineStack gap="200" blockAlign="start">
      <div style={{ marginTop: "2px", flexShrink: 0 }}>
        {included
          ? <Icon source={CheckIcon} tone="success" />
          : <Icon source={XIcon}     tone="subdued" />}
      </div>
      <Text variant="bodyMd" tone={included ? undefined : "subdued"}>
        {text}
      </Text>
    </InlineStack>
  );
}

export default function Subscription() {
  const { currentPlan, actualPlan, subscription, chatCount, plans, testMode } = useLoaderData();
  const actionData     = useActionData();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const success       = searchParams.get("success");
  const error         = searchParams.get("error");
  const upgradedPlan  = searchParams.get("plan");
  const billingStatus = searchParams.get("billing");

  useEffect(() => {
    if (actionData?.confirmationUrl && actionData?.redirect) {
      window.top.location.href = actionData.confirmationUrl;
    }
  }, [actionData]);

  useEffect(() => {
    if (billingStatus === "cancelled") {
      const t = setTimeout(() => navigate("/app/subscription", { replace: true }), 3000);
      return () => clearTimeout(t);
    }
  }, [billingStatus, navigate]);

  const currentPlanConfig = PLANS[currentPlan];
  const usagePercentage   = currentPlanConfig.limits.maxChats > 0
    ? (chatCount / currentPlanConfig.limits.maxChats) * 100
    : 0;

  return (
    <Page title="Subscription Plans" subtitle="Choose the plan that fits your business needs">
      <Layout>

        {testMode && (
          <Layout.Section>
            <Banner tone="warning">
              <strong>⚠️ TEST MODE ENABLED</strong> — You won't be charged. Set TEST_MODE = false for production.
            </Banner>
          </Layout.Section>
        )}

        {success === "true" && upgradedPlan && (
          <Layout.Section>
            <Banner title="Subscription activated!" tone="success" onDismiss={() => navigate("/app/subscription")}>
              Your {PLANS[upgradedPlan]?.name} plan is now active. Enjoy your new features!
            </Banner>
          </Layout.Section>
        )}

        {success === "downgraded" && (
          <Layout.Section>
            <Banner title="Plan downgraded" tone="info" onDismiss={() => navigate("/app/subscription")}>
              You've been switched to the Free plan.
            </Banner>
          </Layout.Section>
        )}

        {billingStatus === "cancelled" && (
          <Layout.Section>
            <Banner title="Subscription not completed" tone="info" onDismiss={() => navigate("/app/subscription")}>
              You cancelled the billing approval. Your current plan remains unchanged.
            </Banner>
          </Layout.Section>
        )}

        {subscription.status === "pending_approval" && !billingStatus && (
          <Layout.Section>
            <Banner title="Billing Approval Pending" tone="warning">
              You have a {PLANS[actualPlan]?.name} plan upgrade pending. Please complete billing to activate.
            </Banner>
          </Layout.Section>
        )}

        {error && (
          <Layout.Section>
            <Banner title="Something went wrong" tone="critical" onDismiss={() => navigate("/app/subscription")}>
              {error === "no-plan"             && "No plan was specified."}
              {error === "no-subscription"     && "No pending subscription found."}
              {error === "verification-failed" && "Could not verify your subscription with Shopify."}
              {error === "confirmation-failed" && "Failed to confirm your subscription."}
              {!["no-plan","no-subscription","verification-failed","confirmation-failed"].includes(error) && "An unexpected error occurred. Please try again."}
            </Banner>
          </Layout.Section>
        )}

        {/* ── Current Plan Status ── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">Current Plan: {currentPlanConfig.name}</Text>
                  <Text variant="bodyMd" tone="subdued">
                    {currentPlanConfig.price === 0 ? "Free forever" : `$${currentPlanConfig.price}/${currentPlanConfig.interval}`}
                  </Text>
                </BlockStack>
                {subscription.status === "trialing"         && <Badge tone="info">Trial Active</Badge>}
                {subscription.status === "active" && currentPlan !== "FREE" && <Badge tone="success">Active</Badge>}
                {subscription.status === "pending_approval" && <Badge tone="warning">{PLANS[actualPlan]?.name} Pending</Badge>}
              </InlineStack>

              <Divider />

              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">Usage</Text>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text>Chat Sessions</Text>
                    <Text>{chatCount} / {currentPlanConfig.limits.maxChats === -1 ? "Unlimited" : currentPlanConfig.limits.maxChats}</Text>
                  </InlineStack>
                  {currentPlanConfig.limits.maxChats > 0 && (
                    <div style={{ width:"100%", height:"8px", backgroundColor:"#e4e5e7", borderRadius:"4px", overflow:"hidden" }}>
                      <div style={{ width:`${Math.min(usagePercentage, 100)}%`, height:"100%", backgroundColor: usagePercentage > 90 ? "#d72c0d" : "#008060", transition:"width 0.3s ease" }} />
                    </div>
                  )}
                  {usagePercentage > 90 && currentPlan !== "PREMIUM" && (
                    <Banner tone="warning">You're approaching your plan limit. Consider upgrading.</Banner>
                  )}
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ── Pricing Cards ── */}
        <Layout.Section>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:"20px" }}>
            {Object.entries(plans).map(([planKey, plan]) => {
              const isCurrentPlan = currentPlan === planKey;
              const isPendingPlan = subscription.status === "pending_approval" && actualPlan === planKey;
              const isUpgrade     = (currentPlan === "FREE" && planKey !== "FREE") || (currentPlan === "STANDARD" && planKey === "PREMIUM");

              return (
                <Card key={planKey}>
                  <BlockStack gap="400">
                    {/* Header */}
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="start">
                        <Text variant="headingLg" as="h3">{plan.name}</Text>
                        {plan.badge && !isCurrentPlan && !isPendingPlan && <Badge tone="info">{plan.badge}</Badge>}
                        {isCurrentPlan && !isPendingPlan && <Badge tone="success">Current Plan</Badge>}
                        {isPendingPlan && <Badge tone="warning">Pending</Badge>}
                      </InlineStack>

                      <InlineStack gap="100" blockAlign="baseline">
                        <Text variant="heading2xl" as="p">${plan.price}</Text>
                        {plan.price > 0 && <Text variant="bodyLg" tone="subdued">/ {plan.interval}</Text>}
                      </InlineStack>

                      {plan.trialDays && !isCurrentPlan && !isPendingPlan && (
                        <Text variant="bodySm" tone="subdued">{plan.trialDays}-day free trial</Text>
                      )}
                    </BlockStack>

                    <Divider />

                    {/* Features */}
                    <BlockStack gap="300">
                      {plan.features.map((f, i) => (
                        <FeatureRow key={i} text={f.text} included={f.included} />
                      ))}
                    </BlockStack>

                    {/* Action Button */}
                    <Form method="post">
                      <input type="hidden" name="plan" value={planKey} />
                      <Button
                        submit
                        variant={isUpgrade ? "primary" : "secondary"}
                        disabled={isCurrentPlan || isPendingPlan}
                        fullWidth
                      >
                        {isCurrentPlan  ? "Current Plan"
                        : isPendingPlan ? "Pending Approval"
                        : isUpgrade     ? "Upgrade Now"
                        : planKey === "FREE" ? "Downgrade to Free"
                        : "Select Plan"}
                      </Button>
                    </Form>
                  </BlockStack>
                </Card>
              );
            })}
          </div>
        </Layout.Section>

        {/* ── FAQ ── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Frequently Asked Questions</Text>
              <BlockStack gap="300">
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">Can I change my plan anytime?</Text>
                  <Text variant="bodyMd" tone="subdued">Yes! Upgrades take effect immediately. Downgrades apply at the end of your billing cycle.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">Do I get push notifications on the Free plan?</Text>
                  <Text variant="bodyMd" tone="subdued">No — push notifications (browser alerts when you receive a new message) are available on Standard and Premium plans only. Free plan receives email alerts with a 30-minute delay.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">How do email alerts work?</Text>
                  <Text variant="bodyMd" tone="subdued">If a customer message goes unread, you'll receive an email alert. The delay depends on your plan — 30 minutes (Free), 5 minutes (Standard), or 1 minute (Premium). If you read the message before the delay expires, no email is sent.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">How do free trials work?</Text>
                  <Text variant="bodyMd" tone="subdued">Standard and Premium plans include a 14-day free trial. You won't be charged until the trial ends. Cancel anytime during the trial at no cost.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">What happens if I exceed my chat limit?</Text>
                  <Text variant="bodyMd" tone="subdued">Your widget continues working but new chats may be restricted. We recommend upgrading before reaching your limit.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">Can I hide the "Powered by Talksy" branding?</Text>
                  <Text variant="bodyMd" tone="subdued">Yes — removing the Talksy branding from your chat widget is available exclusively on the Premium plan. Upgrade to Premium and toggle the setting in your widget settings page.</Text>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

      </Layout>
    </Page>
  );
}