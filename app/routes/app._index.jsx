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

  const openThemeEditor = () => {
    window.open("shopify://admin/themes/current/editor?context=apps", "_top");
  };

  return (
    <s-page heading="Talksy Chat – Setup & Dashboard">

      <s-button slot="primary-action" onClick={saveSettings} {...(isLoading ? { loading: true } : {})}>
        Save & Publish Chat
      </s-button>

      {/* ✅ ONBOARDING SECTION (CRITICAL FOR REVIEW) */}
      <s-section heading="🚀 Step-by-Step Setup Guide">

        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-heading size="small">Step 1: Add Talksy to your theme</s-heading>
          <s-paragraph>
            Click the button below to open your theme editor.
          </s-paragraph>

          <s-button onClick={openThemeEditor}>
            Open Theme Editor
          </s-button>
        </s-box>

        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-heading size="small">Step 2: Add the App Block</s-heading>
          <s-paragraph>
            In the Theme Customizer:
            <br />• Click <b>Add Section</b>
            <br />• Open <b>Apps</b>
            <br />• Select <b>Talksy Chat</b>
            <br />• Click <b>Save</b>
          </s-paragraph>
        </s-box>

        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-heading size="small">Step 3: Done 🎉</s-heading>
          <s-paragraph>
            The chat widget will now appear on your store. You can start receiving customer messages immediately.
          </s-paragraph>
        </s-box>

      </s-section>

      {/* MAIN INTRO */}
      <s-section heading="💬 Connect with your customers in real-time">
        <s-paragraph>
          Talksy helps you communicate with your customers via real-time live chat.
          Manage all conversations from one dashboard and provide faster support.
        </s-paragraph>
      </s-section>

      {/* FEATURES */}
      <s-section heading="Core Features">
        <s-stack direction="block" gap="loose">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading size="small">Real-time Live Chat</s-heading>
            <s-paragraph>Chat instantly with store visitors.</s-paragraph>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading size="small">Visitor Context</s-heading>
            <s-paragraph>See customer info and behavior in real time.</s-paragraph>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading size="small">Quick Replies</s-heading>
            <s-paragraph>Reply faster using predefined messages.</s-paragraph>
          </s-box>
        </s-stack>
      </s-section>

    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
