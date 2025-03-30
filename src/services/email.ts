//@ts-nocheck
// service/email.ts
// Email handling functions

document.addEventListener("DOMContentLoaded", () => {
    // Fetch emails button event
    document.getElementById("fetchEmailsButton").addEventListener("click", fetchEmails);
});

// Fetch emails from Microsoft Graph API
async function fetchEmails() {
    try {
        // Show loading spinner
        document.getElementById("loadingSpinner").style.display = "block";
        document.getElementById("emailList").innerHTML = "";
        
        // Get access token
        const accessToken = await getAccessToken();
        
        // Get date 4 days ago
        const fourDaysAgo = new Date();
        fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
        const filterDate = fourDaysAgo.toISOString();
        
        // Build URL with date filter - inbox only
        let nextLink = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=receivedDateTime ge ${filterDate}&$select=subject,body,receivedDateTime,from&$orderby=receivedDateTime DESC&$top=10`;
        
        let allEmails = [];
        
        // Fetch emails with pagination
        while (nextLink && allEmails.length < 50) { // Limit to 50 emails max
            const response = await fetch(nextLink, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            allEmails = [...allEmails, ...data.value];
            nextLink = data["@odata.nextLink"] || null;
        }
        
        displayEmails(allEmails);
    } catch (error) {
        console.error("Error fetching emails:", error);
        alert("Failed to fetch emails: " + error.message);
    } finally {
        // Hide loading spinner
        document.getElementById("loadingSpinner").style.display = "none";
    }
}

// Strip HTML from text
/**
 * Strips HTML tags and converts common HTML entities to plain text
 * @param {string} html - The HTML content to strip
 * @return {string} The plain text content
 */
function stripHtml(html) {
    if (!html) return "";
    
    // Create a new DOM parser and parse the HTML
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Replace <br>, <p>, and similar tags with newlines before extracting text
    const breakElements = doc.querySelectorAll('br, p, div, h1, h2, h3, h4, h5, h6, li');
    breakElements.forEach(el => {
        // Don't add breaks for empty elements or nested within pre/code
        if (el.textContent.trim() && !el.closest('pre, code')) {
            if (el.tagName === 'BR') {
                el.parentNode.insertBefore(document.createTextNode('\n'), el.nextSibling);
            } else {
                // Add a newline after block elements
                el.insertAdjacentText('afterend', '\n');
            }
        }
    });
    
    // Get the text content
    let text = doc.body.textContent || "";
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");
    
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Restore appropriate newlines
    text = text.replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n');
    
    return text;
}

// Display emails in the UI
function displayEmails(emails) {
    const emailListElement = document.getElementById("emailList");
    
    if (emails.length === 0) {
        emailListElement.innerHTML = "<p>No emails found.</p>";
        return;
    }
    
    let emailsHtml = "";
    
    emails.forEach(email => {
        const receivedDate = new Date(email.receivedDateTime);
        const formattedDate = receivedDate.toLocaleString();
        const sender = email.from.emailAddress.name || email.from.emailAddress.address;
        const plainTextBody = stripHtml(email.body.content);
        
        emailsHtml += `
            <div class="email-item">
                <div class="email-subject">${escapeHtml(email.subject || "(No subject)")}</div>
                <div class="email-sender">From: ${escapeHtml(sender)}</div>
                <div class="email-time">${formattedDate}</div>
                <div class="email-body">${escapeHtml(plainTextBody)}</div>
            </div>
        `;
    });
    
    emailListElement.innerHTML = emailsHtml;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}