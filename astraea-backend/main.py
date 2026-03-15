from tools.repo_cloner import clone_repo
from tools.scanner import run_scanner
from agents.bughunter import analyze
from tools.reporter import upload_to_ipfs
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import requests
import base64
import json
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend
from cryptography.fernet import Fernet

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from tools.pr_evaluator import evaluate_patch_and_pin

class RepoInput(BaseModel):
    repo_url: str

class DecryptInput(BaseModel):
    ipfs_uri: str
    private_key_pem: str

class PREvalInput(BaseModel):
    pr_url: str

@app.post("/scan")
async def scan(input: RepoInput):
    # Step 1 - Clone repo
    print("📥 Cloning repo...")
    code_path = clone_repo(input.repo_url)

    # Step 2 - Scan for bugs
    print("🔍 Scanning for vulnerabilities...")

    # Step 3 - AI analyzes results
    print("🤖 AI analyzing...")
    report = analyze(code_path)

    # Step 4 - Normalize file paths: strip the local clone prefix
    # The AI may return "temp/soultest/bug.js" but the real path is "bug.js"
    # code_path looks like "./temp/soultest" — strip that prefix from every file_path
    import os as _os
    clone_prefix = _os.path.normpath(code_path).replace("\\", "/").lstrip("./") + "/"
    for vuln in report.get("vulnerabilities", []):
        fp = (vuln.get("file_path") or "").replace("\\", "/")
        # Strip the local temp prefix if present
        if fp.startswith(clone_prefix):
            vuln["file_path"] = fp[len(clone_prefix):]
        elif "/" + clone_prefix.rstrip("/") + "/" in "/" + fp:
            # Handle cases like "temp/soultest/src/file.js"
            idx = fp.find(clone_prefix)
            if idx != -1:
                vuln["file_path"] = fp[idx + len(clone_prefix):]

    # Store the repo URL so the frontend can build correct GitHub links
    report["repo_url"] = input.repo_url.rstrip("/").replace(".git", "")

    # Step 5 - Upload to IPFS
    print("📤 Uploading to IPFS...")
    ipfs_uri = upload_to_ipfs(report)
    report["ipfs_uri"] = ipfs_uri

    print("✅ Done!")
    return report

@app.post("/decrypt")
async def decrypt(input: DecryptInput):
    try:
        # Fetch from IPFS
        cid = input.ipfs_uri.replace("ipfs://", "").strip()
        gateway_url = f"https://gateway.pinata.cloud/ipfs/{cid}"
        response = requests.get(gateway_url)
        
        if response.status_code != 200:
            return {"error": f"Failed to fetch from IPFS Gateway."}
            
        encrypted_dict = response.json()
        
        # Parse Private Key
        private_key = serialization.load_pem_private_key(
            input.private_key_pem.encode("utf-8"),
            password=None,
            backend=default_backend()
        )
        
        # Unlock AES Session Key
        encrypted_session_key = base64.b64decode(encrypted_dict["encrypted_key_base64"])
        encrypted_payload = base64.b64decode(encrypted_dict["encrypted_payload_base64"])
        
        session_key = private_key.decrypt(
            encrypted_session_key,
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None)
        )
        
        # Decrypt JSON
        fernet = Fernet(session_key)
        decrypted_bytes = fernet.decrypt(encrypted_payload)
        
        return {"status": "success", "report": json.loads(decrypted_bytes.decode("utf-8"))}
        
    except Exception as e:
        return {"error": f"Decryption failed. Invalid Key or IPFS Hash. ({str(e)})"}

@app.post("/evaluate-pr")
async def evaluate_pr_endpoint(input: PREvalInput):
    try:
        from tools.pr_evaluator import evaluate_patch_and_pin
        result = evaluate_patch_and_pin(input.pr_url)
        return {"status": "success", **result}
    except Exception as e:
        return {"error": str(e)}