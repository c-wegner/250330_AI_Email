//@ts-nocheck

import { ClientDatabase } from '../models/clients';
import { EmailRecordClass, ClientPackageClass, ClientPackageManager } from  "../models/package"; // Assuming you have a ClientPackageClass defined in your models
import { analyzeClientEmailPackages } from './client_email_analyzer';


// Add these functions at the top of your email.js/email.ts file

// Email analyzer functions 
function cleanHtmlContent(html) {
    if (!html) return '';
    
    // Basic HTML stripping
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

// express_server.js - Complete server with email analysis endpoint

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cors = require('cors');
const bodyParser = require('body-parser');

// Configuration
const LLAMA_CLI_PATH = "/home/cwegn/llama.cpp/build/bin/llama-cli";
const MODEL_PATH = "/home/cwegn/fresh_gpu_setup/mistral-7b-instruct-v0.2.Q4_0.gguf";
const PORT = 3000;
const MAX_TOKENS = 4096;

// Create Express app
const app = express();

// Enable CORS and increase payload size limits
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the current directory
app.use(express.static('.'));

// Track if model is loaded
let modelLoaded = false;

// Initialize the model on startup
function initializeModel() {
    console.log("Loading model on startup...");
    
    const testPrompt = "Hello, this is a GPU test.";
    const args = [
        '--model', MODEL_PATH,
        '--prompt', testPrompt,
        '--n-predict', '10',
        '--n-gpu-layers', '-1'
    ];
    
    const llamaProcess = spawn(LLAMA_CLI_PATH, args);
    
    llamaProcess.stderr.on('data', (data) => {
        console.log(`GPU stderr: ${data}`);
    });
    
    llamaProcess.stdout.on('data', (data) => {
        console.log(`Output: ${data}`);
    });
    
    llamaProcess.on('close', (code) => {
        if (code === 0) {
            console.log("✅ Model loaded successfully");
            modelLoaded = true;
        } else {
            console.error(`❌ Model loading failed with code ${code}`);
        }
    });
}

// Email analysis endpoint
app.post('/api/analyze-emails', async (req, res) => {
    try {
        if (!modelLoaded) {
            return res.status(503).json({ 
                error: 'Model not loaded yet, please try again in a moment' 
            });
        }
        
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        console.log(`Received analysis request (${prompt.length} chars)`);
        
        // Create temp file for the prompt
        const promptFile = path.join(os.tmpdir(), `email_prompt_${Date.now()}.txt`);
        fs.writeFileSync(promptFile, prompt);
        
        // Parameters for email analysis
        const args = [
            '--model', MODEL_PATH,
            '--file', promptFile,
            '--n-predict', MAX_TOKENS.toString(),
            '--ctx-size', '8192',
            '--n-gpu-layers', '-1',
            '--temp', '0.1',
            '--top-p', '0.9',
            '--repeat-penalty', '1.2',
            '--no-chat',
            '--silent-prompt'
        ];
        
        console.log(`Running analysis...`);
        const startTime = Date.now();
        
        // Spawn the llama-cli process
        const llamaProcess = spawn(LLAMA_CLI_PATH, args);
        
        let resultText = '';
        let errorText = '';
        
        llamaProcess.stdout.on('data', (data) => {
            resultText += data.toString();
        });
        
        llamaProcess.stderr.on('data', (data) => {
            errorText += data.toString();
        });
        
        llamaProcess.on('close', (code) => {
            // Clean up temp file
            try {
                fs.unlinkSync(promptFile);
            } catch (err) {
                console.error(`Error cleaning up: ${err}`);
            }
            
            const analysisTime = (Date.now() - startTime) / 1000;
            
            if (code === 0) {
                console.log(`Analysis completed in ${analysisTime.toFixed(2)}s`);
                
                res.json({
                    analysis: resultText,
                    analysisTime,
                    status: 'success'
                });
            } else {
                console.error(`Analysis failed with code ${code}`);
                console.error(`Error: ${errorText}`);
                
                res.status(500).json({
                    error: 'Analysis failed',
                    details: errorText,
                    status: 'error'
                });
            }
        });
        
    } catch (error) {
        console.error(`Error in analysis endpoint: ${error}`);
        res.status(500).json({ 
            error: error.message,
            status: 'error' 
        });
    }
});

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        modelLoaded,
        modelPath: MODEL_PATH,
        serverTime: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Using llama-cli: ${LLAMA_CLI_PATH}`);
    console.log(`Using model: ${MODEL_PATH}`);
    
    // Initialize model on startup
    initializeModel();
});

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

// Now modify your original event handler to use these functions directly
document.getElementById("fetchEmailsButton").addEventListener("click", async () => {
    try {
        const clientDB = new ClientDatabase();
        clientDB.load();

        const sentEmails = await fetchAllSentEmails();
        const receivedEmails = await fetchEmails();

        const packages = new ClientPackageManager(clientDB);
        const received = receivedEmails.map(e => new EmailRecordClass(e));
        const sent = sentEmails.map(e => new EmailRecordClass(e));
        
        // Use the corrected method name and new method to populate all emails at once
        packages.populateFromEmails(received);
        packages.populateToEmails(sent);

        const clientPackages = packages.packages;

        if (receivedEmails.length > 0) {
            const testEmail = new EmailRecordClass(receivedEmails[0]);
            console.log(testEmail);
        }
        
        // Add AI analysis button
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
                
                // Check if the server is running
                try {
                    const statusResponse = await fetch('http://localhost:8000/status');
                    if (!statusResponse.ok) {
                        throw new Error("Server not available");
                    }
                    const statusData = await statusResponse.json();
                    console.log("AI server status:", statusData);
                } catch (error) {
                    document.getElementById("emailList").innerHTML = `
                        <div class="alert alert-danger">
                            <h4>AI Server Not Running</h4>
                            <p>The local AI server is not available. Please start it with:</p>
                            <pre>python llama_server.py</pre>
                            <p>Make sure you've configured the correct paths in the server script!</p>
                        </div>
                    `;
                    analysisButton.disabled = false;
                    analysisButton.textContent = "Retry Analysis";
                    document.getElementById("loadingSpinner").style.display = "none";
                    return;
                }
                
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
    }
});


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

// Main event handler
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
                
                // Check if the server is running
                try {
                    const statusResponse = await fetch('http://localhost:8000/status');
                    if (!statusResponse.ok) {
                        throw new Error("Server not available");
                    }
                    const statusData = await statusResponse.json();
                    console.log("AI server status:", statusData);
                } catch (error) {
                    document.getElementById("emailList").innerHTML = `
                        <div class="alert alert-danger">
                            <h4>AI Server Not Running</h4>
                            <p>The local AI server is not available. Please start it with:</p>
                            <pre>python llama_server.py</pre>
                            <p>Make sure you've configured the correct paths in the server script!</p>
                        </div>
                    `;
                    analysisButton.disabled = false;
                    analysisButton.textContent = "Retry Analysis";
                    document.getElementById("loadingSpinner").style.display = "none";
                    return;
                }
                
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