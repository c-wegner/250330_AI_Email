import { ClientClass, ClientDatabase } from "../models/client";

// Interface for email address with name
interface IEmailAddress {
    email: string;
    name: string;
}

// Class representing a client email
export class ClientEmailClass {
    id: string;
    subject: string;
    from: IEmailAddress;
    toRecipients: IEmailAddress[] = [];
    ccRecipients: IEmailAddress[] = [];
    bccRecipients: IEmailAddress[] = [];
    body: string;
    dateSent?: Date;
    dateReceived?: Date;

    constructor(data: Partial<ClientEmailClass> = {}) {
        Object.assign(this, data);
    }
}

// Class representing a client's email package
export class ClientPackageClass {
    principalName: string;
    principalEmail: string;
    packageId: string;
    emailsFrom: ClientEmailClass[] = [];
    emailsTo: ClientEmailClass[] = [];
    allClientEmails: string[] = [];

    constructor(client: ClientClass) {
        this.packageId = client.uid;
        this.allClientEmails = [...client.emails];

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
 * @returns Array of ClientPackageClass objects with email activity
 */
export function processClientEmails(sentEmails: any[], receivedEmails: any[], clientDB: ClientDatabase): ClientPackageClass[] {
    // Create maps for quick lookups
    const clientEmailMap = new Map<string, { clientUid: string }>();
    const clientPackages = new Map<string, ClientPackageClass>();
    
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
    if (receivedEmails && Array.isArray(receivedEmails)) {
        receivedEmails.forEach(email => {
            if (!email.from?.emailAddress?.address) return;
            
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
                            (senderEmail.includes(clientEmail.toLowerCase()) || 
                            clientEmail.toLowerCase().includes(senderEmail))) {
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
                if (!recipient.emailAddress?.address) return;
                
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
    
    // Return only packages with email activity
    return Array.from(clientPackages.values()).filter(
        pkg => pkg.emailsFrom.length > 0 || pkg.emailsTo.length > 0
    );
}

// Function to initialize email processing event listener
export function initializeEmailProcessing() {
    console.log("Initializing email processing...");
        document.addEventListener("DOMContentLoaded", () => {
        // Fetch emails button event
        const fetchEmailsButton = document.getElementById("fetchEmailsButton");
        if (fetchEmailsButton) {
            fetchEmailsButton.addEventListener("click", async () => {
                try {
                    // Initialize ClientDatabase
                    const clientDB = new ClientDatabase();
                    clientDB.load();
                
                    // Get both sent and received emails
                    const sentEmails = await fetchAllSentEmails();
                    const receivedEmails = await fetchEmails();

                    // Process emails into client packages
                    const clientPackages = processClientEmails(sentEmails, receivedEmails, clientDB);

                    console.log("Processed Client Packages:", clientPackages);
                    return clientPackages;
                } catch (error) {
                    console.error("Error in email processing:", error);
                    throw error;
                }
            });
        }
    });
}