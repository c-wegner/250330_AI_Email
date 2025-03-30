//@ts-nocheck

// MSAL configuration
const msalConfig = {
    auth: {
        clientId: "c031ae82-3122-4b11-b996-6f17605e87e3", // Replace with your Azure AD application Client ID
        authority: "https://login.microsoftonline.com/bd9d9bc6-dc49-49db-8785-234df71f51c0",
        redirectUri: window.location.origin
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false
    }
};

// Microsoft Graph scopes for email access
const scopes = [
    "user.read",
    "mail.read"
];

// Initialize MSAL instance
const msalInstance = new msal.PublicClientApplication(msalConfig);

// Handle login/logout events
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is already logged in
    const accounts = msalInstance.getAllAccounts();
    
    if (accounts.length > 0) {
        // User is signed in
        showEmailSection();
    } else {
        // User is signed out
        showLoginSection();
    }

    // Login button event
    document.getElementById('loginButton').addEventListener('click', signIn);
});

// Sign in function
async function signIn() {
    try {
        const loginRequest = {
            scopes: scopes,
            prompt: "select_account"
        };
        
        await msalInstance.loginPopup(loginRequest);
        
        // Login successful, show email section
        showEmailSection();
    } catch (error) {
        console.error("Login error:", error);
        alert("Login failed: " + error.message);
    }
}

// Get access token for API calls
async function getAccessToken() {
    const accounts = msalInstance.getAllAccounts();
    
    if (accounts.length === 0) {
        throw new Error("No active account! Please sign in first.");
    }
    
    const silentRequest = {
        scopes: scopes,
        account: accounts[0]
    };
    
    try {
        const response = await msalInstance.acquireTokenSilent(silentRequest);
        return response.accessToken;
    } catch (error) {
        // If silent token acquisition fails, try popup
        if (error instanceof msal.InteractionRequiredAuthError) {
            const response = await msalInstance.acquireTokenPopup(silentRequest);
            return response.accessToken;
        }
        throw error;
    }
}

// UI utility functions
function showLoginSection() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('emailSection').style.display = 'none';
}

function showEmailSection() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('emailSection').style.display = 'block';
}