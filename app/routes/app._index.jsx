import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  // Example: Saving chat widget settings to Metafields (instead of creating products)
  // This is where you would handle the "Save Changes" or "Publish" logic
  return { success: true, timestamp: new Date().toISOString() };
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Chat widget settings saved!");
    }
  }, [fetcher.data?.success, shopify]);

  const saveSettings = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="ChatWidget Admin Dashboard">
      {/* Primary Action Button */}
      <s-button slot="primary-action" onClick={saveSettings} {...(isLoading ? { loading: true } : {})}>
        Save & Publish Chat
      </s-button>

      {/* Main Introduction Section */}
      <s-section heading="Connect with your customers in real-time 🎉">
        <s-paragraph>
          Welcome to **ChatWidget**. This app helps you communicate with your customers via real-time live chat. 
          Manage all conversations from a single inbox and provide faster support with visitor context and quick replies.
        </s-paragraph>
      </s-section>

      {/* Features Grid */}
      <s-section heading="Core Features">
        <s-stack direction="block" gap="loose">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading size="small">Real-time Live Chat</s-heading>
            <s-paragraph>Connect with store visitors instantly to drive sales and trust.</s-paragraph>
          </s-box>
          
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading size="small">Visitor Context</s-heading>
            <s-paragraph>View location, local time, and store source for every customer conversation.</s-paragraph>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading size="small">Quick Replies</s-heading>
            <s-paragraph>Respond faster to common queries using pre-set reply buttons.</s-paragraph>
          </s-box>
        </s-stack>
      </s-section>

      {/* Customization Section */}
      <s-section heading="Widget Customization">
        <s-paragraph>
          Tailor the widget to match your brand identity. You can customize colors, welcome messages, and your support avatar.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button onClick={() => shopify.toast.show("Customizer opening...")}>
            Launch Live Preview
          </s-button>
          <s-button variant="tertiary" href="/app/additional">
            Configure Quick Replies
          </s-button>
        </s-stack>
      </s-section>

      {/* Sidebar Info */}
      <s-section slot="aside" heading="App Status">
        <s-paragraph>
          <s-text>Widget Status: </s-text>
          <s-text fontWeight="bold" tone="success">Active</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Mobile Ready: </s-text>
          <s-text>Yes ✅</s-text>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Next steps">
        <s-unordered-list>
          <s-list-item>
            <s-link href="#">Setup Welcome Message</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="#">View Chat Analytics</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="https://shopify.dev" target="_blank">Help Center</s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};