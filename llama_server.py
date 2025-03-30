# llama_server_fixed.py - Modified to fix GPU usage

import json
import subprocess
import tempfile
import os
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# CONFIGURATION - Using your exact paths
LLAMA_CLI_PATH = "/home/cwegn/llama.cpp/build/bin/llama-cli"
MODEL_PATH = "/home/cwegn/fresh_gpu_setup/mistral-7b-instruct-v0.2.Q4_0.gguf"

# Check if the paths exist
if not os.path.exists(LLAMA_CLI_PATH):
    print(f"ERROR: llama-cli not found at {LLAMA_CLI_PATH}")
    print("Please update the LLAMA_CLI_PATH in the script")
    exit(1)

if not os.path.exists(MODEL_PATH):
    print(f"ERROR: Model not found at {MODEL_PATH}")
    print("Please update the MODEL_PATH in the script")
    exit(1)

class LlamaHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        """Set the CORS headers for all responses"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')
        self.send_header('Access-Control-Max-Age', '86400')  # 24 hours

    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests with CORS support"""
        try:
            # Simple status endpoint
            if self.path == '/status':
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                
                # Check GPU status
                gpu_info = "Unknown"
                try:
                    # Try to get GPU info
                    nvidia_smi = subprocess.run(["nvidia-smi"], capture_output=True, text=True)
                    if nvidia_smi.returncode == 0:
                        gpu_info = "GPU detected: " + nvidia_smi.stdout.split('\n')[7].strip()
                    else:
                        gpu_info = "nvidia-smi failed"
                except Exception as e:
                    gpu_info = f"nvidia-smi error: {str(e)}"
                
                response = {
                    'status': 'ready',
                    'model': os.path.basename(MODEL_PATH),
                    'timestamp': time.time(),
                    'gpu_status': gpu_info
                }
                
                self.wfile.write(json.dumps(response).encode())
                return
            
            # For any other GET request, return 404
            self.send_response(404)
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found"}).encode())
        except Exception as e:
            print(f"Error in do_GET: {str(e)}")
            self.send_response(500)
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
        
    def do_POST(self):
        """Handle POST requests with CORS support"""
        try:
            if self.path.startswith('/v1/completions'):
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                request = json.loads(post_data.decode('utf-8'))
                
                # Process the request
                prompt = request.get('prompt', '')
                max_tokens = request.get('max_tokens', 4096)
                temperature = request.get('temperature', 0.1)
                top_p = request.get('top_p', 0.9)
                
                print(f"Received request. Prompt length: {len(prompt)}, Max tokens: {max_tokens}")
                
                # Run llama.cpp
                try:
                    result = self.run_llama_inference(
                        prompt=prompt,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        top_p=top_p
                    )
                except Exception as e:
                    print(f"Error running inference: {str(e)}")
                    result = f"Error running inference: {str(e)}"
                
                # Prepare the response
                response = {
                    'choices': [
                        {
                            'text': result,
                            'finish_reason': 'length' if len(result) >= max_tokens else 'stop'
                        }
                    ],
                    'usage': {
                        'prompt_tokens': len(prompt.split()),
                        'completion_tokens': len(result.split()),
                        'total_tokens': len(prompt.split()) + len(result.split())
                    }
                }
                
                # Send the response
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                return
            
            # If not a recognized endpoint, return a 404
            self.send_response(404)
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found"}).encode())
        except Exception as e:
            print(f"Error in do_POST: {str(e)}")
            self.send_response(500)
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def run_llama_inference(self, prompt, max_tokens=4096, temperature=0.1, top_p=0.9):
        """Run inference using llama-cli command with corrected parameters"""
        # Create a temporary file for the prompt
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_file:
            temp_file.write(prompt)
            temp_file_path = temp_file.name
        
        try:
            # Build command with all parameters - REMOVED n-threads
            cmd = [
                LLAMA_CLI_PATH,
                '--model', MODEL_PATH,
                '--file', temp_file_path,
                '--n-predict', str(max_tokens),
                '--ctx-size', '8192',
                '--n-gpu-layers', '-1',  # Use all compatible layers on GPU
                '--temp', str(temperature),
                '--top-p', str(top_p),
                '--repeat-penalty', '1.2',
                '--no-chat',              # Raw prompt mode
                '--silent-prompt',        # Don't echo prompt
                '--verbose-prompt'        # Print info about GPU usage
            ]
            
            # Log the command for debugging
            print(f"Running command: {' '.join(cmd)}")
            
            # Run llama-cli and capture output
            start_time = time.time()
            result = subprocess.run(cmd, capture_output=True, text=True)
            end_time = time.time()
            
            # Log inference time
            inference_time = end_time - start_time
            print(f"Inference completed in {inference_time:.2f} seconds")
            
            # Check if the command succeeded
            if result.returncode != 0:
                print(f"Error running llama-cli: {result.stderr}")
                return f"Error: {result.stderr}"
            
            # Log the error output even if successful (contains GPU usage info)
            print(f"llama-cli stderr: {result.stderr}")
            
            # If inference took less than 1 second, it's likely not using GPU
            if inference_time < 1.0:
                print("WARNING: Inference completed too quickly, might not be using GPU")
            
            # If there's no output, something is wrong
            if not result.stdout.strip():
                print("Warning: Empty output from llama-cli")
                return "No output was generated. This could mean the model failed to process the prompt correctly."
            
            return result.stdout.strip()
        
        except subprocess.SubprocessError as e:
            print(f"Subprocess error: {str(e)}")
            return f"Error running llama-cli: {str(e)}"
        
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, LlamaHandler)
    print(f"Starting llama.cpp API server on port {port}")
    print(f"Using model: {MODEL_PATH}")
    print(f"Using llama-cli: {LLAMA_CLI_PATH}")
    
    # Try to get GPU info
    try:
        gpu_info = subprocess.run(["nvidia-smi"], capture_output=True, text=True)
        if gpu_info.returncode == 0:
            print("\nGPU Info:")
            print(gpu_info.stdout)
        else:
            print("\nWARNING: nvidia-smi failed, GPU may not be available")
    except:
        print("\nWARNING: nvidia-smi not found, GPU may not be available")
    
    # Test the model directly
    print("\nTesting model with a simple prompt...")
    test_cmd = [
        LLAMA_CLI_PATH,
        '--model', MODEL_PATH,
        '--prompt', "Hello, this is a test.",
        '--n-predict', '10',
        '--n-gpu-layers', '-1',
        '--verbose-prompt'
    ]
    
    try:
        test_start = time.time()
        test_result = subprocess.run(test_cmd, capture_output=True, text=True)
        test_end = time.time()
        
        print(f"Test completed in {test_end - test_start:.2f} seconds")
        print(f"Output: {test_result.stdout[:100]}...")
        print(f"Stderr: {test_result.stderr}")
        
        if test_end - test_start < 1.0:
            print("WARNING: Test completed too quickly, might not be using GPU")
    except Exception as e:
        print(f"Test failed: {str(e)}")
    
    print("\nServer is ready. Press Ctrl+C to stop.")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()
        print("Server stopped.")

if __name__ == '__main__':
    run_server()