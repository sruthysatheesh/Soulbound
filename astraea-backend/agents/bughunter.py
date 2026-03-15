from dotenv import load_dotenv
import os
import json
from tools.llm_client import get_client, clean_json

load_dotenv()

# All code file types the scanner will inspect
CODE_EXTENSIONS = (
    ".sol", ".vy",           # Solidity / Vyper (smart contracts)
    ".py",                   # Python
    ".js", ".mjs", ".cjs",   # JavaScript
    ".ts", ".tsx", ".jsx",   # TypeScript / React
    ".rs",                   # Rust
    ".go",                   # Go
    ".java",                 # Java
    ".cpp", ".cc", ".c", ".h",  # C/C++
    ".rb",                   # Ruby
    ".php",                  # PHP
    ".json",                 # Config / ABI
    ".yaml", ".yml",         # Config
    ".toml",                 # Config (Foundry / Cargo)
    ".sh",                   # Shell scripts
)

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv",
             "dist", "build", "artifacts", "cache", "out"}


# ── List all code files in the repo ──────────────────────
def list_repo_files(repo_path: str) -> list:
    """Returns a list of relative file paths for all code files in the repo."""
    found = []
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for file in files:
            if file.endswith(CODE_EXTENSIONS):
                rel = os.path.relpath(os.path.join(root, file), repo_path)
                found.append(rel.replace("\\", "/"))

    if found:
        return found

    # Fallback: list all non-binary text files
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for file in files:
            if not file.endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
                                   ".pdf", ".zip", ".tar", ".gz", ".lock",
                                   ".woff", ".woff2", ".ttf", ".eot")):
                rel = os.path.relpath(os.path.join(root, file), repo_path)
                found.append(rel.replace("\\", "/"))
    return found


# ── Read a specific file from the repo ───────────────────
def read_file(repo_path: str, filename: str) -> str:
    clean_name = os.path.normpath(filename.strip('\'"')).replace("\\", "/")

    # Direct path first
    direct = os.path.join(repo_path, clean_name)
    if os.path.exists(direct) and os.path.isfile(direct):
        with open(direct, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    # Fallback by basename
    base = os.path.basename(clean_name).lower()
    for root, dirs, files in os.walk(repo_path):
        for file in files:
            if base == file.lower():
                with open(os.path.join(root, file), "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()

    return f"File not found: {filename}"


# ── Search pattern across all files ──────────────────────
def search_pattern(repo_path: str, pattern: str) -> str:
    matches = []
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for file in files:
            if file.endswith(CODE_EXTENSIONS):
                with open(os.path.join(root, file), "r", encoding="utf-8", errors="ignore") as f:
                    for i, line in enumerate(f.readlines()):
                        if pattern.lower() in line.lower():
                            matches.append(f"{file}:line {i+1}: {line.strip()}")
    return "\n".join(matches[:20]) if matches else f"Pattern '{pattern}' not found"


# ── Main Analysis Entry Point ─────────────────────────────
def analyze(repo_path: str) -> dict:
    load_dotenv(override=True)
    client, LLM_MODEL = get_client()

    # Step 1: Collect ALL file contents up-front
    file_list = list_repo_files(repo_path)
    print(f"\n📁 Found {len(file_list)} files in repo")

    if not file_list:
        return {
            "status": "success",
            "total_bugs_found": 0,
            "vulnerabilities": [],
            "ipfs_uri": "ipfs://pending"
        }

    # Build a single code bundle with clear separators
    MAX_CHARS_PER_FILE = 3000
    MAX_TOTAL_CHARS = 50000
    code_bundle = ""
    included = []

    for fname in file_list:
        content = read_file(repo_path, fname)
        snippet = content[:MAX_CHARS_PER_FILE]
        section = f"\n\n{'='*60}\nFILE: {fname}\n{'='*60}\n{snippet}"
        if len(code_bundle) + len(section) > MAX_TOTAL_CHARS:
            print(f"⚠️  Skipping {fname} — total context limit reached")
            break
        code_bundle += section
        included.append(fname)
        print(f"  ✅ Loaded: {fname} ({len(snippet)} chars)")

    file_list_str = "\n".join(included)
    print(f"\n🤖 Sending {len(included)} files to LLM for analysis...\n")

    # Step 2: Single-shot analysis — all code is injected directly, no tool calls needed
    system_prompt = f"""You are TheBugHunter, an expert smart contract and code security auditor.

You are given the FULL source code of a repository below. Read all files carefully and identify ALL security vulnerabilities.

FILES IN THIS REPOSITORY:
{file_list_str}

COMPLETE SOURCE CODE:
{code_bundle}

RULES:
- Analyze every single file provided above.
- DO NOT hallucinate vulnerabilities that are not present in the code.
- If the code is secure, report 0 vulnerabilities.
- For each bug found, assign a realistic CVSS score (0.0 - 10.0).
- The `file_path` field must be one of the exact filenames listed above.

Respond with ONLY this JSON (no markdown fences, no extra text):
{{
    "status": "success",
    "total_bugs_found": <integer>,
    "vulnerabilities": [
        {{
            "vulnerability_name": "<name>",
            "severity": "High|Medium|Low",
            "cve_score": <float 0.0-10.0>,
            "file_path": "<exact filename from list above>",
            "line_number": <integer>,
            "description": "<detailed explanation>",
            "fix_suggestion": "<how to fix>"
        }}
    ],
    "ipfs_uri": "ipfs://pending"
}}"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Analyze the code and output the vulnerability report JSON now."}
    ]

    # Step 3: Up to 3 retries if JSON is invalid
    for attempt in range(3):
        print(f"🔄 LLM analysis attempt {attempt + 1}")
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            max_tokens=4000,
            temperature=0
        )

        raw = response.choices[0].message.content.strip()
        print(f"Agent raw output ({len(raw)} chars):\n{raw[:300]}...\n")

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        try:
            result = json.loads(clean_json(raw), strict=False)
            print(f"✅ Parsed successfully — {result.get('total_bugs_found', '?')} bugs found")
            return result
        except Exception as e:
            print(f"⚠️ JSON parse failed (attempt {attempt+1}): {e}")
            messages.append({"role": "assistant", "content": raw})
            messages.append({
                "role": "user",
                "content": (
                    f"Your response was not valid JSON: {e}. "
                    "Output ONLY a raw JSON object with no markdown fences, "
                    "no comments, and no trailing commas."
                )
            })

    # Final fallback
    return {
        "status": "success",
        "total_bugs_found": 1,
        "vulnerabilities": [{
            "vulnerability_name": "Analysis Incomplete",
            "severity": "Medium",
            "cve_score": 5.0,
            "file_path": file_list[0] if file_list else "unknown",
            "line_number": 0,
            "description": "LLM analysis failed to produce valid JSON after 3 attempts.",
            "fix_suggestion": "Retry the scan."
        }],
        "ipfs_uri": "ipfs://pending"
    }
