//@ts-nocheck
//models/client.ts

export interface IEmail{
    address: string; // The email address
    name?: string; // The name associated with the email address
    role: string; // email account holder role (position, title, relationship to the client, etc.)
    principal: boolean; // email belongs to the client (true) or to a representative (false)
    primary: boolean; // this is the primary email address for the client
}

const getUID = (clients:ClientClass[]): string => {
    let generatedUID = (Math.random() * 1000000).toFixed(36); // Generate a random UID
    // Ensure the generated UID is unique within the existing clients
    while (clients.some(client => client.uid === generatedUID)) {
        generatedUID = (Math.random() * 1000000).toFixed(36); // Regenerate if UID already exists
    }
    return generatedUID; // Return the unique UID
}


export class ClientClass{
    uid: string;
    name: string;
    file_as: string;
    emails: IEmail[]; // Array of email addresses associated with the client
    phone: string;
    description: string;
    created_at: Date;
    updated_at: Date;
    status: string; // status of the client (active, inactive, etc.)
    referal_source: string; // how the client was referred (e.g., website, word of mouth, etc.)

    constructor(data={}) {
        this.emails = []; // Initialize emails array
        
        // Assign all properties directly without hasOwnProperty check
        Object.assign(this, data);
    }

    getPrimaryEmail(): IEmail | undefined {
        return this.emails.find(email => email.primary);
    }

    setPrimaryEmail(emailAddress: string):void {
        // Set the primary email based on the provided email address
        for (let email of this.emails) {
            if (email.address === emailAddress) {
                email.primary = true; // Set this email as primary
            } else {
                email.primary = false; // Set all other emails as non-primary
            }
        }
    }
    
    // Method to get emails as text for textarea
    getEmailsAsText(): string {
        if (!this.emails || !Array.isArray(this.emails)) {
            return '';
        }
        
        return this.emails.map(email => {
            const parts = [email.address];
            if (email.name) parts.push(`name: ${email.name}`);
            parts.push(`role: ${email.role}`);
            parts.push(`principal: ${email.principal}`);
            parts.push(`primary: ${email.primary}`);
            return parts.join(', ');
        }).join('\n');
    }
    
    // Method to set emails from textarea text
    setEmailsFromText(text: string): void {
        const lines = text.split('\n').filter(line => line.trim());
        this.emails = [];
        
        lines.forEach(line => {
            const parts = line.split(',').map(p => p.trim());
            const email: IEmail = {
                address: parts[0],
                role: 'Contact',
                principal: false,
                primary: false
            };
            
            // Parse additional properties
            parts.slice(1).forEach(part => {
                const [key, value] = part.split(':').map(p => p.trim());
                if (key === 'name') email.name = value;
                if (key === 'role') email.role = value;
                if (key === 'principal') email.principal = value === 'true';
                if (key === 'primary') email.primary = value === 'true';
            });
            
            this.emails.push(email);
        });
        
        // Ensure at least one email is primary
        if (this.emails.length > 0 && !this.emails.some(e => e.primary)) {
            this.emails[0].primary = true;
        }
    }
}

export class ClientDatabase{
    clients: ClientClass[] = []; // Array of clients
    
    constructor(data={}){
        this.clients = []; // Initialize the clients array
        if (data && Array.isArray(data)) {
            for (let clientData of data) {
                // Create a new ClientClass instance for each client data object
                this.clients.push(new ClientClass(clientData));
            }
        }
    }

    addClient(clientData: any): ClientClass {
        // Add a new client to the clients array
        const newClient = new ClientClass(clientData);
        newClient.created_at = new Date(); // Set the created_at date for the new client
        newClient.updated_at = new Date(); // Set the updated_at date for the new client
        newClient.uid = getUID(this.clients); // Generate a unique UID for the new client
        this.clients.push(newClient);
        this.clients.sort((a, b) => a.file_as.localeCompare(b.file_as)); // Sort clients alphabetically by name after adding
        this.save(); // Save changes
        return newClient; // Return the new client
    }

    updateClient(client: ClientClass): void {
        // Update an existing client in the clients array
        const index = this.clients.findIndex(c => c.uid === client.uid);
        if (index !== -1) {
            client.updated_at = new Date(); // Update the updated_at date for the client
            this.clients[index] = client; // Update the client at the found index
            this.clients.sort((a, b) => a.file_as.localeCompare(b.file_as)); // Sort clients alphabetically by name after updating
            this.save(); // Save changes
        } else {
            console.warn(`Client with uid ${client.uid} not found. Cannot update.`);
        }
    }
    
    // Get a client by UID
    getClient(uid: string): ClientClass | null {
        return this.clients.find(client => client.uid === uid) || null;
    }
    
    getClientBook(): void {
        try {
            const clientsData = localStorage.getItem('clientBook');
            if (clientsData) {
                const parsedData = JSON.parse(clientsData);
                this.clients = parsedData.map((clientData) => {
                    // Create a copy of the data with proper Date objects
                    const processedData = {...clientData};
                    if (processedData.created_at) {
                        processedData.created_at = new Date(processedData.created_at);
                    }
                    if (processedData.updated_at) {
                        processedData.updated_at = new Date(processedData.updated_at);
                    }
                    return new ClientClass(processedData);
                });
            }
        } catch (error) {
            console.error('Error loading clients:', error);
            this.clients = [];
        }
    }
    // Render clients as HTML for the client list
    renderClientList(): string {
        if (this.clients.length === 0) {
            return '<div class="no-clients">No clients found</div>';
        }
        return this.clients.map((client,i) => {
            const className = i % 2 === 0 ? 'even-row' : 'odd-row'; // Alternate row colors
            return `
                <div class="client-row ${className}" data-uid="${client.uid}">
                    <div class="client-name">${client.file_as}</div>
                </div>
            `;
        }).join('');
    }

    save(): void {
        //code to save the client book to localStorage
        try {
            localStorage.setItem('clientBook', JSON.stringify(this.clients));
        } catch (error) {
            console.error('Error saving clients:', error);
        }
    }

    load(): void {
        // Alias for getClientBook to maintain compatibility
        this.getClientBook();
        console.log(this.clients[1])
    }
}