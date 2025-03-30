// client-emails.ts
import { ClientClass, ClientDatabase } from "../models/client";

interface IEmailAddress {
    email: string; // The email address
    name: string; // The name associated with the email address
}

export class ClientEmailClass {
    id: string;
    subject: string;
    from: IEmailAddress;
    toRecipients: IEmailAddress[] = [];
    ccRecipients: IEmailAddress[] = [];
    bccRecipients: IEmailAddress[] = [];
    body: string; //plain text body of the email
    dateSent: Date;
    dateReceived: Date;

    constructor(data = {}) {
        Object.assign(this, data);
    }
}

export class ClientPackageClass {
    principalName: string; // The principal name associated with the package
    principalEmail: string; // Principal email address
    packageId: string; // Unique identifier for the package
    emailsFrom: ClientEmailClass[] = []; // Array of emails sent from any client email
    emailsTo: ClientEmailClass[] = []; // Array of emails sent to any client email
    allClientEmails: string[] = []; // All email addresses associated with this client

    constructor(client: ClientClass) {
        this.packageId = client.uid;
        this.allClientEmails = [...client.emails]; // Store all client emails

        // Set principal info (use first email as principal)
        if (client.emails && client.emails.length > 0) {
            this.principalEmail = client.emails[0];
            this.principalName = client.name || '';
        } else {
            this.principalEmail = '';
            this.principalName = client.name || '';
        }
    }
}

/**
 * Processes fetched emails and associates them with clients
 * @param sentEmails Array of sent emails from Microsoft Graph API
 * @param receivedEmails Array of received emails from Microsoft Graph API
 * @param clientDB The client database instance
 * @returns Array of ClientPackageClass objects
 */

/**
 * Processes fetched emails and associates them with clients
 * @param sentEmails Array of sent emails from Microsoft Graph API
 * @param receivedEmails Array of received emails from Microsoft Graph API
 * @param clientDB The client database instance
 * @returns Array of ClientPackageClass objects
 */


/**
 * Processes fetched emails and associates them with clients
 * @param sentEmails Array of sent emails from Microsoft Graph API
 * @param receivedEmails Array of received emails from Microsoft Graph API
 * @param clientDB The client database instance
 * @returns Array of ClientPackageClass objects
 */
export function processClientEmails(sentEmails, receivedEmails, clientDB) {
    // Create maps for quick lookups
    const clientEmailMap = new Map();
    const clientPackages = new Map();
    
    // Build a map of all client emails for quick lookup
    clientDB.clients.forEach(client => {
        if (client.emails && Array.isArray(client.emails)) {
            // Create a package for this client
            const packageId = client.uid;
            const clientPackage = new ClientPackageClass(client);
            clientPackages.set(packageId, clientPackage);
            
            // Map all client emails to this client's package
            client.emails.forEach(emailAddress => {
                if (typeof emailAddress === 'string') {
                    clientEmailMap.set(emailAddress.toLowerCase(), {
                        clientUid: client.uid
                    });
                }
            });
        }
    });
    
    // Process received emails - these are FROM clients TO me
// Process received emails - these are FROM clients TO me
if (receivedEmails && Array.isArray(receivedEmails)) {
    receivedEmails.forEach(email => {
        if (!email.from || !email.from.emailAddress || !email.from.emailAddress.address) return;
        
        // Get the sender email address
        const senderEmail = email.from.emailAddress.address.toLowerCase();
        
        // Check if sender matches ANY email associated with ANY client
        let matchedClient = null;
        
        // Loop through all clients to check for related email addresses
        clientDB.clients.forEach(client => {
            if (client.emails && Array.isArray(client.emails)) {
                // Check if this email matches any of the client's emails
                client.emails.forEach(clientEmail => {
                    if (typeof clientEmail === 'string' && 
                        senderEmail.includes(clientEmail.toLowerCase()) || 
                        clientEmail.toLowerCase().includes(senderEmail)) {
                        // Found a match with this client's email
                        matchedClient = {
                            clientUid: client.uid,
                            clientName: client.name,
                            matchType: 'related'
                        };
                    }
                });
            }
        });
        
        // If we found a match, create the email and add it to the client's package
        if (matchedClient) {
            // Create email object
            const clientEmail = new ClientEmailClass({
                id: email.id || Math.random().toString(36).substring(2, 15),
                subject: email.subject || "(No subject)",
                body: email.body?.content || "",
                dateReceived: email.receivedDateTime ? new Date(email.receivedDateTime) : new Date(),
                from: {
                    email: email.from.emailAddress.address,
                    name: email.from.emailAddress.name || ""
                },
                toRecipients: email.toRecipients ? email.toRecipients.map(r => ({
                    email: r.emailAddress.address,
                    name: r.emailAddress.name || ""
                })) : []
            });
            
            // Get or create client package
            if (!clientPackages.has(matchedClient.clientUid)) {
                const client = clientDB.getClient(matchedClient.clientUid);
                if (client) {
                    clientPackages.set(matchedClient.clientUid, new ClientPackageClass(client));
                }
            }
            
            // Add to emailsFrom for this client
            const clientPackage = clientPackages.get(matchedClient.clientUid);
            if (clientPackage) {
                clientPackage.emailsFrom.push(clientEmail);
                console.log(`Added email from ${senderEmail} to client ${matchedClient.clientName} (${matchedClient.matchType} match)`);
            }
        }
    });
}
    // Process sent emails - these are FROM me TO clients
    if (sentEmails && Array.isArray(sentEmails)) {
        sentEmails.forEach(email => {
            if (!email.toRecipients) return;
            
            // Process each recipient
            email.toRecipients.forEach(recipient => {
                if (!recipient.emailAddress || !recipient.emailAddress.address) return;
                
                // Get recipient email address
                const recipientEmail = recipient.emailAddress.address.toLowerCase();
                
                // Check if recipient is a client
                const clientInfo = clientEmailMap.get(recipientEmail);
                if (clientInfo) {
                    // Create email object
                    const clientEmail = new ClientEmailClass({
                        id: email.id || Math.random().toString(36).substring(2, 15),
                        subject: email.subject || "(No subject)",
                        body: email.body?.content || "",
                        dateSent: email.sentDateTime ? new Date(email.sentDateTime) : new Date(),
                        from: {
                            email: email.from?.emailAddress?.address || "",
                            name: email.from?.emailAddress?.name || ""
                        },
                        toRecipients: email.toRecipients ? email.toRecipients.map(r => ({
                            email: r.emailAddress.address,
                            name: r.emailAddress.name || ""
                        })) : []
                    });
                    
                    // Get client package
                    const clientPackage = clientPackages.get(clientInfo.clientUid);
                    if (clientPackage) {
                        // Add to emailsTo for this client
                        clientPackage.emailsTo.push(clientEmail);
                    }
                }
            });
        });
    }
    // At the end of processClientEmails function, before returning result:
console.log(`===== CLIENT EMAIL PACKAGES =====`);
// Add this at the end of processClientEmails function before returning the result
console.log(`===== CLIENT EMAIL PACKAGES =====`);
const result = Array.from(clientPackages.values()).filter(
    pkg => pkg.emailsFrom.length > 0 || pkg.emailsTo.length > 0
);

console.log(`Found ${result.length} clients with email activity`);

result.forEach((pkg, index) => {
    console.log(`Client Package ${index + 1}: ${pkg.principalName} (${pkg.principalEmail})`);
    console.log(`Emails From Client: ${pkg.emailsFrom.length}`);
    
    // List each email FROM the client
    if (pkg.emailsFrom.length > 0) {
        pkg.emailsFrom.forEach((email, i) => {
            console.log(`  From Email #${i+1}: ${email.subject} (${new Date(email.dateReceived).toLocaleDateString()})`);
        });
    }
    
    console.log(`Emails To Client: ${pkg.emailsTo.length}`);
    
    // List each email TO the client
    if (pkg.emailsTo.length > 0) {
        pkg.emailsTo.forEach((email, i) => {
            console.log(`  To Email #${i+1}: ${email.subject} (${new Date(email.dateSent || email.dateReceived).toLocaleDateString()})`);
        });
    }
    
    console.log("---------------------");
});

return result;
}
// Function to update email.ts click event handler
export function initializeEmailProcessing() {
    document.addEventListener("DOMContentLoaded", () => {
        // Fetch emails button event
        document.getElementById("fetchEmailsButton").addEventListener("click", async () => {
            try {
                // Initialize ClientDatabase
                const clientDB = new ClientDatabase();
                clientDB.load();

                console.log(`Loaded ${clientDB.clients.length} clients from database`);

                // Get both sent and received emails
                const sentEmails = await fetchAllSentEmails();
                const receivedEmails = await fetchEmails();

                console.log(`Fetched ${sentEmails.length} sent emails and ${receivedEmails.length} received emails`);

                // Process emails into client packages
                const clientPackages = processEmails(sentEmails, receivedEmails, clientDB);

                // Log the results to console for testing
                console.log("===== CLIENT EMAIL PACKAGES =====");
                console.log(`Found ${clientPackages.length} clients with email activity`);

                clientPackages.forEach((pkg, index) => {
                    console.group(`Client Package ${index + 1}: ${pkg.principalName} (${pkg.principalEmail})`);
                    console.log(`All Client Emails: ${pkg.allClientEmails.join(', ')}`);
                    console.log(`Emails From Client: ${pkg.emailsFrom.length}`);
                    console.log(`Emails To Client: ${pkg.emailsTo.length}`);
                    console.groupEnd();
                });

                return clientPackages;
            } catch (error) {
                console.error("Error in email processing:", error);
            }
        });
    });
}