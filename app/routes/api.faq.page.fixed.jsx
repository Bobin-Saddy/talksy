// app/routes/api.faq.page.jsx - Create/Update Shopify Pages (Fixed)
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// This handles POST requests
export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const data = await request.json();
    const { handle, title, settings, categories } = data;

    // Generate the FAQ page HTML content
    const pageContent = generateFAQPageHTML(settings, categories);

    // Check if page already exists
    let existingPage = await prisma.faqPage.findFirst({
      where: { shop }
    });

    let shopifyPageId;
    let pageUrl;

    if (existingPage && existingPage.shopifyPageId) {
      // Update existing Shopify page
      const response = await admin.graphql(
        `#graphql
        mutation updatePage($id: ID!, $page: PageUpdateInput!) {
          pageUpdate(id: $id, page: $page) {
            page {
              id
              handle
              title
              body
              onlineStoreUrl
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            id: existingPage.shopifyPageId,
            page: {
              handle: handle,
              title: title,
              body: pageContent,
              isPublished: true
            }
          }
        }
      );

      const result = await response.json();
      
      if (result.data.pageUpdate.userErrors.length > 0) {
        return json({
          success: false,
          error: result.data.pageUpdate.userErrors[0].message
        });
      }

      shopifyPageId = result.data.pageUpdate.page.id;
      pageUrl = result.data.pageUpdate.page.onlineStoreUrl;

      // Update in database
      const updatedPage = await prisma.faqPage.update({
        where: { id: existingPage.id },
        data: {
          handle,
          title,
          shopifyPageId,
          pageUrl,
          updatedAt: new Date()
        }
      });

      return json({
        success: true,
        page: updatedPage,
        message: "FAQ page updated successfully"
      });
    } else {
      // Create new Shopify page
      const response = await admin.graphql(
        `#graphql
        mutation createPage($page: PageCreateInput!) {
          pageCreate(page: $page) {
            page {
              id
              handle
              title
              body
              onlineStoreUrl
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
              handle: handle,
              title: title,
              body: pageContent,
              isPublished: true
            }
          }
        }
      );

      const result = await response.json();
      
      if (result.data.pageCreate.userErrors.length > 0) {
        return json({
          success: false,
          error: result.data.pageCreate.userErrors[0].message
        });
      }

      shopifyPageId = result.data.pageCreate.page.id;
      pageUrl = result.data.pageCreate.page.onlineStoreUrl;

      // Save to database
      const newPage = await prisma.faqPage.create({
        data: {
          shop,
          handle,
          title,
          shopifyPageId,
          pageUrl,
          isPublished: true
        }
      });

      return json({
        success: true,
        page: newPage,
        message: "FAQ page created successfully"
      });
    }
  } catch (error) {
    console.error("Error creating/updating page:", error);
    return json({
      success: false,
      error: error.message || "Failed to create/update page"
    }, { status: 500 });
  }
}

// Generate HTML content for the FAQ page
function generateFAQPageHTML(settings, categories) {
  const activeCategories = categories.filter(cat => cat.isActive);
  
  const styles = `
    <style>
      .faq-container {
        max-width: 900px;
        margin: 0 auto;
        padding: 40px 20px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background-color: ${settings.customBackgroundColor || '#FFFFFF'};
        color: ${settings.customTextColor || '#000000'};
      }
      
      .faq-header {
        text-align: ${settings.headerAlignment || 'center'};
        margin-bottom: 40px;
      }
      
      .faq-header h1 {
        font-size: 2.5rem;
        font-weight: 700;
        margin-bottom: 12px;
        color: ${settings.customTextColor || '#000000'};
      }
      
      .faq-header p {
        font-size: 1.125rem;
        color: ${settings.customAccentColor || '#666666'};
      }
      
      .faq-search {
        margin-bottom: 30px;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
      }
      
      .faq-search input {
        width: 100%;
        padding: 14px 20px;
        font-size: 1rem;
        border: 2px solid #E1E3E5;
        border-radius: ${settings.customBorderRadius || 8}px;
        outline: none;
        transition: border-color 0.2s;
      }
      
      .faq-search input:focus {
        border-color: ${settings.customAccentColor || '#5C6AC4'};
      }
      
      .faq-category {
        margin-bottom: 40px;
      }
      
      .faq-category-title {
        font-size: 1.75rem;
        font-weight: 600;
        margin-bottom: 20px;
        color: ${settings.customTextColor || '#000000'};
        ${!settings.showCategories ? 'display: none;' : ''}
      }
      
      .faq-list {
        display: flex;
        flex-direction: column;
        gap: ${settings.faqSpacing === 'compact' ? '8px' : '12px'};
      }
      
      .faq-item {
        border: 1px solid #E1E3E5;
        border-radius: ${settings.customBorderRadius || 8}px;
        overflow: hidden;
        background-color: #FFFFFF;
        transition: box-shadow 0.2s;
      }
      
      .faq-item:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      
      .faq-question {
        width: 100%;
        padding: 18px 20px;
        text-align: left;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 1.0625rem;
        font-weight: 500;
        color: ${settings.customTextColor || '#000000'};
        transition: background-color 0.2s;
      }
      
      .faq-question:hover {
        background-color: #F9FAFB;
      }
      
      .faq-question-text {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .faq-icon {
        font-size: 1.25rem;
        ${!settings.showIcons ? 'display: none;' : ''}
      }
      
      .faq-toggle {
        font-size: 1.5rem;
        line-height: 1;
        transition: transform 0.2s;
      }
      
      .faq-item.open .faq-toggle {
        transform: rotate(45deg);
      }
      
      .faq-answer {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
      }
      
      .faq-item.open .faq-answer {
        max-height: 1000px;
      }
      
      .faq-answer-content {
        padding: 0 20px 18px;
        font-size: 1rem;
        line-height: 1.6;
        color: ${settings.customAccentColor || '#666666'};
      }
      
      .faq-contact-form {
        margin-top: 50px;
        padding: 30px;
        border: 1px solid #E1E3E5;
        border-radius: ${settings.customBorderRadius || 8}px;
        background-color: #F9FAFB;
        ${!settings.contactFormEnabled ? 'display: none;' : ''}
      }
      
      .faq-contact-form h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 8px;
        color: ${settings.customTextColor || '#000000'};
      }
      
      .faq-contact-form p {
        font-size: 1rem;
        color: ${settings.customAccentColor || '#666666'};
        margin-bottom: 20px;
      }
      
      .faq-contact-form input,
      .faq-contact-form textarea {
        width: 100%;
        padding: 12px 16px;
        margin-bottom: 12px;
        font-size: 1rem;
        border: 1px solid #E1E3E5;
        border-radius: 6px;
        font-family: inherit;
      }
      
      .faq-contact-form textarea {
        min-height: 100px;
        resize: vertical;
      }
      
      .faq-contact-form button {
        padding: 12px 24px;
        font-size: 1rem;
        font-weight: 500;
        color: #FFFFFF;
        background-color: ${settings.customAccentColor || '#5C6AC4'};
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      
      .faq-contact-form button:hover {
        opacity: 0.9;
      }
      
      ${settings.customCSS || ''}
      
      @media (max-width: 768px) {
        .faq-container {
          padding: 30px 16px;
        }
        
        .faq-header h1 {
          font-size: 2rem;
        }
        
        .faq-category-title {
          font-size: 1.5rem;
        }
      }
    </style>
  `;

  const headerHTML = settings.headerEnabled ? `
    <div class="faq-header">
      <h1>${escapeHtml(settings.headerTitle || 'Frequently Asked Questions')}</h1>
      <p>${escapeHtml(settings.headerDescription || 'Got a question? We are here to answer!')}</p>
    </div>
  ` : '';

  const searchHTML = settings.searchEnabled ? `
    <div class="faq-search">
      <input type="text" id="faq-search-input" placeholder="${escapeHtml(settings.searchPlaceholder || 'Search FAQs...')}" />
    </div>
  ` : '';

  const categoriesHTML = activeCategories.map(category => {
    const activeFaqs = category.faqs.filter(faq => faq.isActive);
    
    if (activeFaqs.length === 0) return '';
    
    return `
      <div class="faq-category" data-category="${escapeHtml(category.title)}">
        <h2 class="faq-category-title">${escapeHtml(category.title)}</h2>
        <div class="faq-list">
          ${activeFaqs.map(faq => `
            <div class="faq-item" data-question="${escapeHtml(faq.question.toLowerCase())}" data-answer="${escapeHtml(faq.answer.toLowerCase())}">
              <button class="faq-question" onclick="toggleFaq(this)">
                <span class="faq-question-text">
                  <span class="faq-icon">${getFaqIcon(faq.icon)}</span>
                  <span>${escapeHtml(faq.question)}</span>
                </span>
                <span class="faq-toggle">+</span>
              </button>
              <div class="faq-answer">
                <div class="faq-answer-content">${escapeHtml(faq.answer)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  const contactFormHTML = settings.contactFormEnabled ? `
    <div class="faq-contact-form">
      <h2>${escapeHtml(settings.contactFormTitle || "Can't find what you're looking for?")}</h2>
      <p>${escapeHtml(settings.contactFormDescription || "Send us a message and we'll get back to you soon")}</p>
      <form id="faq-contact-form" onsubmit="return handleContactSubmit(event)">
        <input 
          type="email" 
          name="email" 
          placeholder="${escapeHtml(settings.contactFormEmailPlaceholder || 'you@example.com')}" 
          required 
        />
        <textarea 
          name="message" 
          placeholder="${escapeHtml(settings.contactFormMessagePlaceholder || 'How can we help?')}" 
          required
        ></textarea>
        <button type="submit">${escapeHtml(settings.contactFormButtonText || 'Send Message')}</button>
      </form>
    </div>
  ` : '';

  const scriptHTML = `
    <script>
      function toggleFaq(button) {
        const item = button.closest('.faq-item');
        const wasOpen = item.classList.contains('open');
        
        ${settings.enableAccordion ? `
          // Close all other FAQs in accordion mode
          document.querySelectorAll('.faq-item.open').forEach(openItem => {
            if (openItem !== item) {
              openItem.classList.remove('open');
            }
          });
        ` : ''}
        
        item.classList.toggle('open', !wasOpen);
      }
      
      ${settings.searchEnabled ? `
        // Search functionality
        const searchInput = document.getElementById('faq-search-input');
        if (searchInput) {
          searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const faqItems = document.querySelectorAll('.faq-item');
            const categories = document.querySelectorAll('.faq-category');
            
            faqItems.forEach(item => {
              const question = item.getAttribute('data-question');
              const answer = item.getAttribute('data-answer');
              const matches = question.includes(searchTerm) || answer.includes(searchTerm);
              item.style.display = matches ? 'block' : 'none';
            });
            
            // Hide categories with no visible FAQs
            categories.forEach(category => {
              const visibleFaqs = category.querySelectorAll('.faq-item[style="display: block"], .faq-item:not([style*="display"])');
              category.style.display = visibleFaqs.length > 0 ? 'block' : 'none';
            });
          });
        }
      ` : ''}
      
      ${settings.contactFormEnabled ? `
        function handleContactSubmit(event) {
          event.preventDefault();
          const formData = new FormData(event.target);
          const email = formData.get('email');
          const message = formData.get('message');
          
          // Here you would typically send this to your backend
          alert('Thank you for your message! We will get back to you soon.');
          event.target.reset();
          return false;
        }
      ` : ''}
    </script>
  `;

  return `
    ${styles}
    <div class="faq-container">
      ${headerHTML}
      ${searchHTML}
      ${categoriesHTML}
      ${contactFormHTML}
    </div>
    ${scriptHTML}
  `;
}

function getFaqIcon(iconName) {
  const icons = {
    'QuestionCircleIcon': '❓',
    'ChatIcon': '💬',
    'InfoIcon': 'ℹ️',
    'LightbulbIcon': '💡',
    'StarIcon': '⭐',
    'CheckCircleIcon': '✅'
  };
  return icons[iconName] || '❓';
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text?.toString().replace(/[&<>"']/g, m => map[m]) || '';
}