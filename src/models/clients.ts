//@ts-nocheck
//models/clients.ts

export class ClientClass {
    uid: string;
    name: string;
    file_as: string;
    primary_contact: string;
    primary_email: string;
    emails: string[]; // Array of email addresses as strings
    phone: string;
    description: string;
    created_at: Date;
    updated_at: Date;
    status: string; // status of the client (active, inactive, etc.)

    constructor(data = {}) {
        this.emails = [];
        Object.assign(this, data);
    }

    displayRelatedEmails(): string {
        if (!this.emails || !Array.isArray(this.emails)) {
            return '';
        }
        return this.emails.join('\n');
    }

    setRelatedEmails(text:string){
        const lines = text.split('\n').filter(line => line.trim());
        this.emails = lines.map(line => line.trim());
    }

    getClientRow(rowNum = 0):string{
        const rowClass = (rowNum % 2 === 0) ? 'client-row row-even' : 'client-row row-odd';
        return `
            <div class="client-row ${rowClass}" data-uid="${this.uid}">
                <div class="client-name">${this.file_as}</div>
            </div>
        `
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
        newClient.uid = this.generateUID(); // Generate a unique UID for the new client
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
    }
    
    generateUID(): string {
        let generatedUID = (Math.random() * 1000000).toFixed(36); // Generate a random UID
        // Ensure the generated UID is unique within the existing clients
        while (this.clients.some(client => client.uid === generatedUID)) {
            generatedUID = (Math.random() * 1000000).toFixed(36); // Regenerate if UID already exists
        }
        return generatedUID; // Return the unique UID
    }
}