// app/routes/app.subscription.jsx - UPDATED WITH ALL MODULES
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

const TEST_MODE = false; // ⚠️ CHANGE TO false FOR PRODUCTION

// ── Plan definitions ──────────────────────────────────────
const PLANS = {
  FREE: {
    name    : "Free",
    price   : 0,
    interval: "forever",
    features: [
      // ── Chat ──
      { group: "Chat",              text: "100 chat sessions included",                  included: true  },
      { group: "Chat",              text: "30-day chat history",                         included: true  },
      { group: "Chat",              text: "Email alerts (30 min delay)",                 included: true  },
      { group: "Chat",              text: "Push notifications",                          included: false },
      // ── Search ──
      { group: "Search",            text: "Product & order search in widget",            included: false },
      // ── FAQ ──
      { group: "FAQ",               text: "FAQ management",                              included: false },
      { group: "FAQ",               text: "Custom FAQ page",                             included: false },
      // ── Widget ──
      { group: "Widget",            text: "Widget customization",                        included: false },
      { group: "Widget",            text: "Hide \"Powered by Talksy\" branding",        included: false },
      // ── Animated Questions ──
      { group: "Animated Questions",text: "Animated questions (max 3 parent)",           included: true  },
      { group: "Animated Questions",text: "Child follow-up questions",                   included: false },
      { group: "Animated Questions",text: "Auto-reply for questions",                    included: false },
    ],
    limits: {
      maxChats             : 100,
      maxSearchUsers       : 0,
      chatHistoryDays      : 30,
      canManageFAQs        : false,
      canCustomizeWidget   : false,
      maxParentQuestions   : 3,
      canAddChildQuestions : false,
      canAutoReply         : false,
    },
  },

  STANDARD: {
    name     : "Standard",
    price    : 9.49,
    interval : "month",
    trialDays: 7,
    badge    : "Popular",
    features : [
      // ── Chat ──
      { group: "Chat",              text: "500 chat sessions included",                  included: true  },
      { group: "Chat",              text: "6-month chat history",                        included: true  },
      { group: "Chat",              text: "Push notifications (instant)",                included: true  },
      { group: "Chat",              text: "Email alerts (5 min delay)",                  included: true  },
      // ── Search ──
      { group: "Search",            text: "Search up to 500 users",                     included: true  },
      // ── FAQ ──
      { group: "FAQ",               text: "FAQ management",                              included: true  },
      { group: "FAQ",               text: "Custom FAQ page",                             included: true  },
      // ── Widget ──
      { group: "Widget",            text: "Widget customization",                        included: true  },
      { group: "Widget",            text: "Hide \"Powered by Talksy\" branding",        included: false },
      // ── Animated Questions ──
      { group: "Animated Questions",text: "Unlimited animated questions",                included: true  },
      { group: "Animated Questions",text: "Child follow-up questions",                   included: true  },
      { group: "Animated Questions",text: "Auto-reply for questions",                    included: true  },
      // ── Trial ──
      { group: "Trial",             text: "7-day free trial",                            included: true  },
    ],
    limits: {
      maxChats             : 500,
      maxSearchUsers       : 500,
      chatHistoryDays      : 180,
      canManageFAQs        : true,
      canCustomizeWidget   : true,
      maxParentQuestions   : -1,
      canAddChildQuestions : true,
      canAutoReply         : true,
    },
  },

  PREMIUM: {
    name     : "Premium",
    price    : 24.99,
    interval : "month",
    trialDays: 7,
    badge    : "Best Value",
    features : [
      // ── Chat ──
      { group: "Chat",              text: "Unlimited chat sessions",                     included: true  },
      { group: "Chat",              text: "Unlimited chat history",                      included: true  },
      { group: "Chat",              text: "Push notifications (instant)",                included: true  },
      { group: "Chat",              text: "Email alerts (1 min delay)",                  included: true  },
      // ── Search ──
      { group: "Search",            text: "Unlimited user search",                       included: true  },
      // ── FAQ ──
      { group: "FAQ",               text: "FAQ management",                              included: true  },
      { group: "FAQ",               text: "Custom FAQ page",                             included: true  },
      // ── Widget ──
      { group: "Widget",            text: "Widget customization",                        included: true  },
      { group: "Widget",            text: "Hide \"Powered by Talksy\" branding",        included: true  },
      // ── Animated Questions ──
      { group: "Animated Questions",text: "Unlimited animated questions",                included: true  },
      { group: "Animated Questions",text: "Child follow-up questions",                   included: true  },
      { group: "Animated Questions",text: "Auto-reply for questions",                    included: true  },
      // ── Trial ──
      { group: "Trial",             text: "7-day free trial",                            included: true  },
    ],
    limits: {
      maxChats              : -1,
      maxSearchUsers        : -1,
      chatHistoryDays       : -1,
      canManageFAQs         : true,
      canCustomizeWidget    : true,
      canCreateCustomFAQPage: true,
      maxParentQuestions    : -1,
      canAddChildQuestions  : true,
      canAutoReply          : true,
    },
  },
};

// ── Loader ────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // server-only imports inside loader (build-safe)
  const { default: prisma } = await import("../db.server.js");

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
    return json({
      shop, currentPlan: "FREE", actualPlan: "FREE",
      subscription: updatedSubscription, chatCount, plans: PLANS, testMode: TEST_MODE,
    });
  }

  const chatCount = await prisma.chatSession.count({ where: { shop } }).catch(() => 0);
  let displayPlan = subscription.plan;
  if (subscription.status === "pending_approval") displayPlan = "FREE";

  return json({
    shop, currentPlan: displayPlan, actualPlan: subscription.plan,
    subscription, chatCount, plans: PLANS, testMode: TEST_MODE,
  });
};

// ── Action ────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop         = session.shop;
  const formData     = await request.formData();
  const selectedPlan = formData.get("plan");

  const { default: prisma } = await import("../db.server.js");

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
          lineItems : [{
            plan: {
              appRecurringPricingDetails: {
                price   : { amount: planConfig.price, currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          }],
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

// ── Group label styles ─────────────────────────────────────
const GROUP_COLORS = {
  "Chat"               : { bg:"#eff6ff", border:"#bfdbfe", color:"#1d4ed8", icon:"💬" },
  "Search"             : { bg:"#f0fdf4", border:"#bbf7d0", color:"#15803d", icon:"🔍" },
  "FAQ"                : { bg:"#fdf4ff", border:"#e9d5ff", color:"#7e22ce", icon:"📋" },
  "Widget"             : { bg:"#fff7ed", border:"#fed7aa", color:"#c2410c", icon:"🎨" },
  "Animated Questions" : { bg:"#fffbeb", border:"#fde68a", color:"#b45309", icon:"✨" },
  "Trial"              : { bg:"#f0fdf4", border:"#bbf7d0", color:"#15803d", icon:"🎁" },
};

function FeatureRow({ text, included }) {
  return (
    <InlineStack gap="200" blockAlign="start">
      <div style={{ marginTop:"2px", flexShrink:0 }}>
        {included
          ? <Icon source={CheckIcon} tone="success" />
          : <Icon source={XIcon}     tone="subdued" />}
      </div>
      <Text variant="bodyMd" tone={included ? undefined : "subdued"}>{text}</Text>
    </InlineStack>
  );
}

function GroupedFeatures({ features }) {
  // Group by category
  const groups = {};
  for (const f of features) {
    const g = f.group || "General";
    if (!groups[g]) groups[g] = [];
    groups[g].push(f);
  }

  return (
    <BlockStack gap="300">
      {Object.entries(groups).map(([groupName, items]) => {
        const style = GROUP_COLORS[groupName] || { bg:"#f9fafb", border:"#e5e7eb", color:"#374151", icon:"•" };
        return (
          <div key={groupName}>
            {/* Group label */}
            <div style={{
              display    : "inline-flex",
              alignItems : "center",
              gap        : "5px",
              background : style.bg,
              border     : `1px solid ${style.border}`,
              borderRadius: "20px",
              padding    : "2px 10px",
              marginBottom: "8px",
            }}>
              <span style={{ fontSize:"11px" }}>{style.icon}</span>
              <span style={{ fontSize:"11px", fontWeight:700, color:style.color, letterSpacing:"0.02em" }}>
                {groupName}
              </span>
            </div>
            {/* Feature rows */}
            <BlockStack gap="200">
              {items.map((f, i) => (
                <div key={i} style={{ paddingLeft:"4px" }}>
                  <FeatureRow text={f.text} included={f.included} />
                </div>
              ))}
            </BlockStack>
          </div>
        );
      })}
    </BlockStack>
  );
}

// ── Main Component ─────────────────────────────────────────
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

        {/* ── Test mode warning ── */}
        {testMode && (
          <Layout.Section>
            <Banner tone="warning">
              <strong>⚠️ TEST MODE ENABLED</strong> — You won't be charged. Set TEST_MODE = false for production.
            </Banner>
          </Layout.Section>
        )}

        {/* ── Success banners ── */}
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
                    {currentPlanConfig.price === 0
                      ? "Free forever"
                      : `$${currentPlanConfig.price}/${currentPlanConfig.interval}`}
                  </Text>
                </BlockStack>
                {subscription.status === "trialing"                        && <Badge tone="info">Trial Active</Badge>}
                {subscription.status === "active" && currentPlan !== "FREE" && <Badge tone="success">Active</Badge>}
                {subscription.status === "pending_approval"                && <Badge tone="warning">{PLANS[actualPlan]?.name} Pending</Badge>}
              </InlineStack>

              <Divider />

              {/* Usage */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">Usage</Text>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text>Chat Sessions</Text>
                    <Text>
                      {chatCount} / {currentPlanConfig.limits.maxChats === -1 ? "Unlimited" : currentPlanConfig.limits.maxChats}
                    </Text>
                  </InlineStack>
                  {currentPlanConfig.limits.maxChats > 0 && (
                    <div style={{ width:"100%", height:"8px", backgroundColor:"#e4e5e7", borderRadius:"4px", overflow:"hidden" }}>
                      <div style={{
                        width          : `${Math.min(usagePercentage, 100)}%`,
                        height         : "100%",
                        backgroundColor: usagePercentage > 90 ? "#d72c0d" : "#008060",
                        transition     : "width 0.3s ease",
                      }} />
                    </div>
                  )}
                  {usagePercentage > 90 && currentPlan !== "PREMIUM" && (
                    <Banner tone="warning">You're approaching your plan limit. Consider upgrading.</Banner>
                  )}
                </BlockStack>
              </BlockStack>

              {/* Current plan feature highlights */}
              <Divider />
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Your Plan Includes</Text>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px,1fr))", gap:"10px", marginTop:"4px" }}>
                  {[
                    {
                      icon : "💬",
                      label: "Chat Sessions",
                      value: currentPlanConfig.limits.maxChats === -1 ? "Unlimited" : `${currentPlanConfig.limits.maxChats}`,
                    },
                    {
                      icon : "📅",
                      label: "Chat History",
                      value: currentPlanConfig.limits.chatHistoryDays === -1 ? "Unlimited" : `${currentPlanConfig.limits.chatHistoryDays} days`,
                    },
                    {
                      icon : "✨",
                      label: "Animated Questions",
                      value: currentPlanConfig.limits.maxParentQuestions === -1 ? "Unlimited" : `${currentPlanConfig.limits.maxParentQuestions} parents`,
                    },
                    {
                      icon : "🔗",
                      label: "Child Questions",
                      value: currentPlanConfig.limits.canAddChildQuestions ? "✅ Enabled" : "🔒 Locked",
                    },
                    {
                      icon : "🤖",
                      label: "Auto-Reply",
                      value: currentPlanConfig.limits.canAutoReply ? "✅ Enabled" : "🔒 Locked",
                    },
                    {
                      icon : "🔔",
                      label: "Push Notifications",
                      value: currentPlan !== "FREE" ? "✅ Instant" : "🔒 Locked",
                    },
                  ].map(item => (
                    <div key={item.label} style={{
                      background  : "#f9fafb",
                      border      : "1px solid #e5e7eb",
                      borderRadius: "10px",
                      padding     : "12px 14px",
                      display     : "flex",
                      alignItems  : "center",
                      gap         : "10px",
                    }}>
                      <span style={{ fontSize:"20px" }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize:"11px", color:"#6b7280", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em" }}>{item.label}</div>
                        <div style={{ fontSize:"13px", fontWeight:700, color:"#111827", marginTop:"2px" }}>{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
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
                        {plan.price > 0 && (
                          <Text variant="bodyLg" tone="subdued">/ {plan.interval}</Text>
                        )}
                      </InlineStack>

                      {plan.trialDays && !isCurrentPlan && !isPendingPlan && (
                        <Text variant="bodySm" tone="subdued">{plan.trialDays}-day free trial included</Text>
                      )}
                    </BlockStack>

                    <Divider />

                    {/* Grouped Features */}
                    <GroupedFeatures features={plan.features} />

                    {/* Action Button */}
                    <Form method="post">
                      <input type="hidden" name="plan" value={planKey} />
                      <Button
                        submit
                        variant={isUpgrade ? "primary" : "secondary"}
                        disabled={isCurrentPlan || isPendingPlan}
                        fullWidth
                      >
                        {isCurrentPlan   ? "Current Plan"
                        : isPendingPlan  ? "Pending Approval"
                        : isUpgrade      ? "Upgrade Now"
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

        {/* ── Feature Comparison Table ── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Feature Comparison</Text>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
                  <thead>
                    <tr style={{ borderBottom:"2px solid #e5e7eb" }}>
                      <th style={{ textAlign:"left", padding:"10px 12px", color:"#374151", fontWeight:700, width:"40%" }}>Feature</th>
                      <th style={{ textAlign:"center", padding:"10px 12px", color:"#374151", fontWeight:700 }}>Free</th>
                      <th style={{ textAlign:"center", padding:"10px 12px", color:"#4f46e5", fontWeight:700, background:"#f5f3ff", borderRadius:"8px" }}>Standard</th>
                      <th style={{ textAlign:"center", padding:"10px 12px", color:"#047857", fontWeight:700 }}>Premium</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature:"Chat Sessions",          free:"100",        standard:"500",       premium:"Unlimited" },
                      { feature:"Chat History",           free:"30 days",    standard:"6 months",  premium:"Unlimited" },
                      { feature:"Push Notifications",     free:"❌",         standard:"✅ Instant", premium:"✅ Instant" },
                      { feature:"Email Alerts",           free:"30 min",     standard:"5 min",     premium:"1 min"     },
                      { feature:"Search Users",           free:"❌",         standard:"500",       premium:"Unlimited" },
                      { feature:"FAQ Management",         free:"❌",         standard:"✅",        premium:"✅"        },
                      { feature:"Widget Customization",   free:"❌",         standard:"✅",        premium:"✅"        },
                      { feature:"Remove Branding",        free:"❌",         standard:"❌",        premium:"✅"        },
                      { feature:"Animated Questions",     free:"3 parents",  standard:"Unlimited", premium:"Unlimited" },
                      { feature:"Child Questions",        free:"❌",         standard:"✅",        premium:"✅"        },
                      { feature:"Auto-Reply",             free:"❌",         standard:"✅",        premium:"✅"        },
                      { feature:"Free Trial",             free:"—",          standard:"7 days",    premium:"7 days"    },
                      { feature:"Price",                  free:"$0",         standard:"$9.49/mo",  premium:"$24.99/mo" },
                    ].map((row, i) => (
                      <tr key={row.feature} style={{ borderBottom:"1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding:"10px 12px", fontWeight:600, color:"#374151" }}>{row.feature}</td>
                        <td style={{ padding:"10px 12px", textAlign:"center", color:"#6b7280" }}>{row.free}</td>
                        <td style={{ padding:"10px 12px", textAlign:"center", color:"#4f46e5", background:"rgba(99,102,241,0.04)", fontWeight: row.standard.startsWith("✅") ? 600 : 400 }}>{row.standard}</td>
                        <td style={{ padding:"10px 12px", textAlign:"center", color:"#047857", fontWeight: row.premium.startsWith("✅") || row.premium === "Unlimited" ? 600 : 400 }}>{row.premium}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </BlockStack>
          </Card>
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
                  <Text variant="headingSm" as="h3">What are Animated Questions?</Text>
                  <Text variant="bodyMd" tone="subdued">Animated Questions are floating bubbles that appear above your chat launcher. FREE plan supports up to 3 parent questions. Standard and Premium unlock unlimited questions, child follow-up chips inside the chat, and auto-reply responses.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">What are Child Questions?</Text>
                  <Text variant="bodyMd" tone="subdued">When a customer clicks an animated question bubble, child questions appear as clickable chips inside the chat for follow-up. This feature requires Standard or Premium plan.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">Do I get push notifications on the Free plan?</Text>
                  <Text variant="bodyMd" tone="subdued">No — push notifications are available on Standard and Premium plans only. Free plan receives email alerts with a 30-minute delay.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">How do email alerts work?</Text>
                  <Text variant="bodyMd" tone="subdued">If a customer message goes unread, you'll receive an email alert. Delay depends on your plan — 30 min (Free), 5 min (Standard), or 1 min (Premium).</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">How do free trials work?</Text>
                  <Text variant="bodyMd" tone="subdued">Standard and Premium plans include a 7-day free trial. You won't be charged until the trial ends. Cancel anytime during the trial at no cost.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">What happens if I exceed my chat limit?</Text>
                  <Text variant="bodyMd" tone="subdued">Your widget continues working but new chats may be restricted. We recommend upgrading before reaching your limit.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">Can I hide the "Powered by Talksy" branding?</Text>
                  <Text variant="bodyMd" tone="subdued">Yes — removing Talksy branding is available exclusively on the Premium plan. Toggle the setting in your widget settings page after upgrading.</Text>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

      </Layout>
    </Page>
  );
}