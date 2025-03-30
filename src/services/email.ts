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
        
        const receivedEmails = await fetchEmails();
        
        // Check if receivedEmails has data

        
        // Process the emails into client packages
        const clientPackages = processClientEmails(sentEmails, receivedEmails, clientDB);
        
        // Log the results
        
        // Return the client packages
        return clientPackages;
    } catch (error) {
        console.error("Error in email processing:", error);
    }
});
// Fetch emails from Microsoft Graph API using an array of client emails

export async function fetchEmails() {
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
export async function fetchAllSentEmails() {
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
// Display emails in the UI grouped by client packages
function displayEmails(emails) {
    console.log(emails)
    const emailListElement = document.getElementById("emailList");

    if (emails.length === 0) {
        emailListElement.innerHTML = "<p>No emails found.</p>";
        return;
    }

    // Get client packages
    const clientDB = new ClientDatabase();
    clientDB.load();
    const clientPackages = processClientEmails(emails, emails, clientDB);
    
    let packagesHtml = "";
    
    // If we have client packages, display them
    if (clientPackages && clientPackages.length > 0) {
        packagesHtml += `<div>Found ${clientPackages.length} clients with email activity</div>`;
        
        clientPackages.forEach((pkg, index) => {
            packagesHtml += `
            <div>
                <h3>Client Package ${index + 1}: ${escapeHtml(pkg.principalName)} (${escapeHtml(pkg.principalEmail)})</h3>
                
                <div>
                    <p>Emails From Client: ${pkg.emailsFrom.length}</p>
                    <ul>
            `;
            
            if (pkg.emailsFrom && pkg.emailsFrom.length > 0) {
                pkg.emailsFrom.forEach((email, i) => {
                    packagesHtml += `
                    <li>
                        ${escapeHtml(email.subject)} (${new Date(email.dateReceived).toLocaleDateString()})
                    </li>`;
                });
            } else {
                packagesHtml += `<li>No emails from client</li>`;
            }
            
            packagesHtml += `
                    </ul>
                </div>
                
                <div>
                    <p>Emails To Client: ${pkg.emailsTo.length}</p>
                    <ul>
            `;
            
            if (pkg.emailsTo && pkg.emailsTo.length > 0) {
                pkg.emailsTo.forEach((email, i) => {
                    packagesHtml += `
                    <li>
                        ${escapeHtml(email.subject)} (${new Date(email.dateSent || email.dateReceived).toLocaleDateString()})
                    </li>`;
                });
            } else {
                packagesHtml += `<li>No emails to client</li>`;
            }
            
            packagesHtml += `
                    </ul>
                </div>
            </div>
            <hr>`;
        });
    } else {
        // No client packages found
        packagesHtml = "<p>No client email packages found.</p>";
    }

    emailListElement.innerHTML = packagesHtml;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}