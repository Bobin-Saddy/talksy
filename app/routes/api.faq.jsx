// app/routes/api.faq.page.jsx - WITH PLAN SAVE LIMIT

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getShopLimits } from "../planLimits.server";

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const body = await request.json();
    const { handle, title, settings, categories } = body;

    console.log("Creating/updating FAQ page:", { shop, handle, title });

    // ✅ CHECK PLAN LIMITS FIRST
    const { limits, plan } = await getShopLimits(shop);

    // Get or check existing FAQ page record for save count
    let faqPage = await prisma.faqPage.findFirst({ where: { shop } });

    // ✅ FREE PLAN: Block if save count >= 2
    // canCreateCustomFAQPage=false for FREE and STANDARD, true only for PREMIUM
    // But FAQ page saving itself we gate at 2 saves for FREE plan
    if (!limits.canCustomizeWidget) {
      // FREE plan - check save count on faqPage or chatSettings
      const faqSaveCount = faqPage?.saveCount || 0;

      if (faqSaveCount >= 2) {
        return json({
          success: false,
          blocked: true,
          plan,
          error: "Save limit reached. You've used all 2 saves on the Free plan. Upgrade to Standard or Premium to continue.",
        });
      }
    }

    // ✅ STANDARD plan: canCreateCustomFAQPage = false (can save widget/FAQ but NOT create custom FAQ page)
    // PREMIUM: canCreateCustomFAQPage = true (full access)
    // For the purpose of this route (saving FAQ page to Shopify), we allow STANDARD+
    // Only PREMIUM can do custom FAQ page creation per plan definition
    // But saving the embedded FAQ is allowed for all paid plans

    // If handle has changed and there's an existing Shopify page, delete the old one
    if (faqPage && faqPage.handle !== handle && faqPage.shopifyPageId) {
      console.log("Handle changed — deleting old page");
      try {
        await admin.graphql(
          `#graphql
            mutation deletePage($id: ID!) {
              pageDelete(id: $id) { deletedPageId userErrors { field message } }
            }`,
          { variables: { id: faqPage.shopifyPageId } }
        );
        faqPage = await prisma.faqPage.update({
          where: { id: faqPage.id },
          data: { handle, title, shopifyPageId: null, pageUrl: null, isPublished: true, updatedAt: new Date() },
        });
      } catch (e) { console.error("Error deleting old page:", e); }
    } else if (faqPage) {
      const newSaveCount = (faqPage.saveCount || 0) + 1;
      faqPage = await prisma.faqPage.update({
        where: { id: faqPage.id },
        data: { handle, title, isPublished: true, updatedAt: new Date(), saveCount: newSaveCount },
      });
    } else {
      faqPage = await prisma.faqPage.create({
        data: { shop, handle, title, isPublished: true, saveCount: 1 },
      });
    }

    // Generate HTML
    const pageContent = generateFaqPageHtml(settings, categories, shop);
    const contentSize = Buffer.byteLength(pageContent, "utf8");
    console.log(`HTML size: ${(contentSize / 1024).toFixed(2)} KB`);

    if (contentSize > 256000) {
      return json({ success: false, error: "FAQ content is too large. Please reduce FAQs or shorten content." });
    }

    let shopifyPage;

    try {
      if (faqPage.shopifyPageId) {
        const updateResponse = await admin.graphql(
          `#graphql
            mutation updatePage($id: ID!, $page: PageUpdateInput!) {
              pageUpdate(id: $id, page: $page) {
                page { id handle title }
                userErrors { field message }
              }
            }`,
          { variables: { id: faqPage.shopifyPageId, page: { title, body: pageContent, isPublished: true } } }
        );
        const updateData = await updateResponse.json();
        if (updateData.data?.pageUpdate?.userErrors?.length > 0) {
          return json({ success: false, error: updateData.data.pageUpdate.userErrors[0].message });
        }
        shopifyPage = updateData.data?.pageUpdate?.page;
      } else {
        const createResponse = await admin.graphql(
          `#graphql
            mutation createPage($page: PageCreateInput!) {
              pageCreate(page: $page) {
                page { id handle title }
                userErrors { field message }
              }
            }`,
          { variables: { page: { title, handle, body: pageContent, isPublished: true } } }
        );
        const createData = await createResponse.json();
        if (createData.data?.pageCreate?.userErrors?.length > 0) {
          return json({ success: false, error: createData.data.pageCreate.userErrors[0].message });
        }
        shopifyPage = createData.data?.pageCreate?.page;
        if (shopifyPage) {
          const shopDomain = shop.replace(".myshopify.com", "");
          const pageUrl = `https://${shopDomain}.myshopify.com/pages/${shopifyPage.handle}`;
          await prisma.faqPage.update({
            where: { id: faqPage.id },
            data: { shopifyPageId: shopifyPage.id, pageUrl },
          });
        }
      }
    } catch (graphqlError) {
      console.error("GraphQL API error:", graphqlError);
      return json({ success: false, error: "Failed to communicate with Shopify API: " + (graphqlError.message || "Unknown error") }, { status: 500 });
    }

    const shopDomain = shop.replace(".myshopify.com", "");
    const finalPageUrl = `https://${shopDomain}.myshopify.com/pages/${handle}`;

    return json({
      success: true,
      plan,
      page: { ...faqPage, shopifyPageId: shopifyPage?.id || faqPage.shopifyPageId, pageUrl: finalPageUrl },
    });

  } catch (error) {
    console.error("Error creating/updating FAQ page:", error);
    return json({ success: false, error: error.message || "Failed to create/update page" }, { status: 500 });
  }
}

function generateFaqPageHtml(settings, categories, shop) {
  const activeCategories = categories.filter(cat => cat.isActive);

  let themeColors = {
    backgroundColor: settings.customBackgroundColor || "#FFFFFF",
    textColor: settings.customTextColor || "#000000",
    accentColor: settings.customAccentColor || "#5C6AC4",
  };

  if (settings.appearanceTheme === "light") {
    themeColors = { backgroundColor: "#FFFFFF", textColor: "#000000", accentColor: "#5C6AC4" };
  } else if (settings.appearanceTheme === "dark") {
    themeColors = { backgroundColor: "#1a1a1a", textColor: "#FFFFFF", accentColor: "#7B61FF" };
  } else if (settings.appearanceTheme === "preset") {
    themeColors = { backgroundColor: "#F5F5F5", textColor: "#333333", accentColor: "#00A896" };
  }

  const finalColors = settings.appearanceTheme === "custom"
    ? { backgroundColor: settings.customBackgroundColor || "#FFFFFF", textColor: settings.customTextColor || "#000000", accentColor: settings.customAccentColor || "#5C6AC4" }
    : themeColors;

  const backgroundStyle = settings.customBackgroundImage
    ? `background-image: url('${settings.customBackgroundImage}'); background-size: cover; background-position: center; background-attachment: fixed;`
    : `background-color: ${finalColors.backgroundColor};`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${settings.headerTitle || "Frequently Asked Questions"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: ${settings.customLineHeight || 1.6}; color: ${finalColors.textColor}; ${backgroundStyle} font-size: ${settings.customFontSize || 16}px; min-height: 100vh; }
    .faq-container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; ${settings.customBackgroundImage ? "background-color: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border-radius: " + (settings.customBorderRadius || 8) + "px;" : ""} }
    ${settings.headerEnabled ? `.faq-header { text-align: ${settings.headerAlignment || "center"}; margin-bottom: 40px; } .faq-header h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 12px; color: ${finalColors.textColor}; } .faq-header p { font-size: 1.125rem; color: ${finalColors.accentColor}; }` : ""}
    ${settings.searchEnabled ? `.faq-search { max-width: 600px; margin: 0 auto 40px; } .faq-search input { width: 100%; padding: 14px 20px; font-size: 1rem; border: 2px solid ${settings.appearanceTheme === "dark" ? "#333" : "#E1E3E5"}; border-radius: ${settings.customBorderRadius || 8}px; outline: none; transition: border-color 0.2s; background-color: ${settings.appearanceTheme === "dark" ? "#2a2a2a" : "#fff"}; color: ${finalColors.textColor}; } .faq-search input:focus { border-color: ${finalColors.accentColor}; }` : ""}
    .faq-categories { display: ${settings.layout === "grid" ? "grid" : "flex"}; ${settings.layout === "grid" ? "grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));" : "flex-direction: column;"} gap: 30px; }
    .faq-category { background: ${settings.appearanceTheme === "dark" ? "#2a2a2a" : "#fff"}; border-radius: ${settings.customBorderRadius || 8}px; padding: 24px; ${settings.layout === "grid" ? "border: 1px solid " + (settings.appearanceTheme === "dark" ? "#333" : "#E1E3E5") + ";" : ""} }
    ${settings.showCategories ? `.faq-category h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 20px; color: ${finalColors.textColor}; }` : ""}
    .faq-items { display: flex; flex-direction: column; gap: ${settings.faqSpacing === "compact" ? "8px" : settings.faqSpacing === "spacious" ? "20px" : "12px"}; }
    .faq-item { border: 1px solid ${settings.appearanceTheme === "dark" ? "#333" : "#E1E3E5"}; border-radius: ${settings.customBorderRadius || 8}px; overflow: hidden; background: ${settings.appearanceTheme === "dark" ? "#1f1f1f" : "#fff"}; }
    .faq-question { width: 100%; padding: 16px 20px; background: transparent; border: none; text-align: left; font-size: 1rem; font-weight: 500; color: ${finalColors.textColor}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background-color 0.2s; }
    .faq-question:hover { background-color: ${settings.appearanceTheme === "dark" ? "#333" : "#F9FAFB"}; }
    .faq-question::after { content: "+"; font-size: 1.5rem; font-weight: 300; transition: transform 0.2s; color: ${finalColors.accentColor}; }
    .faq-item.active .faq-question::after { content: "−"; }
    .faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; }
    .faq-answer-content { padding: 0 20px 16px; color: ${finalColors.accentColor}; line-height: ${settings.customLineHeight || 1.6}; }
    .faq-item.active .faq-answer { max-height: 1000px; }
    ${settings.contactFormEnabled ? `.faq-contact { max-width: 600px; margin: 50px auto 0; padding: 30px; background: ${settings.appearanceTheme === "dark" ? "#2a2a2a" : "#F9FAFB"}; border: 1px solid ${settings.appearanceTheme === "dark" ? "#333" : "#E1E3E5"}; border-radius: ${settings.customBorderRadius || 8}px; } .faq-contact h3 { font-size: 1.25rem; font-weight: 600; margin-bottom: 8px; color: ${finalColors.textColor}; } .faq-contact p { color: ${finalColors.accentColor}; margin-bottom: 20px; } .faq-contact input, .faq-contact textarea { width: 100%; padding: 12px 16px; margin-bottom: 12px; border: 1px solid ${settings.appearanceTheme === "dark" ? "#333" : "#E1E3E5"}; border-radius: 4px; font-size: 1rem; font-family: inherit; background-color: ${settings.appearanceTheme === "dark" ? "#1f1f1f" : "#fff"}; color: ${finalColors.textColor}; } .faq-contact textarea { min-height: 120px; resize: vertical; } .faq-contact button { width: 100%; padding: 12px 24px; background-color: ${finalColors.accentColor}; color: #fff; border: none; border-radius: 4px; font-size: 1rem; font-weight: 500; cursor: pointer; transition: opacity 0.2s; } .faq-contact button:hover { opacity: 0.9; }` : ""}
    ${settings.customCSS || ""}
    @media (max-width: 768px) { body { font-size: ${Math.max(14, (settings.customFontSize || 16) - 2)}px; } .faq-header h1 { font-size: 2rem; } .faq-category { padding: 20px; } .faq-categories { grid-template-columns: 1fr; } .faq-container { padding: 20px 16px; } }
  </style>
</head>
<body>
  <div class="faq-container">
    ${settings.headerEnabled ? `<div class="faq-header"><h1>${settings.headerTitle || "Frequently Asked Questions"}</h1><p>${settings.headerDescription || "Got a question? We are here to answer!"}</p></div>` : ""}
    ${settings.searchEnabled ? `<div class="faq-search"><input type="text" id="faq-search-input" placeholder="${settings.searchPlaceholder || "Search FAQs..."}"/></div>` : ""}
    <div class="faq-categories">
      ${activeCategories.map(category => `
        <div class="faq-category" data-category="${category.id}">
          ${settings.showCategories ? `<h2>${category.title}</h2>` : ""}
          <div class="faq-items">
            ${category.faqs.filter(f => f.isActive).map(faq => `
              <div class="faq-item">
                <button class="faq-question" type="button"><span>${faq.question}</span></button>
                <div class="faq-answer"><div class="faq-answer-content">${faq.answer}</div></div>
              </div>`).join("")}
          </div>
        </div>`).join("")}
    </div>
    ${settings.contactFormEnabled ? `
    <div class="faq-contact">
      <h3>${settings.contactFormTitle}</h3>
      <p>${settings.contactFormDescription}</p>
      <form id="faq-contact-form">
        <input type="email" name="email" placeholder="${settings.contactFormEmailPlaceholder}" required/>
        <textarea name="message" placeholder="${settings.contactFormMessagePlaceholder}" required></textarea>
        <button type="submit">${settings.contactFormButtonText}</button>
      </form>
    </div>` : ""}
  </div>
  <script>
    document.querySelectorAll(".faq-question").forEach(button => {
      button.addEventListener("click", () => {
        const item = button.closest(".faq-item");
        const wasActive = item.classList.contains("active");
        ${settings.enableAccordion ? `const category = item.closest(".faq-category"); category.querySelectorAll(".faq-item").forEach(i => i.classList.remove("active"));` : ""}
        if (!wasActive) item.classList.add("active");
      });
    });
    ${settings.searchEnabled ? `
    const searchInput = document.getElementById("faq-search-input");
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      document.querySelectorAll(".faq-item").forEach(item => {
        const q = item.querySelector(".faq-question span").textContent.toLowerCase();
        const a = item.querySelector(".faq-answer-content").textContent.toLowerCase();
        item.style.display = (q.includes(term) || a.includes(term)) ? "" : "none";
      });
      document.querySelectorAll(".faq-category").forEach(cat => {
        const visible = cat.querySelectorAll(".faq-item:not([style*='display: none'])");
        cat.style.display = visible.length > 0 ? "" : "none";
      });
    });` : ""}
    ${settings.contactFormEnabled ? `
    document.getElementById("faq-contact-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      alert("Thank you for your message! We will get back to you soon.");
      e.target.reset();
    });` : ""}
  </script>
</body>
</html>`.trim();
}