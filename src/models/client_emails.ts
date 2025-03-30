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
export function processClientEmails(sentEmails, receivedEmails, clientDB) {
    // Get all client emails for matching
    const clientEmailMap = new Map();
    const clientPackages = new Map();

    // Add this to your processEmails function in client-emails.ts

    // At the beginning of processEmails function:
    console.log("Starting to process emails for client matching");
    console.log("Received emails count:", receivedEmails?.length || 0);
    console.log("Sent emails count:", sentEmails?.length || 0);
    console.log("Client count:", clientDB.clients?.length || 0);

    // After building the client email map:
    console.log("Client email map built with", clientEmailMap.size, "entries");
    // Log a few sample entries to verify format
    if (clientEmailMap.size > 0) {
        const sampleEntries = Array.from(clientEmailMap.entries()).slice(0, 3);
        console.log("Sample email map entries:", sampleEntries);
    }

    // Inside the received emails processing:
    receivedEmails.forEach(email => {
        if (!email.from || !email.from.emailAddress || !email.from.emailAddress.address) {
            console.log("Skipping email with invalid from address", email.subject);
            return;
        }

        const senderEmail = email.from.emailAddress.address.toLowerCase();
        console.log("Checking received email from:", senderEmail);

        const clientInfo = clientEmailMap.get(senderEmail);
        if (clientInfo) {
            console.log("MATCH FOUND: Email from client:", senderEmail);
        }
    });

    // Similar debugging for sent emails:
    sentEmails.forEach(email => {
        if (!email.toRecipients || !Array.isArray(email.toRecipients)) {
            console.log("Skipping sent email with invalid recipients", email.subject);
            return;
        }

        email.toRecipients.forEach(recipient => {
            if (!recipient.emailAddress || !recipient.emailAddress.address) return;

            const recipientEmail = recipient.emailAddress.address.toLowerCase();
            console.log("Checking sent email to:", recipientEmail);

            const clientInfo = clientEmailMap.get(recipientEmail);
            if (clientInfo) {
                console.log("MATCH FOUND: Email to client:", recipientEmail);
            }
        });
    });

    // Build a map of all client emails for quick lookup
    clientDB.clients.forEach(client => {
        if (client.emails && Array.isArray(client.emails) && client.emails.length > 0) {
            // Create a package for this client
            const packageId = client.uid;
            const clientPackage = new ClientPackageClass(client);
            clientPackages.set(packageId, clientPackage);

            // Map all client emails to this client's package
            client.emails.forEach(emailAddress => {
                if (emailAddress && typeof emailAddress === 'string') {
                    clientEmailMap.set(emailAddress.toLowerCase(), {
                        clientUid: client.uid
                    });
                }
            });
        }
    });

    console.log(`Mapped ${clientEmailMap.size} client email addresses for matching`);

    // Process received emails - these are FROM clients TO me
    if (receivedEmails && Array.isArray(receivedEmails)) {
        receivedEmails.forEach(email => {
            if (!email.from || !email.from.emailAddress || !email.from.emailAddress.address) return;

            // Get the sender email address
            const senderEmail = email.from.emailAddress.address.toLowerCase();

            // Check if sender is a client
            const clientInfo = clientEmailMap.get(senderEmail);
            if (clientInfo) {
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

                // Get client package
                const clientPackage = clientPackages.get(clientInfo.clientUid);
                if (clientPackage) {
                    // Add to emailsFrom for this client (since it's FROM client TO me)
                    clientPackage.emailsFrom.push(clientEmail);
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
                        // Add to emailsTo for this client (since it's TO client FROM me)
                        clientPackage.emailsTo.push(clientEmail);
                    }
                }
            });
        });
    }

    // Return all client packages that have emails
    return Array.from(clientPackages.values()).filter(
        pkg => pkg.emailsFrom.length > 0 || pkg.emailsTo.length > 0
    );
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