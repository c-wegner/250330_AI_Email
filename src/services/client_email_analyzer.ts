// client_email_analyzer.ts

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { ClientPackageClass } from './models/email_packages';

// Constants
const MODEL_PATH = path.join(process.env.HOME || '', 'llama.cpp/models/nous-hermes/Nous-Hermes-2-Mistral-7B-DPO.Q4_K_S.gguf');
const LLAMA_CLI_PATH = path.join(process.env.HOME || '', 'llama.cpp/build/bin/llama-cli');
const TEMP_DIR = path.join(process.env.HOME || '', 'client_analysis_temp');

// Make sure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Utility to strip HTML and clean up text content
 */
function cleanHtmlContent(html: string): string {
    if (!html) return '';
    
    // Basic HTML stripping
    let text = html.replace(/<[^>]*>/g, ' ');
    
    // Handle special characters
    text = text.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    
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
function deduplicateEmailContent(emails: any[]): any[] {
    const cleanedEmails = [...emails];
    const contentHashes = new Map<string, number>();
    
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
            const originalIndex = contentHashes.get(significantContent)!;
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
function prepareEmailsForAi(clientPackage: ClientPackageClass): string {
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
function generatePrompt(emailsText: string): string {
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
 * Run the local LLM inference using llama.cpp
 */
async function runLocalInference(prompt: string): Promise<string> {
    const inputFile = path.join(TEMP_DIR, `prompt_${Date.now()}.txt`);
    const outputFile = path.join(TEMP_DIR, `response_${Date.now()}.txt`);
    
    // Write prompt to file
    fs.writeFileSync(inputFile, prompt, 'utf8');
    
    return new Promise((resolve, reject) => {
        // Run llama-cli with appropriate settings for RTX 5090
        const llamaProcess = spawn(LLAMA_CLI_PATH, [
            '--model', MODEL_PATH,
            '--file', inputFile,
            '--n-predict', '4096',
            '--ctx-size', '8192',
            '--n-gpu-layers', '-1', // Use all compatible layers on GPU
            '--temp', '0.1',        // Low temperature for more deterministic output
            '--top-p', '0.9',
            '--repeat-penalty', '1.2',
            '--no-chat',            // Raw prompt mode
            '--silent-prompt'       // Don't echo prompt
        ]);
        
        let output = '';
        
        llamaProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            // Optional: log to console for monitoring
            console.log(chunk);
        });
        
        llamaProcess.stderr.on('data', (data) => {
            console.error(`LLM Error: ${data}`);
        });
        
        llamaProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`LLM process exited with code ${code}`));
                return;
            }
            
            // Write output to file for debugging and save
            fs.writeFileSync(outputFile, output, 'utf8');
            resolve(output);
        });
    });
}

/**
 * Process a single client package
 */
async function processClientPackage(clientPackage: ClientPackageClass): Promise<any> {
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
 * Generate a summary of all client analyses
 */
async function generateOverallSummary(clientAnalyses: any[]): Promise<string> {
    // Extract tasks and relevant information from all analyses
    const tasksOverview = clientAnalyses.map(analysis => {
        return `
CLIENT: ${analysis.client_name}

${analysis.analysis}

---------------------
`;
    }).join('\n');
    
    const summaryPrompt = `
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
    
    // Run the summary analysis
    console.log("Generating overall practice summary...");
    return await runLocalInference(summaryPrompt);
}

/**
 * Main function to analyze all client packages
 */
export async function analyzeClientEmailPackages(clientPackages: ClientPackageClass[]): Promise<any> {
    try {
        console.log(`Starting analysis of ${clientPackages.length} client packages`);
        
        // Process each client package
        const clientAnalyses = [];
        for (const clientPackage of clientPackages) {
            const analysis = await processClientPackage(clientPackage);
            clientAnalyses.push(analysis);
        }
        
        // Generate overall summary
        const overallSummary = await generateOverallSummary(clientAnalyses);
        
        // Return all analyses plus summary
        return {
            client_analyses: clientAnalyses,
            overall_summary: overallSummary
        };
    } catch (error) {
        console.error("Error analyzing client emails:", error);
        throw error;
    } finally {
        // Cleanup temp files
        console.log("Cleaning up temporary files...");
        try {
            const tempFiles = fs.readdirSync(TEMP_DIR);
            tempFiles.forEach(file => {
                if (file.startsWith('prompt_') || file.startsWith('response_')) {
                    fs.unlinkSync(path.join(TEMP_DIR, file));
                }
            });
        } catch (err) {
            console.error("Error cleaning up:", err);
        }
    }
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