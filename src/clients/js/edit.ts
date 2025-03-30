//-------------------------------------------------------
import { ClientClass, ClientDatabase } from '../../models/clients'; 

// Initialize the client database
const clientDB = new ClientDatabase();

// UI Elements
const clientList = document.getElementById('client_list') as HTMLDivElement;
const clientNameInput = document.getElementById('client_name') as HTMLInputElement;
const clientFileAsInput = document.getElementById('client_file_as') as HTMLInputElement;
const clientStatusSelect = document.getElementById('client_status') as HTMLSelectElement;
const clientPrimaryContactInput = document.getElementById('client_primary_contact') as HTMLInputElement;
const clientPrimaryEmailInput = document.getElementById('primary_email') as HTMLInputElement;
const clientEmailsTextarea = document.getElementById('client_emails') as HTMLTextAreaElement;
const clientDescriptionTextarea = document.getElementById('client_description') as HTMLTextAreaElement;

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
    clearForm();

    if (editButton) {
        editButton.style.color = "transparent";
    }
}

// Load clients from database
function loadClients() {
    clientDB.getClientBook();
}

// Render the client list
function renderClientList() {
    if (clientList) {
        clientList.innerHTML = clientDB.renderClientList();
    }
}

// Setup event listeners
function setupEventListeners() {
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

    editButton?.addEventListener('click', () => {
        if (currentClient) {
            startEditing();
        }
    });

    saveButton?.addEventListener('click', () => {
        saveClient();
    });

    clearButton?.addEventListener('click', () => {
        clearForm();
    });
}

// Select a client
function selectClient(uid: string) {
    const allRows = document.querySelectorAll('.client-row');
    allRows.forEach(row => row.classList.remove('selected'));

    const selectedRow = document.querySelector(`.client-row[data-uid="${uid}"]`);
    selectedRow?.classList.add('selected');

    currentClient = clientDB.getClient(uid);

    if (currentClient) {
        clientNameInput.value = currentClient.name || '';
        clientFileAsInput.value = currentClient.file_as || '';
        clientStatusSelect.value = currentClient.status || 'active';
        clientPrimaryContactInput.value = currentClient.primary_contact || '';
        clientPrimaryEmailInput.value = currentClient.primary_email || '';
        clientEmailsTextarea.value = Array.isArray(currentClient.emails) ? currentClient.emails.join('\n') : '';
        clientDescriptionTextarea.value = currentClient.description || '';

        setFormDisabled(true);
        isEditing = false;

        if (editButton) {
            editButton.style.color = "#0078d4";
        }

        saveButton.textContent = "Update Client";
    }
}

// Start editing mode
function startEditing() {
    isEditing = true;
    setFormDisabled(false);
}

// Save client changes
function saveClient() {
    const clientData = {
        name: clientNameInput.value.trim(),
        file_as: clientFileAsInput.value.trim() || clientNameInput.value.trim(),
        status: clientStatusSelect.value,
        primary_contact: clientPrimaryContactInput.value.trim(),
        primary_email: clientPrimaryEmailInput.value.trim(),
        description: clientDescriptionTextarea.value.trim()
    };

    if (!clientData.name) {
        alert("Client name is required");
        return;
    }

    if (currentClient) {
        Object.assign(currentClient, clientData);

        const emailsText = clientEmailsTextarea.value.trim();
        currentClient.emails = emailsText
            ? emailsText.split('\n').map(email => email.trim()).filter(email => email)
            : [];

        currentClient.updated_at = new Date();
        clientDB.updateClient(currentClient);
    } else {
        const emailsText = clientEmailsTextarea.value.trim();
        clientData['emails'] = emailsText
            ? emailsText.split('\n').map(email => email.trim()).filter(email => email)
            : [];

        currentClient = clientDB.addClient(clientData);
    }

    renderClientList();
    clearForm();

    if (editButton) {
        editButton.style.color = "transparent";
    }
}

// Clear the form
function clearForm() {
    currentClient = null;

    clientNameInput.value = '';
    clientFileAsInput.value = '';
    clientStatusSelect.value = 'active';
    clientPrimaryContactInput.value = '';
    clientPrimaryEmailInput.value = '';
    clientEmailsTextarea.value = '';
    clientDescriptionTextarea.value = '';

    const allRows = document.querySelectorAll('.client-row');
    allRows.forEach(row => row.classList.remove('selected'));

    setFormDisabled(false);
    isEditing = false;

    if (editButton) {
        editButton.style.color = "transparent";
    }

    saveButton.textContent = "Save Client";
}

// Enable or disable form fields
function setFormDisabled(disabled: boolean) {
    [
        clientNameInput,
        clientFileAsInput,
        clientStatusSelect,
        clientPrimaryContactInput,
        clientPrimaryEmailInput,
        clientEmailsTextarea,
        clientDescriptionTextarea
    ].forEach(element => {
        element.disabled = disabled;
    });
}

document.addEventListener('DOMContentLoaded', init);
