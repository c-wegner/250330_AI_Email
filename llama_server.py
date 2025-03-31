from flask import Flask, request, jsonify
from llama_cpp import Llama

MODEL_PATH = "/home/cwegn/fresh_gpu_setup/mistral-7b-instruct-v0.2.Q4_0.gguf";
llm = Llama(model_path=MODEL_PATH, n_ctx=4096)

app = Flask(__name__)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_input = data.get('message', '')

    prompt = f"[INST] {user_input} [/INST]"
    try:
        output = llm(prompt, max_tokens=1024, temperature=0.7)
        return jsonify({"response": output["choices"][0]["text"].strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5005)
