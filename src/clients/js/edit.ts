import { ClientClass, ClientDatabase, IEmail } from '../../models/client';

// Initialize the client database
const clientDB = new ClientDatabase();

// UI Elements
const clientList = document.getElementById('client_list') as HTMLDivElement;
const clientNameInput = document.getElementById('client_name') as HTMLInputElement;
const clientFileAsInput = document.getElementById('client_file_as') as HTMLInputElement;
const clientStatusSelect = document.getElementById('client_status') as HTMLSelectElement;
const clientEmailsTextarea = document.getElementById('client_emails') as HTMLTextAreaElement;
const clientDescriptionTextarea = document.getElementById('client_description') as HTMLTextAreaElement;
const clientReferalInput = document.getElementById('client_referal') as HTMLInputElement;

// Buttons
const editButton = document.getElementById('client_edit') as HTMLDivElement;
const clearButton = document.getElementById('client_clear') as HTMLDivElement;
const saveButton = document.getElementById('client_save') as HTMLButtonElement;

// Current client
let currentClient: ClientClass | null = null;
let isEditing = false;

// Initialize the UI
function init() {
    loadClients();
    renderClientList();
    setupEventListeners();
    
    // Start with an empty form that's enabled for new client creation
    clearForm();
    
    // Hide edit button initially
    if (editButton) {
        editButton.style.color = "transparent";
    }
}

// Load clients from database
function loadClients() {
    // This will load clients from localStorage
    clientDB.getClientBook();
}

// Render the client list
function renderClientList() {
    if (clientList) {
        clientList.innerHTML = clientDB.renderClientList();

    }
    console.log(clientDB.renderClientList())
}

// Setup event listeners
function setupEventListeners() {
    // Client selection
    clientList?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const clientRow = target.closest('.client-row') as HTMLElement;
        
        if (clientRow) {
            const uid = clientRow.dataset.uid;
            if (uid) {
                selectClient(uid);
            }
        }
    });

    // Edit button
    editButton?.addEventListener('click', () => {
        if (currentClient) {
            startEditing();
        }
    });

    // Save button
    saveButton?.addEventListener('click', () => {
        saveClient();
    });

    // Clear button
    clearButton?.addEventListener('click', () => {
        clearForm();
    });
}

// Select a client
function selectClient(uid: string) {
    console.log("Selecting client", uid);
    
    // Remove selected class from all client rows
    const allRows = document.querySelectorAll('.client-row');
    allRows.forEach(row => row.classList.remove('selected'));
    
    // Add selected class to the clicked row
    const selectedRow = document.querySelector(`.client-row[data-uid="${uid}"]`);
    selectedRow?.classList.add('selected');
    
    // Get the client from the database
    currentClient = clientDB.getClient(uid);
    
    if (currentClient) {
        // Populate the form
        clientNameInput.value = currentClient.name || '';
        clientFileAsInput.value = currentClient.file_as || '';
        clientStatusSelect.value = currentClient.status || 'active';
        clientEmailsTextarea.value = currentClient.getEmailsAsText();
        clientDescriptionTextarea.value = currentClient.description || '';
        clientReferalInput.value = currentClient.referal_source || '';
        
        // Disable form fields when a client is selected
        setFormDisabled(true);
        
        isEditing = false;
        
        // Show edit button
        if (editButton) {
            editButton.style.color = "#0078d4";
        }
        
        // Update the save button text
        saveButton.textContent = "Update Client";
    }
}

// Start editing mode
function startEditing() {
    console.log("Starting edit mode");
    isEditing = true;
    setFormDisabled(false);
}

// Save client changes
function saveClient() {
    console.log("Saving client", { currentClient, isEditing });
    
    // Create a client data object from the form
    const clientData = {
        name: clientNameInput.value.trim(),
        file_as: clientFileAsInput.value.trim() || clientNameInput.value.trim(),
        status: clientStatusSelect.value,
        description: clientDescriptionTextarea.value.trim(),
        referal_source: clientReferalInput.value.trim()
    };
    
    // Validate required fields
    if (!clientData.name) {
        alert("Client name is required");
        return;
    }
    
    if (currentClient) {
        // Update existing client
        console.log("Updating existing client", currentClient.uid);
        Object.assign(currentClient, clientData);
        currentClient.setEmailsFromText(clientEmailsTextarea.value);
        currentClient.updated_at = new Date();
        clientDB.updateClient(currentClient);
    } else {
        // Create new client
        console.log("Creating new client");
        currentClient = clientDB.addClient(clientData);
        currentClient.setEmailsFromText(clientEmailsTextarea.value);
        clientDB.updateClient(currentClient);
    }
    
    // Update UI
    renderClientList();
    
    // Clear form and reset state after save
    clearForm();
    
    // Hide edit button
    if (editButton) {
        editButton.style.color = "transparent";
    }
}

// Clear the form
function clearForm() {
    console.log("Clearing form");
    currentClient = null;
    
    // Clear form fields
    clientNameInput.value = '';
    clientFileAsInput.value = '';
    clientStatusSelect.value = 'active';
    clientEmailsTextarea.value = '';
    clientDescriptionTextarea.value = '';
    clientReferalInput.value = '';
    
    // Remove selected class from all client rows
    const allRows = document.querySelectorAll('.client-row');
    allRows.forEach(row => row.classList.remove('selected'));
    
    // Enable form for new client entry
    setFormDisabled(false);
    isEditing = false;
    
    // Hide edit button
    if (editButton) {
        editButton.style.color = "transparent";
    }
    
    // Update the save button text
    saveButton.textContent = "Save Client";
}

// Set all form fields to disabled or enabled
function setFormDisabled(disabled: boolean) {
    console.log("Setting form disabled:", disabled);
    const formElements = [
        clientNameInput,
        clientFileAsInput,
        clientStatusSelect,
        clientEmailsTextarea,
        clientDescriptionTextarea,
        clientReferalInput
    ];
    
    formElements.forEach(element => {
        element.disabled = disabled;
    });
}

// Run initialization when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);