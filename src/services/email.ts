//@ts-nocheck
// services/email.ts
// Email handling functions

// Import the client-emails modules
import { processClientEmails, ClientEmailClass, ClientPackageClass } from '../models/client_emails';
import { ClientDatabase } from '../models/client';

document.getElementById("fetchEmailsButton").addEventListener("click", async () => {
    try {
        // Initialize ClientDatabase
        const clientDB = new ClientDatabase();
        clientDB.load();

        // Fetch both sent and received emails
        const sentEmails = await fetchAllSentEmails();
        console.log(`Fetched ${sentEmails.length} sent emails`);
        
        const receivedEmails = await fetchEmails();
        console.log(`Fetched ${receivedEmails.length} received emails`);
        
        // Check if receivedEmails has data
        if (receivedEmails && receivedEmails.length > 0) {
            console.log('First received email:', {
                subject: receivedEmails[0].subject,
                from: receivedEmails[0].from?.emailAddress?.address,
                received: receivedEmails[0].receivedDateTime
            });
        } else {
            console.log('No received emails found');
        }
        
        // Process the emails into client packages
        const clientPackages = processClientEmails(sentEmails, receivedEmails, clientDB);
        
        // Log the results
        console.log(`Found ${clientPackages.length} clients with email activity`);
        
        // Return the client packages
        return clientPackages;
    } catch (error) {
        console.error("Error in email processing:", error);
    }
});
// Fetch emails from Microsoft Graph API using an array of client emails

async function fetchEmails() {
    try {
        // Show loading spinner
        document.getElementById("loadingSpinner").style.display = "block";
        document.getElementById("emailList").innerHTML = "";

        // Get access token
        const accessToken = await getAccessToken();

        // Get date 10 days ago
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const filterDate = tenDaysAgo.toISOString();

        let allEmails = [];

        // Use inbox path for emails
        let nextLink = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=receivedDateTime ge ${filterDate}&$select=subject,body,receivedDateTime,from,toRecipients,ccRecipients&$orderby=receivedDateTime DESC&$top=50`;

        // Fetch emails with pagination
        while (nextLink && allEmails.length < 1000) {
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

        // Sort all emails by date (newest first)
        allEmails.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));

        displayEmails(allEmails);
        return allEmails;
    } catch (error) {
        console.error("Error fetching emails:", error);
        alert("Failed to fetch emails: " + error.message);
        return [];
    } finally {
        // Hide loading spinner
        document.getElementById("loadingSpinner").style.display = "none";
    }
}



// Fetch all sent emails from the last 10 days
async function fetchAllSentEmails() {
    try {
        // Get access token
        const accessToken = await getAccessToken();

        // Get date 10 days ago
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const filterDate = tenDaysAgo.toISOString();

        // Build filter for all sent items within date range
        const filter = `sentDateTime ge ${filterDate}`;

        // Build URL with filter - sent items folder with large page size
        let nextLink = `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$filter=${encodeURIComponent(filter)}&$select=subject,body,sentDateTime,toRecipients,ccRecipients,from&$orderby=sentDateTime DESC&$top=100`;

        let sentEmails = [];

        // Fetch emails with pagination
        while (nextLink && sentEmails.length < 500) { // Get up to 500 sent emails
            const response = await fetch(nextLink, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            sentEmails = [...sentEmails, ...data.value];
            nextLink = data["@odata.nextLink"] || null;
        }

        console.log(`Fetched ${sentEmails.length} sent emails`);
        displayEmails(sentEmails);
        return sentEmails; // Return the emails instead of displaying them

    } catch (error) {
        console.error("Error fetching sent emails:", error);
        throw error; // Re-throw the error for handling by the caller
    }
}

// Strip HTML from text
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
        const receivedDate = new Date(email.receivedDateTime || email.sentDateTime);
        const formattedDate = receivedDate.toLocaleString();
        const sender = email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown";
        const plainTextBody = stripHtml(email.body?.content || "");

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