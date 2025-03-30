// test_gpu.js
const { spawn } = require('child_process');

// Configuration - your exact paths
const LLAMA_CLI_PATH = "/home/cwegn/llama.cpp/build/bin/llama-cli";
const MODEL_PATH = "/home/cwegn/fresh_gpu_setup/mistral-7b-instruct-v0.2.Q4_0.gguf";

// Run a simple inference with full logging
console.log("Starting GPU test...");

// Use these parameters to force GPU usage
const args = [
  '--model', MODEL_PATH,
  '--prompt', 'Write a detailed analysis of client emails.',
  '--n-predict', '1000',
  '--n-gpu-layers', '-1',
  '--ctx-size', '8192',
  '--verbose-prompt'
];

console.log(`Running command: ${LLAMA_CLI_PATH} ${args.join(' ')}`);

// Start another process to monitor GPU
const monitorProcess = spawn('nvidia-smi', ['--query-compute-apps=pid,process_name,used_gpu_memory', '--format=csv', '--loop=1']);

monitorProcess.stdout.on('data', (data) => {
  console.log(`GPU Monitor: ${data}`);
});

// Run the main llama process
const llamaProcess = spawn(LLAMA_CLI_PATH, args);

llamaProcess.stdout.on('data', (data) => {
  // Just log first few characters to avoid clutter
  const text = data.toString().substring(0, 100);
  console.log(`Output: ${text}...`);
});

llamaProcess.stderr.on('data', (data) => {
  console.log(`GPU Info: ${data}`);
});

llamaProcess.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
  // Kill the monitor process
  monitorProcess.kill();
});