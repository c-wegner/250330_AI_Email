// client_email_analyzer.js - Browser version
//@ts-nocheck
/**
 * Utility to strip HTML and clean up text content
 */
function cleanHtmlContent(html) {
    if (!html) return '';
    
    // Basic HTML stripping - create a temporary DOM element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    let text = tempDiv.textContent || tempDiv.innerText || '';
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Remove common email reply patterns
    text = text.replace(/^(>+\s*.*?(\r?\n|$))+/gm, '');
    text = text.replace(/On .* wrote:(\r?\n|$)/g, '');
    
    // Remove email signatures
    text = text.replace(/(-{3,}|_{3,})(\r?\n|$)[\s\S]*$/m, '');
    
    return text;
}

/**
 * Removes duplicate content like forwarded messages and reply chains
 */
function deduplicateEmailContent(emails) {
    const cleanedEmails = [...emails];
    const contentHashes = new Map();
    
    for (let i = 0; i < cleanedEmails.length; i++) {
        const email = cleanedEmails[i];
        
        // Skip if already processed
        if (!email || email.processed) continue;
        
        // Get content for duplicate detection
        const content = cleanHtmlContent(email.body || '').toLowerCase();
        if (content.length < 20) continue; // Skip very short content
        
        // Create a fuzzy hash for similarity checking
        const contentWords = content.split(/\s+/).filter(w => w.length > 4);
        const significantContent = contentWords.slice(0, 20).join(' ');
        
        if (contentHashes.has(significantContent)) {
            // Mark the duplicate but preserve metadata
            const originalIndex = contentHashes.get(significantContent);
            const original = cleanedEmails[originalIndex];
            
            // Keep the email with more context/metadata
            if (original.subject?.length > email.subject?.length) {
                email.deduplicatedBy = originalIndex;
                email.processed = true;
            } else {
                original.deduplicatedBy = i;
                original.processed = true;
            }
        } else {
            contentHashes.set(significantContent, i);
        }
    }
    
    // Filter out emails marked as duplicates
    return cleanedEmails.filter(email => !email.deduplicatedBy);
}

/**
 * Prepare the emails for processing by cleaning and structuring
 */
function prepareEmailsForAi(clientPackage) {
    // Combine all emails from the package
    const allEmails = [...clientPackage.from_emails, ...clientPackage.to_emails];
    
    // Sort by date, newest first 
    allEmails.sort((a, b) => b.dateReceived.getTime() - a.dateReceived.getTime());
    
    // Deduplicate and clean content
    const cleanedEmails = deduplicateEmailContent(allEmails);
    
    // Format each email into a structured text
    const formattedEmails = cleanedEmails.map((email, index) => {
        const date = email.dateSent || email.dateReceived;
        const formattedDate = date.toLocaleString();
        const direction = clientPackage.from_emails.includes(email) ? 'FROM CLIENT' : 'TO CLIENT';
        const cleanBody = cleanHtmlContent(email.body);
        
        return `---EMAIL ${index + 1}---
DIRECTION: ${direction}
DATE: ${formattedDate}
FROM: ${email.from_name} <${email.from}>
TO: ${email.to.join(', ')}
SUBJECT: ${email.subject}

CONTENT:
${cleanBody}

---END EMAIL ${index + 1}---

`;
    }).join('\n');
    
    // Create client context
    const clientContext = `
CLIENT INFORMATION:
NAME: ${clientPackage.client_name}
PRIMARY EMAIL: ${clientPackage.client_primary_email}
RELATED EMAILS: ${clientPackage.client_related_emails.join(', ')}
TOTAL EMAILS: ${cleanedEmails.length}

`;

    return clientContext + formattedEmails;
}

/**
 * Generate the AI prompt with instructions
 */
function generatePrompt(emailsText) {
    return `
You are a professional legal assistant analyzing client email communications. 
Review the following emails carefully and provide a structured analysis.

${emailsText}

Based on the emails above, create a detailed analysis with the following sections:

1. GENERAL CIRCUMSTANCES
   Describe the overall situation and context of these emails.

2. CLIENT SENTIMENT
   Analyze the client's attitude toward Chris Wegner and Wegner Law PLLC.

3. PENDING TASKS AND QUESTIONS
   a) List any tasks or questions the client has requested from Chris Wegner.
   b) For each task/question, note whether Chris Wegner has addressed it based on his responses.
   c) Identify any tasks that appear incomplete or unaddressed.

4. URGENCY ASSESSMENT
   Rate the urgency of client requests (Low/Medium/High) with justification.

5. EXPECTED WORK
   Provide a narrative of what work the client is expecting from Chris.

6. RELATIONSHIP ADVICE
   [OPTIONAL] Offer suggestions on managing this client relationship effectively.

Format your response in clear sections with headings. Be specific and factual, citing evidence from the emails where appropriate. Focus on being practical rather than theoretical.
`;
}

/**
 * Generate a summary of all client analyses
 */
function generateSummaryPrompt(clientAnalyses) {
    // Extract tasks and relevant information from all analyses
    const tasksOverview = clientAnalyses.map(analysis => {
        return `
CLIENT: ${analysis.client_name}

${analysis.analysis}

---------------------
`;
    }).join('\n');
    
    return `
You are a senior legal practice manager reviewing client analyses. Review the following client analyses and provide a high-level executive summary:

${tasksOverview}

Based on these analyses, please provide:

1. OVERALL WORKLOAD ASSESSMENT
   Summarize the total number of clients with active requests and categorize them by urgency.

2. KEY PENDING TASKS
   List the most important tasks that need attention, grouped by client.

3. PRIORITY RECOMMENDATIONS
   Suggest which clients and tasks should be prioritized, with rationale.

4. RESOURCE ALLOCATION
   Recommend how to allocate time and resources across these clients.

5. RISKS AND OPPORTUNITIES
   Identify any relationship risks or business opportunities apparent from these analyses.

Format your response with clear headings and concise bullet points where appropriate.
`;
}

/**
 * Send a request to the local AI inference server


/**
 * Send a request to the local AI inference server
 */
async function runLocalInference(prompt, modelConfig = {}) {
    try {
        // Configure with the local server URL - using absolute URL
        const apiUrl = 'http://localhost:8000/v1/completions';
        
        console.log("Attempting to connect to AI server...");
        
        // First check if the server is up
        let statusCheck;
        try {
            statusCheck = await fetch('http://localhost:8000/status', {
                method: 'GET',
                mode: 'cors', // Important for cross-origin requests
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            if (!statusCheck.ok) {
                throw new Error(`Server status check failed with status: ${statusCheck.status}`);
            }
            
            const statusData = await statusCheck.json();
            console.log("AI server status:", statusData);
            
        } catch (error) {
            console.error("Local AI server not available:", error);
            throw new Error("Local AI server not available. Please ensure the server is running and accessible.");
        }
        
        // Send the actual request
        console.log("Sending inference request to AI server...");
        const response = await fetch(apiUrl, {
            method: 'POST',
            mode: 'cors', // Important for cross-origin requests
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                max_tokens: modelConfig.max_tokens || 4096,
                temperature: modelConfig.temperature || 0.1,
                top_p: modelConfig.top_p || 0.9
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Received response from AI server");
        
        if (!data.choices || !data.choices[0]) {
            throw new Error("Invalid response format from AI server");
        }
        
        return data.choices[0].text;
    } catch (error) {
        console.error("Error calling local inference API:", error);
        
        // Return a fallback response for demo/testing
        if (error.message.includes("Failed to fetch") || 
            error.message.includes("not available")) {
            return `[CONNECTION ERROR - AI server unavailable]

The AI analysis feature encountered a connection error. Please check if:

1. The Python server is running with: python llama_server.py
2. The server URL is correct: http://localhost:8000
3. There are no firewall or network restrictions blocking the connection

For demo purposes, you can continue exploring the UI, but real AI analysis requires the server to be accessible.`;
        }
        
        throw error;
    }
}
/**
 * Process a single client package
 */
async function processClientPackage(clientPackage) {
    // Prepare emails
    console.log(`Processing client: ${clientPackage.client_name}`);
    const preparedEmails = prepareEmailsForAi(clientPackage);
    
    // Generate prompt
    const prompt = generatePrompt(preparedEmails);
    
    // Run inference
    console.log(`Running analysis for client: ${clientPackage.client_name}`);
    const aiResponse = await runLocalInference(prompt);
    
    // Return structured result
    return {
        client_name: clientPackage.client_name,
        client_uid: clientPackage.client_Uid,
        analysis: aiResponse,
    };
}

/**
 * Main function to analyze all client packages
 */
async function analyzeClientEmailPackages(clientPackages) {
    try {
        console.log(`Starting analysis of ${clientPackages.length} client packages`);
        
        // Process each client package
        const clientAnalyses = [];
        for (const clientPackage of clientPackages) {
            const analysis = await processClientPackage(clientPackage);
            clientAnalyses.push(analysis);
        }
        
        // Generate overall summary
        const summaryPrompt = generateSummaryPrompt(clientAnalyses);
        const overallSummary = await runLocalInference(summaryPrompt);
        
        // Return all analyses plus summary
        return {
            client_analyses: clientAnalyses,
            overall_summary: overallSummary
        };
    } catch (error) {
        console.error("Error analyzing client emails:", error);
        throw error;
    }
}

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

// Example usage:
/*
import { ClientDatabase } from './models/clients';
import { ClientPackageManager } from './models/email_packages';

async function main() {
    const clientDB = new ClientDatabase();
    clientDB.load();
    
    const packages = new ClientPackageManager(clientDB);
    // Assuming packages are populated with emails
    
    const results = await analyzeClientEmailPackages(packages.packages);
    
    // Save results
    fs.writeFileSync('client_analyses.json', JSON.stringify(results, null, 2));
    
    console.log("Analysis complete!");
}

main().catch(console.error);
*/