from tools.repo_cloner import clone_repo
from tools.scanner import run_scanner
from agents.bughunter import analyze
from tools.reporter import upload_to_ipfs
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from agents.fingerprinter import fingerprint

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class RepoInput(BaseModel):
    repo_url: str

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
    
    # Step 4 - Upload to IPFS
    print("📤 Uploading to IPFS...")
    ipfs_uri = upload_to_ipfs(report)
    report["ipfs_uri"] = ipfs_uri
    
    print("✅ Done!")
    return report

class FingerprintInput(BaseModel):
    github_username: str
    patch_repo_url: str

@app.post("/verify")
async def verify(input: FingerprintInput):
    print("🔍 Starting fingerprint verification...")
    result = fingerprint(
        input.github_username,
        input.patch_repo_url
    )
    print("✅ Verification complete!")
    return result