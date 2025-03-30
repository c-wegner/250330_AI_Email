// express_gpu_server.js
const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Configuration
const PORT = 3000;
const LLAMA_CLI_PATH = "/home/cwegn/llama.cpp/build/bin/llama-cli";
const MODEL_PATH = "/home/cwegn/fresh_gpu_setup/mistral-7b-instruct-v0.2.Q4_0.gguf";

// Create Express app
const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('.'));

// Force-enable CUDA for llama.cpp
process.env.CUDA_VISIBLE_DEVICES = "0";
process.env.GGML_CUDA_NO_PINNED = "0";

let modelInfo = {
  loaded: false,
  lastCheck: null
};

// Test GPU with a more substantial task
function testGPU() {
  console.log("Testing GPU with model...");
  
  const testPrompt = "Write a paragraph about artificial intelligence.";
  const tempDir = os.tmpdir();
  const promptFile = path.join(tempDir, `test_prompt_${Date.now()}.txt`);
  
  fs.writeFileSync(promptFile, testPrompt);
  
  // Force GPU usage
  const args = [
    '--model', MODEL_PATH,
    '--file', promptFile,
    '--n-predict', '200',
    '--n-gpu-layers', '-1',
    '--ctx-size', '2048',
    '--temp', '0.7',
    '--repeat-penalty', '1.1',
    '--no-mmap',
    '--verbose-prompt'
  ];
  
  console.log(`Running command: ${LLAMA_CLI_PATH} ${args.join(' ')}`);
  
  const llamaProcess = spawn(LLAMA_CLI_PATH, args, {
    env: {
      ...process.env,
      CUDA_VISIBLE_DEVICES: "0"
    }
  });
  
  llamaProcess.stderr.on('data', (data) => {
    console.log(`GPU info: ${data}`);
  });
  
  llamaProcess.stdout.on('data', (data) => {
    console.log(`Output: ${data.toString().substring(0, 100)}...`);
  });
  
  llamaProcess.on('close', (code) => {
    // Clean up
    try {
      fs.unlinkSync(promptFile);
    } catch (err) {
      console.error(`Cleanup error: ${err}`);
    }
    
    if (code === 0) {
      console.log("✅ Model test completed successfully");
      modelInfo.loaded = true;
      modelInfo.lastCheck = new Date().toISOString();
    } else {
      console.error(`❌ Model test failed with code ${code}`);
    }
  });
}

// Analyze email endpoint
app.post('/api/analyze-emails', (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    console.log(`Processing analysis request (${prompt.length} chars)`);
    
    // Create temp file for input
    const tempDir = os.tmpdir();
    const promptFile = path.join(tempDir, `prompt_${Date.now()}.txt`);
    const outputFile = path.join(tempDir, `output_${Date.now()}.txt`);
    
    fs.writeFileSync(promptFile, prompt);
    
    // Generate arguments with GPU forced
    const args = [
      '--model', MODEL_PATH,
      '--file', promptFile,
      '--n-predict', '4096',
      '--ctx-size', '8192',
      '--n-gpu-layers', '-1',
      '--temp', '0.1',
      '--top-p', '0.9',
      '--repeat-penalty', '1.2',
      '--no-mmap',
      '--no-chat',
      '--silent-prompt'
    ];
    
    console.log(`Running analysis...`);
    const startTime = Date.now();
    
    // Spawn llama process
    const llamaProcess = spawn(LLAMA_CLI_PATH, args, {
      env: {
        ...process.env,
        CUDA_VISIBLE_DEVICES: "0"
      }
    });
    
    let resultText = '';
    let errorText = '';
    
    llamaProcess.stdout.on('data', (data) => {
      resultText += data.toString();
    });
    
    llamaProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorText += text;
      console.log(`llama stderr: ${text}`);
    });
    
    llamaProcess.on('close', (code) => {
      // Clean up
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
    modelLoaded: modelInfo.loaded,
    lastCheck: modelInfo.lastCheck,
    serverTime: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using llama-cli: ${LLAMA_CLI_PATH}`);
  console.log(`Using model: ${MODEL_PATH}`);
  
  // Test GPU on startup
  testGPU();
});