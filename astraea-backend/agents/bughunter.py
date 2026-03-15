from dotenv import load_dotenv
import os
import json
from tools.llm_client import get_client, clean_json

load_dotenv()

# ── TOOL 1: List all files ────────────────────────────────
def list_repo_files(repo_path: str) -> str:
    all_files = []
    for root, dirs, files in os.walk(repo_path):
        for file in files:
            if file.endswith((".sol", ".py", ".js", ".ts")):
                rel_path = os.path.relpath(
                    os.path.join(root, file), repo_path
                )
                all_files.append(rel_path)
    return "\n".join(all_files) if all_files else "No files found"

# ── TOOL 2: Read a specific file ─────────────────────────
def read_file(repo_path: str, filename: str) -> str:
    for root, dirs, files in os.walk(repo_path):
        for file in files:
            if filename.lower() in file.lower():
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()[:3000]
    return "File not found"

# ── TOOL 3: Search pattern in all files ──────────────────
def search_pattern(repo_path: str, pattern: str) -> str:
    matches = []
    for root, dirs, files in os.walk(repo_path):
        for file in files:
            if file.endswith((".sol", ".py", ".js", ".ts")):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                    for i, line in enumerate(lines):
                        if pattern.lower() in line.lower():
                            matches.append(f"{file}:line {i+1}: {line.strip()}")
    return "\n".join(matches[:20]) if matches else f"Pattern '{pattern}' not found"

# ── AGENT LOOP ────────────────────────────────────────────
def analyze(repo_path: str) -> dict:
    # Re-read .env on each call so provider changes take effect without restart
    load_dotenv(override=True)
    client, LLM_MODEL = get_client()
    # Pre-fetch the real file list and inject it into the system prompt
    real_files = list_repo_files(repo_path)
    print(f"\n📁 Real files in repo:\n{real_files}\n")

    messages = [
        {
            "role": "system",
            "content": f"""You are TheBugHunter, an autonomous security auditing agent.
You find ALL vulnerabilities in code repositories step by step.

The repository contains EXACTLY these files:
{real_files}

CRITICAL RULES:
1. The `file_path` field in your FINAL JSON MUST be one of the exact filenames listed above.
2. DO NOT invent, guess, or hallucinate vulnerabilities. 
3. You MUST read the actual source code of a file using the `read_file` tool BEFORE reporting a vulnerability in it.
4. If the code is perfectly secure, or if it is just a boilerplate file, you MUST report 0 bugs. Do not invent errors that do not exist!

You have these tools available:
- list_files: lists all code files in repo
- read_file(filename): reads a specific file
- search_pattern(pattern): searches for a pattern in all files

To use a tool, respond EXACTLY like this:
ACTION: tool_name
INPUT: your input here

When you have found ALL vulnerabilities (or if there are 0 vulnerabilities), respond EXACTLY like this:
FINAL: {{
    "status": "success",
    "total_bugs_found": 0,
    "vulnerabilities": [
        {{
            "vulnerability_name": "name",
            "severity": "High/Medium/Low",
            "cve_score": 9.8,
            "file_path": "MUST be one of the exact paths listed above",
            "line_number": 42,
            "description": "detailed explanation",
            "fix_suggestion": "how to fix it"
        }}
    ],
    "ipfs_uri": "ipfs://pending"
}}"""
        },
        {
            "role": "user",
            "content": f"""Find ALL security vulnerabilities in the repository at: {repo_path}

Follow these steps:
1. List all files
2. Read each suspicious file one by one
3. Stop and report 0 bugs if there are no vulnerabilities.
4. Report ALL bugs you find, but DO NOT hallucinate issues that do not exist in the code you just read. Remember to include a realistic 0.0 - 10.0 `cve_score` for each bug."""
        }
    ]

    # Agent loop — max 10 steps
    for step in range(10):
        print(f"🔄 Agent Step {step + 1}")

        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            max_tokens=1000,
            temperature=0  # Deterministic — prevents hallucination of file paths
        )

        agent_output = response.choices[0].message.content
        print(f"Agent: {agent_output}\n")

        messages.append({
            "role": "assistant",
            "content": agent_output
        })

        # Check if agent is done
        if "FINAL:" in agent_output:
            try:
                raw = agent_output.split("FINAL:")[1].strip()
                return json.loads(clean_json(raw), strict=False)
            except Exception as e:
                print(f"⚠️ Agent JSON parsing failed: {e}. Asking model to retry.")
                messages.append({
                    "role": "user",
                    "content": f"Your JSON was invalid ({e}). Output ONLY a raw JSON object with no markdown, no comments, and no trailing commas."
                })
                continue

        # Execute tool if agent calls one
        tool_result = ""

        if "ACTION: list_files" in agent_output:
            print("🔧 Tool: ListFiles")
            tool_result = list_repo_files(repo_path)

        elif "ACTION: read_file" in agent_output:
            try:
                filename = agent_output.split("INPUT:")[1].strip().split("\n")[0]
                print(f"🔧 Tool: ReadFile → {filename}")
                tool_result = read_file(repo_path, filename)
            except:
                tool_result = "Error reading file"

        elif "ACTION: search_pattern" in agent_output:
            try:
                pattern = agent_output.split("INPUT:")[1].strip().split("\n")[0]
                print(f"🔧 Tool: SearchPattern → {pattern}")
                tool_result = search_pattern(repo_path, pattern)
            except:
                tool_result = "Error searching pattern"

        if tool_result:
            messages.append({
                "role": "user",
                "content": f"Tool result:\n{tool_result}\n\nContinue your analysis."
            })

    # Fallback if max steps reached
    return {
        "status": "success",
        "total_bugs_found": 1,
        "vulnerabilities": [
            {
                "vulnerability_name": "Analysis Incomplete",
                "severity": "Medium",
                "cve_score": 5.0,
                "file_path": "unknown",
                "line_number": 0,
                "description": "Max steps reached during analysis",
                "fix_suggestion": "Retry scan or review manually"
            }
        ],
        "ipfs_uri": "ipfs://pending"
    }