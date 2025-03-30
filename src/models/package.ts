import { ClientClass, ClientDatabase } from "./clients"; // Assuming you have a ClientClass defined in your models


export class EmailRecordClass {
    uid: string;
    to: string[];
    from: string;
    from_name: string;
    subject: string;
    body: string;
    dateReceived: Date;
    dateSent: Date | null;

    constructor(mailObj: any) {
        this.uid = mailObj.id || '';

        // Normalize and collect 'to' recipients
        this.to = Array.isArray(mailObj.toRecipients)
            ? mailObj.toRecipients
                  .map((r: any) => r.emailAddress?.address?.toLowerCase())
                  .filter(Boolean)
            : [];

        // Normalize 'from' sender
        this.from = mailObj.from?.emailAddress?.address?.toLowerCase() || '';
        this.from_name = mailObj.from?.emailAddress?.name || '';

        this.subject = mailObj.subject || '';

        // Extract body content
        if (mailObj.body && typeof mailObj.body === 'object') {
            this.body = mailObj.body.content || '';
        } else {
            this.body = typeof mailObj.body === 'string' ? mailObj.body : '';
        }

        // Safely parse dateReceived
        this.dateReceived = (() => {
            try {
                return mailObj.receivedDateTime ? new Date(mailObj.receivedDateTime) : new Date();
            } catch {
                return new Date();
            }
        })();

        // Safely parse dateSent
        this.dateSent = (() => {
            try {
                return mailObj.sentDateTime ? new Date(mailObj.sentDateTime) : null;
            } catch {
                return null;
            }
        })();
    }
}

// this represents a client and all relevant emails to and from that client and related parties
export class ClientPackageClass {
    client_name: string;
    client_file_as: string; // File as name for the client
    client_Uid: string; // Unique identifier for the client
    client_primary_email: string;
    client_related_emails: string[];
    from_emails: EmailRecordClass[]; // Emails from client and related emails
    to_emails: EmailRecordClass[]; // Emails sent to the client and related emails

    constructor(client: ClientClass) {
        this.client_name = client.name || '';
        this.client_file_as = client.file_as || '';
        this.client_Uid = client.uid || ''; // Unique identifier for the client
        this.client_primary_email = client.primary_email?.toLowerCase() || '';
        this.client_related_emails = (client.emails || []).map(e => e.toLowerCase());
        this.from_emails = []; // Initialize from_emails array
        this.to_emails = []; // Initialize to_emails array
        if (this.client_name.toLocaleLowerCase().includes('lund')) {
            console.log(`Client Name: ${this.client_name}`);
        }
    }

    // Helper method to get all emails (both to and from)
    getAllEmails(): EmailRecordClass[] {
        return [...this.from_emails, ...this.to_emails];
    }

    // Method to sort emails by date
    sortEmailsByDate(): void {
        const sortFn = (a: EmailRecordClass, b: EmailRecordClass) =>
            b.dateReceived.getTime() - a.dateReceived.getTime();

        this.from_emails.sort(sortFn);
        this.to_emails.sort(sortFn);
    }
}

export class ClientPackageManager {
    packages: ClientPackageClass[]; // Array of client packages
    private emailIndex: Map<string, EmailRecordClass>; // Index for quick email lookup

    constructor(book: ClientDatabase) {
        this.packages = []; // Initialize the packages array
        this.emailIndex = new Map(); // Initialize email index
        
        book.clients.forEach(client => {
            // Create a new ClientPackageClass for each client
            const clientPackage = new ClientPackageClass(client);
            this.packages.push(clientPackage); // Add the package to the array
        });
    }

    // Add emails to the index for quick lookup
    indexEmails(emails: EmailRecordClass[]): void {
        emails.forEach(email => {
            this.emailIndex.set(email.uid, email);
        });
    }

    populateFromEmails(emails: EmailRecordClass[]): void {
        // Index emails if not already indexed
        this.indexEmails(emails);
        
        // Populate from_emails for each client package based on the provided emails
        this.packages.forEach(pkg => {
            // Filter emails that are from the client or related emails
            // Make sure to lowercase email addresses for comparison
            const filteredEmails = emails.filter(email => {
                const fromEmail = email.from.toLowerCase();
                return fromEmail === pkg.client_primary_email || 
                       pkg.client_related_emails.includes(fromEmail);
            });
            
            pkg.from_emails.push(...filteredEmails); // Add filtered emails to from_emails
        });
    }

    populateToEmails(emails: EmailRecordClass[]): void {
        // Index emails if not already indexed
        this.indexEmails(emails);
        
        // Populate to_emails for each client package based on the provided emails
        this.packages.forEach(pkg => {
            // Filter emails that are sent to the client or related emails
            const filteredEmails = emails.filter(email => 
                Array.isArray(email.to) && (
                    (pkg.client_primary_email && email.to.some(to => 
                        to.toLowerCase() === pkg.client_primary_email)) ||
                    pkg.client_related_emails.some(relatedEmail => 
                        email.to.some(to => to.toLowerCase() === relatedEmail))
                )
            );
            
            pkg.to_emails.push(...filteredEmails); // Add filtered emails to to_emails
        });
    }

    // Method to populate both from and to emails at once
    populateAllEmails(emails: EmailRecordClass[]): void {
        this.populateFromEmails(emails);
        this.populateToEmails(emails);
        
        // Sort all emails by date
        this.packages.forEach(pkg => pkg.sortEmailsByDate());
    }

    // Find a client package by email address
    findPackageByEmail(email: string): ClientPackageClass | undefined {
        const lowerEmail = email.toLowerCase();
        return this.packages.find(pkg => 
            pkg.client_primary_email === lowerEmail || 
            pkg.client_related_emails.includes(lowerEmail)
        );
    }

    // Find a client package by client UID
    findPackageByClientUid(uid: string): ClientPackageClass | undefined {
        return this.packages.find(pkg => pkg.client_Uid === uid);
    }
}