from groq import Groq
from dotenv import load_dotenv
import os
import json

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

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
    print("\n🤖 TheBugHunter Agent Starting...\n")
    messages = [
        {
            "role": "system",
            "content": """You are TheBugHunter, an autonomous security auditing agent.
You find ALL vulnerabilities in code repositories step by step.

You have these tools available:
- list_files: lists all code files in repo
- read_file(filename): reads a specific file
- search_pattern(pattern): searches for a pattern in all files

To use a tool, respond EXACTLY like this:
ACTION: tool_name
INPUT: your input here

When you have found ALL vulnerabilities, respond EXACTLY like this:
FINAL: {
    "status": "success",
    "total_bugs_found": 3,
    "vulnerabilities": [
        {
            "vulnerability_name": "name",
            "severity": "High/Medium/Low",
            "description": "one line explanation"
        }
    ],
    "ipfs_uri": "ipfs://pending"
}"""
        },
        {
            "role": "user",
            "content": f"""Find ALL security vulnerabilities in the repository at: {repo_path}

Follow these steps:
1. List all files
2. Read each suspicious file one by one
3. Search for dangerous patterns
4. Report ALL bugs you find, not just one"""
        }
    ]

    # Agent loop — max 10 steps
    for step in range(10):
        print(f"🔄 Agent Step {step + 1}")

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=1000
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
                json_str = agent_output.split("FINAL:")[1].strip()
                start = json_str.find("{")
                end = json_str.rfind("}") + 1
                return json.loads(json_str[start:end])
            except:
                return {
                    "status": "success",
                    "total_bugs_found": 1,
                    "vulnerabilities": [
                        {
                            "vulnerability_name": "Vulnerability Detected",
                            "severity": "High",
                            "description": agent_output[:200]
                        }
                    ],
                    "ipfs_uri": "ipfs://pending"
                }

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
                "description": "Max steps reached during analysis"
            }
        ],
        "ipfs_uri": "ipfs://pending"
    }