from tools.repo_cloner import clone_repo
from tools.scanner import run_scanner
from agents.bughunter import analyze
from agents.fingerprinter import fingerprint
from tools.reporter import upload_to_ipfs
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="TheBugHunter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Input Models ──────────────────────────────────────────
class RepoInput(BaseModel):
    repo_url: str

class FingerprintInput(BaseModel):
    github_username: str
    patch_repo_url: str

# ── Route 1 — Bug Scanner ─────────────────────────────────
@app.post("/scan")
async def scan(input: RepoInput):

    print("\n" + "="*50)
    print("🚀 New Scan Request")
    print(f"📌 Repo: {input.repo_url}")
    print("="*50)

    # Step 1 — Clone repo
    print("📥 Step 1: Cloning repo...")
    code_path = clone_repo(input.repo_url)
    print(f"✅ Cloned to: {code_path}")

    # Step 2 — Run Semgrep scanner
    print("🔍 Step 2: Running Semgrep scanner...")
    scanner_output = run_scanner(code_path)
    print(f"📋 Scanner found: {scanner_output[:200]}")

    # Step 3 — AI Agent analyzes scanner results
    print("🤖 Step 3: AI Agent analyzing...")
    report = analyze(code_path, scanner_output)

    # Step 4 — Upload to IPFS
    print("📤 Step 4: Uploading to IPFS...")
    ipfs_uri = upload_to_ipfs(report)
    report["ipfs_uri"] = ipfs_uri

    print("✅ Scan complete!")
    print("="*50 + "\n")

    return report
