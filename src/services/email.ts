//@ts-nocheck
// service/email.ts
// Email handling functions

// Import the client-emails modules
import { processClientEmails, ClientEmailClass, ClientPackageClass } from '../models/client_emails.ts';
import { ClientDatabase } from '../models/client';

document.addEventListener("DOMContentLoaded", () => {
    // Fetch emails button event
    document.getElementById("fetchEmailsButton").addEventListener("click", async () => {
        try {
            // Initialize ClientDatabase
            const clientDB = new ClientDatabase();
            clientDB.load();

            // Extract all email addresses
            const clientEmails = [];
            clientDB.clients.forEach(client => {
                if (client.emails && Array.isArray(client.emails)) {
                    client.emails.forEach(email => {
                        if (email.address) {
                            clientEmails.push(email);
                        }
                    });
                }
            });

            console.log(`Found ${clientEmails.length} client email addresses to search`);

            // Fetch both sent and received emails
            const sentEmails = await fetchAllSentEmails();
            const receivedEmails = await fetchEmails(clientEmails);
            console.log('fecthed emails' + receivedEmails)

            // Process the emails into client packages using the imported function
            const clientPackages = processClientEmails(sentEmails, receivedEmails, clientDB);
            // Add this to your email.ts file right after loading the client database

            // Detailed client debugging
            console.log("=== DETAILED CLIENT EMAIL DEBUGGING ===");
            console.log(`Total clients: ${clientDB.clients.length}`);

            // Inspect the first few clients in detail
            const sampleClients = clientDB.clients.slice(0, 5);
            sampleClients.forEach((client, idx) => {
                console.log(`\nCLIENT ${idx + 1}: ${client.name}`);
                console.log(`UID: ${client.uid}`);
                console.log(`Email property type: ${typeof client.emails}`);

                if (client.emails === undefined) {
                    console.log("Email property is undefined");
                } else if (client.emails === null) {
                    console.log("Email property is null");
                } else if (Array.isArray(client.emails)) {
                    console.log(`Email array length: ${client.emails.length}`);

                    if (client.emails.length > 0) {
                        console.log("First email item type:", typeof client.emails[0]);
                        console.log("First email value:", client.emails[0]);

                        if (typeof client.emails[0] === 'object') {
                            console.log("Email object keys:", Object.keys(client.emails[0]));
                        }
                    } else {
                        console.log("Email array is empty");
                    }
                } else {
                    console.log("Email property is not an array:", client.emails);
                }

                // Check for getPrimaryEmail method
                if (typeof client.getPrimaryEmail === 'function') {
                    const primaryEmail = client.getPrimaryEmail();
                    console.log("getPrimaryEmail result:", primaryEmail);
                } else {
                    console.log("getPrimaryEmail method doesn't exist");
                }
            });

            // Print ALL client emails to find the format
            console.log("\n=== ALL CLIENT EMAILS ===");
            let emailCount = 0;
            let emailsFound = [];

            clientDB.clients.forEach(client => {
                if (client.emails) {
                    if (Array.isArray(client.emails)) {
                        client.emails.forEach(email => {
                            emailCount++;
                            if (emailsFound.length < 20) {  // Just store the first 20 for display
                                if (typeof email === 'string') {
                                    emailsFound.push({ client: client.name, email: email });
                                } else if (typeof email === 'object' && email.address) {
                                    emailsFound.push({ client: client.name, email: email.address, format: 'object.address' });
                                } else {
                                    emailsFound.push({ client: client.name, email: email, format: 'unknown' });
                                }
                            }
                        });
                    } else if (typeof client.emails === 'object' && client.emails.address) {
                        emailCount++;
                        if (emailsFound.length < 20) {
                            emailsFound.push({ client: client.name, email: client.emails.address, format: 'single object' });
                        }
                    } else if (typeof client.emails === 'string') {
                        emailCount++;
                        if (emailsFound.length < 20) {
                            emailsFound.push({ client: client.name, email: client.emails, format: 'single string' });
                        }
                    }
                }
            });

            console.log(`Total email entries found: ${emailCount}`);
            console.log("Sample emails:", emailsFound);
            // Log the results to console for testing
            console.log("===== CLIENT EMAIL PACKAGES =====");
            console.log(`Found ${clientPackages.length} clients with email activity`);

            clientPackages.forEach((pkg, index) => {
                console.group(`Client Package ${index + 1}: ${pkg.principalName} (${pkg.principalEmail})`);
                console.log(`Emails From Client: ${pkg.emailsFrom.length}`);
                console.log(`Emails To Client: ${pkg.emailsTo.length}`);
                console.groupEnd();
            });

            // Return the client packages for potential further use
            return clientPackages;
        } catch (error) {
            console.error("Error in email processing:", error);
        }
    });
});

// Fetch emails from Microsoft Graph API using an array of client emails
async function fetchEmails(clientEmails = null) {
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

        // Process in batches to handle 200-300 email addresses
        const BATCH_SIZE = 20; // Process 20 emails at a time
        let allEmails = [];

        // If no client emails provided, fetch ALL emails (not just inbox)
        if (!clientEmails || !Array.isArray(clientEmails) || clientEmails.length === 0) {
            // Use inbox path for emails
            let nextLink = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=receivedDateTime ge ${filterDate}&$select=subject,body,receivedDateTime,from&$orderby=receivedDateTime DESC&$top=25`;

            // Fetch emails with pagination
            while (nextLink && allEmails.length < 100) { // Increased limit for all emails
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
        } else {
            // Process client emails in batches
            for (let i = 0; i < clientEmails.length; i += BATCH_SIZE) {
                const batchEmails = clientEmails.slice(i, i + BATCH_SIZE);

                // Extract just the email addresses from the IEmail objects
                const emailAddresses = batchEmails.map(email => email.address);

                // Build query for this batch of emails
                const emailFilter = emailAddresses.map(address =>
                    `from/emailAddress/address eq '${address}'`
                ).join(' or ');

                // Combined filter for date and emails
                const filter = `receivedDateTime ge ${filterDate} and (${emailFilter})`;

                // Build URL with filter - search INBOX only
                let nextLink = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=${encodeURIComponent(filter)}&$select=subject,body,receivedDateTime,from&$orderby=receivedDateTime DESC&$top=25`;

                let batchCount = 0;
                const maxPerBatch = 50; // Max emails per batch

                // Fetch emails with pagination for this batch
                while (nextLink && batchCount < maxPerBatch) {
                    const response = await fetch(nextLink, {
                        headers: {
                            "Authorization": `Bearer ${accessToken}`
                        }
                    });

                    if (!response.ok) {
                        console.error(`API error in batch ${Math.floor(i / BATCH_SIZE) + 1}: ${response.status}`);
                        break; // Skip to next batch on error
                    }

                    const data = await response.json();
                    allEmails = [...allEmails, ...data.value];
                    batchCount += data.value.length;
                    nextLink = data["@odata.nextLink"] || null;
                }
            }
        }

        // Sort all emails by date (newest first)
        allEmails.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));

        displayEmails(allEmails);
        return allEmails;
    } catch (error) {
        console.error("Error fetching emails:", error);
        alert("Failed to fetch emails: " + error.message);
    } finally {
        // Hide loading spinner
        document.getElementById("loadingSpinner").style.display = "none";
    }
}

// Fetch all sent emails from the last 10 days
async function fetchAllSentEmails() {
    try {
        // Show minimal loading indicator
        console.log("Fetching sent emails from the last 10 days...");

        // Get access token
        const accessToken = await getAccessToken();

        // Get date 10 days ago
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const filterDate = tenDaysAgo.toISOString();

        // Build filter for all sent items within date range
        const filter = `sentDateTime ge ${filterDate}`;

        // Build URL with filter - sent items folder with large page size
        let nextLink = `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$filter=${encodeURIComponent(filter)}&$select=subject,body,sentDateTime,toRecipients,from&$orderby=sentDateTime DESC&$top=100`;

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