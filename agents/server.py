import sys
import os
import traceback
import requests
import base64
import io
from dotenv import load_dotenv

AGENTS_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(AGENTS_DIR, "server_error.log")

# Ensure agents directory is on sys.path for relative imports
if AGENTS_DIR not in sys.path:
    sys.path.insert(0, AGENTS_DIR)

load_dotenv() # Load variables from .env if present

from flask import Flask, request, jsonify
from flask_cors import CORS
from refree_agent import RefereeAgent

# Configure Flask to serve static files from the root directory
app = Flask(__name__, static_folder="../", static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}}) # Allow all for local extension

HF_TOKEN = os.environ.get("HUGGINGFACEHUB_API_TOKEN")

@app.route("/", methods=["GET"])
def index():
    """Serve the landing page."""
    return app.send_static_file("index.html")

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "LLM Guardrail Server is running",
        "endpoint": "POST /check",
        "deployment": "production"
    })


@app.route("/check", methods=["POST"])
def check_prompt():
    data = request.get_json()
    if not data or "prompt" not in data:
        return jsonify({"error": "Missing 'prompt' field"}), 400

    prompt = data["prompt"].strip()
    if not prompt:
        return jsonify({"action": "block", "reason": "Empty prompt"}), 200

    try:
        print(f"--- Request Received: {prompt[:50]}... ---")
        referee = RefereeAgent(prompt)
        result = referee.decide()
        print(f"--- Result: {result.get('action')} ---")
        return jsonify(result), 200
    except Exception as e:
        err_msg = traceback.format_exc()
        print(f"!!! Error in /check: {e}")
        print(err_msg)
        try:
            with open(LOG_FILE, "a") as f:
                f.write(f"\n--- ERROR AT /check ---\n{err_msg}\n")
        except:
            pass
        return jsonify({"error": str(e), "action": "block", "reason": f"Server error: {str(e)}"}), 500


@app.route("/inference", methods=["POST"])
def hf_inference():
    """
    Checks prompt, then calls Hugging Face Inference API.
    Input: { "model_id": "...", "task": "text-generation"|"text-to-image", "prompt": "..." }
    """
    data = request.get_json()
    model_id = data.get("model_id")
    task = data.get("task")
    prompt = data.get("prompt", "").strip()

    if not model_id or not task or not prompt:
        return jsonify({"error": "Missing model_id, task, or prompt"}), 400

    print(f"--- HF Inference Requested: {model_id} ({task}) ---")
    
    # 1. Guardrail Check
    try:
        print(f"--- Checking prompt for HF: {prompt[:50]}... ---")
        referee = RefereeAgent(prompt)
        guard_result = referee.decide()
        
        if guard_result["action"] == "block":
            print(f"--- HF Prompt Blocked: {guard_result['reason']} ---")
            return jsonify({
                "action": "block",
                "reason": guard_result["reason"],
                "message": "Prompt blocked by guardrails. Inference cancelled.",
                "risk_level": guard_result.get("risk_level", "high"),
                "blocked_agents": guard_result.get("blocked_agents", [])
            }), 200
    except Exception as e:
        err_msg = traceback.format_exc()
        print(f"!!! Guardrail error in /inference: {e}")
        print(err_msg)
        return jsonify({"error": f"Guardrail error: {str(e)}", "action": "block", "reason": "Server error during check"}), 500

    # 2. Hugging Face Call
    api_url = f"https://api-inference.huggingface.co/models/{model_id}"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    
    try:
        response = requests.post(api_url, headers=headers, json={"inputs": prompt})
        
        if response.status_code != 200:
            return jsonify({"error": f"HF API Error: {response.text}", "status_code": response.status_code}), response.status_code

        if task == "text-to-image":
            # Return as base64
            img_b64 = base64.b64encode(response.content).decode("utf-8")
            return jsonify({
                "action": "allow",
                "task": "text-to-image",
                "image_data": img_b64
            })
        else: # text-generation
            hf_data = response.json()
            # Usually returns a list of dicts: [{"generated_text": "..."}]
            generated_text = ""
            if isinstance(hf_data, list) and len(hf_data) > 0:
                generated_text = hf_data[0].get("generated_text", str(hf_data[0]))
            else:
                generated_text = str(hf_data)

            return jsonify({
                "action": "allow",
                "task": "text-generation",
                "output": generated_text
            })

    except Exception as e:
        return jsonify({"error": f"Inference failed: {str(e)}"}), 500


if __name__ == "__main__":
    print("=" * 60)
    print("  LLM Guardrail Server (API Edition)")
    port = int(os.environ.get("PORT", 5001))
    print(f"  Running at: http://0.0.0.0:{port}")
    print("=" * 60)
    try:
        app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
    except Exception as e:
        print(f"!!! CRASH DURING RUN: {e}")
        traceback.print_exc()
        sys.exit(1)


