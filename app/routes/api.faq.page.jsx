// app/routes/api.faq.page.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const body = await request.json();
    const { handle, title, settings, categories } = body;
    
    console.log("Creating/updating FAQ page:", { shop, handle, title });

    // First, find or create the page record in the database
    let faqPage = await prisma.faqPage.findFirst({
      where: { shop }
    });

    // If handle has changed and there's an existing Shopify page, delete the old one
    if (faqPage && faqPage.handle !== handle && faqPage.shopifyPageId) {
      console.log("Handle changed from", faqPage.handle, "to", handle, "- deleting old page");
      
      try {
        await admin.graphql(
          `#graphql
            mutation deletePage($id: ID!) {
              pageDelete(id: $id) {
                deletedPageId
                userErrors {
                  field
                  message
                }
              }
            }`,
          {
            variables: {
              id: faqPage.shopifyPageId
            }
          }
        );
        
        console.log("Old page deleted successfully");
        
        // Update the database record to clear the old Shopify page ID
        faqPage = await prisma.faqPage.update({
          where: { id: faqPage.id },
          data: {
            handle,
            title,
            shopifyPageId: null,
            pageUrl: null,
            isPublished: true,
            updatedAt: new Date()
          }
        });
      } catch (deleteError) {
        console.error("Error deleting old page:", deleteError);
        // Continue anyway - we'll create a new page
      }
    } else if (faqPage) {
      // Update existing page record
      faqPage = await prisma.faqPage.update({
        where: { id: faqPage.id },
        data: {
          handle,
          title,
          isPublished: true,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new page record
      faqPage = await prisma.faqPage.create({
        data: {
          shop,
          handle,
          title,
          isPublished: true
        }
      });
    }

    // Generate the FAQ page HTML content
    const pageContent = generateFaqPageHtml(settings, categories, shop);
    
    // Check HTML size (Shopify has a 256KB limit for page body)
    const contentSize = Buffer.byteLength(pageContent, 'utf8');
    console.log(`Generated HTML size: ${contentSize} bytes (${(contentSize / 1024).toFixed(2)} KB)`);
    
    if (contentSize > 256000) {
      console.error("HTML content too large:", contentSize);
      return json({
        success: false,
        error: "FAQ content is too large. Please reduce the number of FAQs or shorten the content."
      });
    }

    // Create or update the Shopify page via Admin API
    let shopifyPage;
    
    try {
      if (faqPage.shopifyPageId) {
        // Update existing page
        console.log("Updating existing page with ID:", faqPage.shopifyPageId);
        
        const updateResponse = await admin.graphql(
          `#graphql
            mutation updatePage($id: ID!, $page: PageUpdateInput!) {
              pageUpdate(id: $id, page: $page) {
                page {
                  id
                  handle
                  title
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
          {
            variables: {
              id: faqPage.shopifyPageId,
              page: {
                title,
                body: pageContent,
                isPublished: true
              }
            }
          }
        );

        const updateData = await updateResponse.json();
        console.log("Update response:", JSON.stringify(updateData, null, 2));
        
        if (updateData.data?.pageUpdate?.userErrors?.length > 0) {
          console.error("GraphQL update errors:", updateData.data.pageUpdate.userErrors);
          return json({
            success: false,
            error: updateData.data.pageUpdate.userErrors[0].message
          });
        }

        shopifyPage = updateData.data?.pageUpdate?.page;
      } else {
        // Create new page
        console.log("Creating new page with handle:", handle);
        
        const createResponse = await admin.graphql(
          `#graphql
            mutation createPage($page: PageCreateInput!) {
              pageCreate(page: $page) {
                page {
                  id
                  handle
                  title
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
          {
            variables: {
              page: {
                title,
                handle,
                body: pageContent,
                isPublished: true
              }
            }
          }
        );

        const createData = await createResponse.json();
        console.log("Create response:", JSON.stringify(createData, null, 2));
        
        if (createData.data?.pageCreate?.userErrors?.length > 0) {
          console.error("GraphQL create errors:", createData.data.pageCreate.userErrors);
          return json({
            success: false,
            error: createData.data.pageCreate.userErrors[0].message
          });
        }

        shopifyPage = createData.data?.pageCreate?.page;

        // Update our database record with the Shopify page ID
        if (shopifyPage) {
          console.log("Updating database with Shopify page ID:", shopifyPage.id);
          
          // Construct the page URL - remove .myshopify.com if it's already in shop
          const shopDomain = shop.replace('.myshopify.com', '');
          const pageUrl = `https://${shopDomain}.myshopify.com/pages/${shopifyPage.handle}`;
          
          await prisma.faqPage.update({
            where: { id: faqPage.id },
            data: {
              shopifyPageId: shopifyPage.id,
              pageUrl: pageUrl
            }
          });
        }
      }
    } catch (graphqlError) {
      console.error("GraphQL API error:", graphqlError);
      console.error("Error details:", JSON.stringify(graphqlError, null, 2));
      return json({
        success: false,
        error: "Failed to communicate with Shopify API: " + (graphqlError.message || "Unknown error")
      }, { status: 500 });
    }

    // Construct final page URL - remove .myshopify.com if it's already in shop
    const shopDomain = shop.replace('.myshopify.com', '');
    const finalPageUrl = `https://${shopDomain}.myshopify.com/pages/${handle}`;

    return json({
      success: true,
      page: {
        ...faqPage,
        shopifyPageId: shopifyPage?.id || faqPage.shopifyPageId,
        pageUrl: finalPageUrl
      }
    });

  } catch (error) {
    console.error("Error creating/updating FAQ page:", error);
    return json({
      success: false,
      error: error.message || "Failed to create/update page"
    }, { status: 500 });
  }
}

// Generate HTML content for the FAQ page
function generateFaqPageHtml(settings, categories, shop) {
  const activeCategories = categories.filter(cat => cat.isActive);
  
  // Apply theme presets - but only if NOT custom theme
  let themeColors = {
    backgroundColor: settings.customBackgroundColor || '#FFFFFF',
    textColor: settings.customTextColor || '#000000',
    accentColor: settings.customAccentColor || '#5C6AC4'
  };

  // Override with preset themes if selected (not custom)
  if (settings.appearanceTheme === 'light') {
    themeColors = {
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
      accentColor: '#5C6AC4'
    };
  } else if (settings.appearanceTheme === 'dark') {
    themeColors = {
      backgroundColor: '#1a1a1a',
      textColor: '#FFFFFF',
      accentColor: '#7B61FF'
    };
  } else if (settings.appearanceTheme === 'preset') {
    themeColors = {
      backgroundColor: '#F5F5F5',
      textColor: '#333333',
      accentColor: '#00A896'
    };
  }
  // For 'custom' theme, themeColors already has the custom values
  
  // Determine which colors to use
  const finalColors = settings.appearanceTheme === 'custom' ? {
    backgroundColor: settings.customBackgroundColor || '#FFFFFF',
    textColor: settings.customTextColor || '#000000',
    accentColor: settings.customAccentColor || '#5C6AC4'
  } : themeColors;
  
  // Build background style
  const backgroundStyle = settings.customBackgroundImage 
    ? `background-image: url('${settings.customBackgroundImage}'); background-size: cover; background-position: center; background-attachment: fixed;`
    : `background-color: ${finalColors.backgroundColor};`;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${settings.headerTitle || 'Frequently Asked Questions'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: ${settings.customLineHeight || 1.6};
      color: ${finalColors.textColor};
      ${backgroundStyle}
      font-size: ${settings.customFontSize || 16}px;
      min-height: 100vh;
    }
    
    .faq-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      ${settings.customBackgroundImage ? 'background-color: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: ' + (settings.customBorderRadius || 8) + 'px;' : ''}
    }
    
    ${settings.headerEnabled ? `
    .faq-header {
      text-align: ${settings.headerAlignment || 'center'};
      margin-bottom: 40px;
    }
    
    .faq-header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 12px;
      color: ${finalColors.textColor};
    }
    
    .faq-header p {
      font-size: 1.125rem;
      color: ${finalColors.accentColor};
    }
    ` : ''}
    
    ${settings.searchEnabled ? `
    .faq-search {
      max-width: 600px;
      margin: 0 auto 40px;
    }
    
    .faq-search input {
      width: 100%;
      padding: 14px 20px;
      font-size: 1rem;
      border: 2px solid ${settings.appearanceTheme === 'dark' ? '#333' : '#E1E3E5'};
      border-radius: ${settings.customBorderRadius || 8}px;
      outline: none;
      transition: border-color 0.2s;
      background-color: ${settings.appearanceTheme === 'dark' ? '#2a2a2a' : '#fff'};
      color: ${finalColors.textColor};
    }
    
    .faq-search input:focus {
      border-color: ${finalColors.accentColor};
    }
    ` : ''}
    
    .faq-categories {
      display: ${settings.layout === 'grid' ? 'grid' : 'flex'};
      ${settings.layout === 'grid' ? 'grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));' : 'flex-direction: column;'}
      gap: 30px;
    }
    
    .faq-category {
      background: ${settings.appearanceTheme === 'dark' ? '#2a2a2a' : '#fff'};
      border-radius: ${settings.customBorderRadius || 8}px;
      padding: 24px;
      ${settings.layout === 'grid' ? 'border: 1px solid ' + (settings.appearanceTheme === 'dark' ? '#333' : '#E1E3E5') + ';' : ''}
    }
    
    ${settings.showCategories ? `
    .faq-category h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 20px;
      color: ${finalColors.textColor};
    }
    ` : ''}
    
    .faq-items {
      display: flex;
      flex-direction: column;
      gap: ${settings.faqSpacing === 'compact' ? '8px' : settings.faqSpacing === 'spacious' ? '20px' : '12px'};
    }
    
    .faq-item {
      border: 1px solid ${settings.appearanceTheme === 'dark' ? '#333' : '#E1E3E5'};
      border-radius: ${settings.customBorderRadius || 8}px;
      overflow: hidden;
      background: ${settings.appearanceTheme === 'dark' ? '#1f1f1f' : '#fff'};
    }
    
    .faq-question {
      width: 100%;
      padding: 16px 20px;
      background: transparent;
      border: none;
      text-align: left;
      font-size: 1rem;
      font-weight: 500;
      color: ${finalColors.textColor};
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background-color 0.2s;
    }
    
    .faq-question:hover {
      background-color: ${settings.appearanceTheme === 'dark' ? '#333' : '#F9FAFB'};
    }
    
    .faq-question::after {
      content: '+';
      font-size: 1.5rem;
      font-weight: 300;
      transition: transform 0.2s;
      color: ${finalColors.accentColor};
    }
    
    .faq-item.active .faq-question::after {
      content: '−';
    }
    
    .faq-answer {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease-out;
    }
    
    .faq-answer-content {
      padding: 0 20px 16px;
      color: ${finalColors.accentColor};
      line-height: ${settings.customLineHeight || 1.6};
    }
    
    .faq-item.active .faq-answer {
      max-height: 1000px;
    }
    
    ${settings.contactFormEnabled ? `
    .faq-contact {
      max-width: 600px;
      margin: 50px auto 0;
      padding: 30px;
      background: ${settings.appearanceTheme === 'dark' ? '#2a2a2a' : '#F9FAFB'};
      border: 1px solid ${settings.appearanceTheme === 'dark' ? '#333' : '#E1E3E5'};
      border-radius: ${settings.customBorderRadius || 8}px;
    }
    
    .faq-contact h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 8px;
      color: ${finalColors.textColor};
    }
    
    .faq-contact p {
      color: ${finalColors.accentColor};
      margin-bottom: 20px;
    }
    
    .faq-contact input,
    .faq-contact textarea {
      width: 100%;
      padding: 12px 16px;
      margin-bottom: 12px;
      border: 1px solid ${settings.appearanceTheme === 'dark' ? '#333' : '#E1E3E5'};
      border-radius: 4px;
      font-size: 1rem;
      font-family: inherit;
      background-color: ${settings.appearanceTheme === 'dark' ? '#1f1f1f' : '#fff'};
      color: ${finalColors.textColor};
    }
    
    .faq-contact textarea {
      min-height: 120px;
      resize: vertical;
    }
    
    .faq-contact button {
      width: 100%;
      padding: 12px 24px;
      background-color: ${finalColors.accentColor};
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    
    .faq-contact button:hover {
      opacity: 0.9;
    }
    ` : ''}
    
    ${settings.customCSS || ''}
    
    @media (max-width: 768px) {
      body {
        font-size: ${Math.max(14, (settings.customFontSize || 16) - 2)}px;
      }
      
      .faq-header h1 {
        font-size: 2rem;
      }
      
      .faq-category {
        padding: 20px;
      }
      
      .faq-categories {
        grid-template-columns: 1fr;
      }
      
      .faq-container {
        padding: 20px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="faq-container">
    ${settings.headerEnabled ? `
    <div class="faq-header">
      <h1>${settings.headerTitle || 'Frequently Asked Questions'}</h1>
      <p>${settings.headerDescription || 'Got a question? We are here to answer!'}</p>
    </div>
    ` : ''}
    
    ${settings.searchEnabled ? `
    <div class="faq-search">
      <input 
        type="text" 
        id="faq-search-input" 
        placeholder="${settings.searchPlaceholder || 'Search FAQs...'}"
      />
    </div>
    ` : ''}
    
    <div class="faq-categories">
      ${activeCategories.map(category => `
        <div class="faq-category" data-category="${category.id}">
          ${settings.showCategories ? `<h2>${category.title}</h2>` : ''}
          <div class="faq-items">
            ${category.faqs.filter(faq => faq.isActive).map(faq => `
              <div class="faq-item">
                <button class="faq-question" type="button">
                  <span>${faq.question}</span>
                </button>
                <div class="faq-answer">
                  <div class="faq-answer-content">
                    ${faq.answer}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    
    ${settings.contactFormEnabled ? `
    <div class="faq-contact">
      <h3>${settings.contactFormTitle}</h3>
      <p>${settings.contactFormDescription}</p>
      <form id="faq-contact-form">
        <input 
          type="email" 
          name="email" 
          placeholder="${settings.contactFormEmailPlaceholder}"
          required
        />
        <textarea 
          name="message" 
          placeholder="${settings.contactFormMessagePlaceholder}"
          required
        ></textarea>
        <button type="submit">${settings.contactFormButtonText}</button>
      </form>
    </div>
    ` : ''}
  </div>
  
  <script>
    // FAQ accordion functionality
    document.querySelectorAll('.faq-question').forEach(button => {
      button.addEventListener('click', () => {
        const item = button.closest('.faq-item');
        const wasActive = item.classList.contains('active');
        
        ${settings.enableAccordion ? `
        // Close all other items in the same category
        const category = item.closest('.faq-category');
        category.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
        ` : ''}
        
        // Toggle current item
        if (!wasActive) {
          item.classList.add('active');
        }
      });
    });
    
    ${settings.searchEnabled ? `
    // Search functionality
    const searchInput = document.getElementById('faq-search-input');
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      
      document.querySelectorAll('.faq-item').forEach(item => {
        const question = item.querySelector('.faq-question span').textContent.toLowerCase();
        const answer = item.querySelector('.faq-answer-content').textContent.toLowerCase();
        
        if (question.includes(searchTerm) || answer.includes(searchTerm)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
      
      // Hide empty categories
      document.querySelectorAll('.faq-category').forEach(category => {
        const visibleItems = category.querySelectorAll('.faq-item:not([style*="display: none"])');
        category.style.display = visibleItems.length > 0 ? '' : 'none';
      });
    });
    ` : ''}
    
    ${settings.contactFormEnabled ? `
    // Contact form submission
    document.getElementById('faq-contact-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      
      // You can integrate with your contact form API here
      alert('Thank you for your message! We will get back to you soon.');
      e.target.reset();
    });
    ` : ''}
  </script>
</body>
</html>
  `.trim();
}