//@ts-nocheck

import { ClientDatabase } from '../models/clients';
import { EmailRecordClass, ClientPackageClass, ClientPackageManager } from  "../models/package"; // Assuming you have a ClientPackageClass defined in your models
import { analyzeClientEmailPackages } from './client_email_analyzer';

/**
 * Send a request to the local AI inference server
 */
async function runLocalInference(prompt, modelConfig = {}) {
    try {
        // Configure with the local server URL
        const apiUrl = 'http://localhost:8000/v1/completions';
        
        // First check if the server is up
        try {
            const statusCheck = await fetch('http://localhost:8000/status', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!statusCheck.ok) {
                throw new Error("Server status check failed");
            }
        } catch (error) {
            console.error("Local AI server not available:", error);
            throw new Error("Local AI server not available. Please start the server with 'python llama_server.py'");
        }
        
        // Send the actual request
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                max_tokens: modelConfig.max_tokens || 4096,
                temperature: modelConfig.temperature || 0.1,
                top_p: modelConfig.top_p || 0.9
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].text;
    } catch (error) {
        console.error("Error calling local inference API:", error);
        throw error;
    }
}


document.getElementById("fetchEmailsButton").addEventListener("click", async () => {
    try {
        // Show loading state
        document.getElementById("loadingSpinner").style.display = "block";
        document.getElementById("emailList").innerHTML = "<p>Loading emails and analyzing client data...</p>";
        
        const clientDB = new ClientDatabase();
        clientDB.load();

        const sentEmails = await fetchAllSentEmails();
        const receivedEmails = await fetchEmails();

        const packages = new ClientPackageManager(clientDB);
        const received = receivedEmails.map(e => new EmailRecordClass(e));
        const sent = sentEmails.map(e => new EmailRecordClass(e));
        
        // Populate the packages with emails
        packages.populateFromEmails(received);
        packages.populateToEmails(sent);
        
        const clientPackages = packages.packages;

        if (receivedEmails.length > 0) {
            const testEmail = new EmailRecordClass(receivedEmails[0]);
            console.log(testEmail);
        }
        
        // Add UI elements for AI analysis
        const analysisButton = document.createElement("button");
        analysisButton.id = "analyzeEmailsButton";
        analysisButton.textContent = "Analyze Client Emails with AI";
        analysisButton.className = "btn btn-primary mt-3";
        
        // Add the button to the UI
        const emailSection = document.getElementById("emailSection");
        if (!document.getElementById("analyzeEmailsButton")) {
            emailSection.insertBefore(analysisButton, document.getElementById("emailList"));
        }
        
        // Add event listener for analysis button
        analysisButton.addEventListener("click", async () => {
            try {
                // Update UI to show analysis is in progress
                document.getElementById("loadingSpinner").style.display = "block";
                document.getElementById("emailList").innerHTML = "<p>AI analysis in progress. This may take a few minutes...</p>";
                analysisButton.disabled = true;
                analysisButton.textContent = "Analysis in progress...";
                
                // Filter out client packages with no emails to analyze
                const packagesToAnalyze = clientPackages.filter(pkg => 
                    pkg.from_emails.length > 0 || pkg.to_emails.length > 0
                );
                
                if (packagesToAnalyze.length === 0) {
                    document.getElementById("emailList").innerHTML = 
                        "<p>No client emails found to analyze. Please make sure emails have been fetched.</p>";
                    analysisButton.disabled = false;
                    analysisButton.textContent = "Analyze Client Emails with AI";
                    document.getElementById("loadingSpinner").style.display = "none";
                    return;
                }
                
                // Run the AI analysis
                const analysisResults = await analyzeClientEmailPackages(packagesToAnalyze);
                
                // Display the results
                displayAnalysisResults(analysisResults);
                
                // Re-enable the button
                analysisButton.disabled = false;
                analysisButton.textContent = "Refresh Analysis";
                
            } catch (error) {
                console.error("Error in AI analysis:", error);
                document.getElementById("emailList").innerHTML = 
                    `<p>Error during analysis: ${error.message}</p>`;
                analysisButton.disabled = false;
                analysisButton.textContent = "Retry Analysis";
            } finally {
                document.getElementById("loadingSpinner").style.display = "none";
            }
        });
        
        // Display the client packages
        displayEmails([...receivedEmails, ...sentEmails], packages);
        
        return clientPackages;
    } catch (error) {
        console.error("Error in email processing:", error);
        document.getElementById("loadingSpinner").style.display = "none";
        document.getElementById("emailList").innerHTML = 
            `<p>Error processing emails: ${error.message}</p>`;
    } finally {
        document.getElementById("loadingSpinner").style.display = "none";
    }
});

/**
 * Display the AI analysis results in the UI
 */
function displayAnalysisResults(results) {
    const emailListElement = document.getElementById("emailList");
    
    // Create a container for the results
    const resultsContainer = document.createElement("div");
    resultsContainer.className = "analysis-results";
    
    // Add the overall summary
    const summarySection = document.createElement("div");
    summarySection.className = "overall-summary mb-5 p-4 border rounded bg-light";
    summarySection.innerHTML = `
        <h2>Practice Overview</h2>
        <div class="summary-content">
            <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(results.overall_summary)}</pre>
        </div>
    `;
    resultsContainer.appendChild(summarySection);
    
    // Add a button to toggle showing individual analyses
    const toggleButton = document.createElement("button");
    toggleButton.className = "btn btn-secondary mb-3";
    toggleButton.textContent = "Show/Hide Individual Client Analyses";
    resultsContainer.appendChild(toggleButton);
    
    // Create a container for individual analyses
    const individualAnalyses = document.createElement("div");
    individualAnalyses.className = "individual-analyses";
    individualAnalyses.style.display = "none";
    
    // Add each client analysis
    results.client_analyses.forEach((analysis, index) => {
        const clientSection = document.createElement("div");
        clientSection.className = "client-analysis mb-4 p-3 border rounded";
        
        // Determine if there are urgent tasks for highlighting
        const hasUrgentTasks = analysis.analysis.toLowerCase().includes("urgency: high") ||
                               analysis.analysis.toLowerCase().includes("high urgency");
        
        // Add highlight class if urgent
        if (hasUrgentTasks) {
            clientSection.classList.add("border-danger");
        }
        
        clientSection.innerHTML = `
            <h3>${escapeHtml(analysis.client_name)}</h3>
            <div class="analysis-content">
                <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(analysis.analysis)}</pre>
            </div>
        `;
        individualAnalyses.appendChild(clientSection);
    });
    
    resultsContainer.appendChild(individualAnalyses);
    
    // Add toggle functionality
    toggleButton.addEventListener("click", () => {
        individualAnalyses.style.display = 
            individualAnalyses.style.display === "none" ? "block" : "none";
    });
    
    // Clear previous content and add the results
    emailListElement.innerHTML = "";
    emailListElement.appendChild(resultsContainer);
    
    // Add export functionality
    const exportButton = document.createElement("button");
    exportButton.className = "btn btn-success mt-3";
    exportButton.textContent = "Export Analysis to JSON";
    exportButton.addEventListener("click", () => {
        // Create download link
        const dataStr = "data:text/json;charset=utf-8," + 
            encodeURIComponent(JSON.stringify(results, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "client_analysis_" + new Date().toISOString() + ".json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
    });
    
    emailListElement.appendChild(exportButton);
}

export async function fetchEmails() {
    try {
        document.getElementById("loadingSpinner").style.display = "block";
        document.getElementById("emailList").innerHTML = "";

        const accessToken = await getAccessToken();
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const filterDate = tenDaysAgo.toISOString();

        let allEmails = [];
        let nextLink = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=receivedDateTime ge ${filterDate}&$select=subject,body,receivedDateTime,from,toRecipients,ccRecipients&$orderby=receivedDateTime DESC&$top=50`;

        while (nextLink && allEmails.length < 500) {
            const response = await fetch(nextLink, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            if (!response.ok) throw new Error(`API error: ${response.status}`);

            const data = await response.json();
            allEmails = [...allEmails, ...data.value];
            nextLink = data["@odata.nextLink"] || null;
        }

        allEmails.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));
        return allEmails;
    } catch (error) {
        console.error("Error fetching emails:", error);
        alert("Failed to fetch emails: " + error.message);
        return [];
    } finally {
        document.getElementById("loadingSpinner").style.display = "none";
    }
}

export async function fetchAllSentEmails() {
    try {
        const accessToken = await getAccessToken();
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const filterDate = tenDaysAgo.toISOString();

        const filter = `sentDateTime ge ${filterDate}`;
        let nextLink = `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$filter=${encodeURIComponent(filter)}&$select=subject,body,sentDateTime,toRecipients,ccRecipients,from&$orderby=sentDateTime DESC&$top=100`;

        let sentEmails = [];
        while (nextLink && sentEmails.length < 500) {
            const response = await fetch(nextLink, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            if (!response.ok) throw new Error(`API error: ${response.status}`);

            const data = await response.json();
            sentEmails = [...sentEmails, ...data.value];
            nextLink = data["@odata.nextLink"] || null;
        }

        return sentEmails;
    } catch (error) {
        console.error("Error fetching sent emails:", error);
        throw error;
    }
}

function stripHtml(html) {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const breakElements = doc.querySelectorAll('br, p, div, h1, h2, h3, h4, h5, h6, li');
    breakElements.forEach(el => {
        if (el.textContent.trim() && !el.closest('pre, code')) {
            if (el.tagName === 'BR') {
                el.parentNode.insertBefore(document.createTextNode('\n'), el.nextSibling);
            } else {
                el.insertAdjacentText('afterend', '\n');
            }
        }
    });

    let text = doc.body.textContent || "";
    text = text.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    text = text.replace(/\s+/g, ' ').trim();
    text = text.replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n');
    return text;
}

function displayEmails(emails, packageManager = null) {
    const emailListElement = document.getElementById("emailList");

    if (emails.length === 0) {
        emailListElement.innerHTML = "<p>No emails found.</p>";
        return;
    }

    if (!packageManager) {
        const clientDB = new ClientDatabase();
        clientDB.load();
        packageManager = new ClientPackageManager(clientDB);
        
        const emailRecords = emails.map(email => new EmailRecordClass(email));
        packageManager.populateFromEmails(emailRecords);
        packageManager.poprulateToEmails(emailRecords);
    }

    const clientPackages = packageManager.packages.filter(pkg =>
        pkg.from_emails.length > 0 || pkg.to_emails.length > 0
    );

    let packagesHtml = "";

    if (clientPackages.length > 0) {
        packagesHtml += `<div>Found ${clientPackages.length} clients with email activity</div>`;
        clientPackages.forEach((pkg, index) => {
            packagesHtml += `
            <div>
                <h3>Client Package ${index + 1}: ${escapeHtml(pkg.client_name)} (${escapeHtml(pkg.client_primary_email)})</h3>
                <div>
                    <p>Emails From Client: ${pkg.from_emails.length}</p>
                    <ul>`;
            if (pkg.from_emails.length > 0) {
                pkg.from_emails.forEach(email => {
                    packagesHtml += `<li>${escapeHtml(email.subject)} (${new Date(email.dateReceived).toLocaleDateString()})</li>`;
                });
            } else {
                packagesHtml += `<li>No emails from client</li>`;
            }
            packagesHtml += `</ul></div>
                <div><p>Emails To Client: ${pkg.to_emails.length}</p><ul>`;
            if (pkg.to_emails.length > 0) {
                pkg.to_emails.forEach(email => {
                    const emailDate = email.dateSent || email.dateReceived;
                    packagesHtml += `<li>${escapeHtml(email.subject)} (${new Date(emailDate).toLocaleDateString()})</li>`;
                });
            } else {
                packagesHtml += `<li>No emails to client</li>`;
            }
            packagesHtml += `</ul></div></div><hr>`;
        });
    } else {
        packagesHtml = "<p>No client email packages found.</p>";
    }

    emailListElement.innerHTML = packagesHtml;
}


function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}