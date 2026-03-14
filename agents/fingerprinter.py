from groq import Groq
from dotenv import load_dotenv
import os
import json
import re
import tempfile
import shutil
import stat
import requests
import git

# Import agent2 system
from agents.agent2.fingerprint import verify_developer as math_verify
from agents.agent2.clone_repo import clone_repo as agent2_clone
from agents.agent2.github_fetch import fetch_repos
from agents.agent2.style_features import extract_features
from agents.agent2.similarity import compute_similarity

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ── Force delete for Windows ──────────────────────────────
def force_remove(action, name, exc):
    os.chmod(name, stat.S_IWRITE)
    os.remove(name)

# ── Detect language of submitted repo ────────────────────
def detect_language(repo_path: str) -> str:
    language_count = {
        "Solidity": 0,
        "Python": 0,
        "JavaScript": 0,
        "TypeScript": 0,
        "Java": 0,
        "Go": 0,
        "Rust": 0,
        "C++": 0,
        "C": 0,
        "Ruby": 0,
    }

    ext_map = {
        ".sol": "Solidity",
        ".py": "Python",
        ".js": "JavaScript",
        ".ts": "TypeScript",
        ".java": "Java",
        ".go": "Go",
        ".rs": "Rust",
        ".cpp": "C++",
        ".c": "C",
        ".rb": "Ruby",
    }

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [
            d for d in dirs
            if d not in [".git", "__pycache__", "node_modules"]
        ]
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in ext_map:
                language_count[ext_map[ext]] += 1

    detected = max(language_count, key=language_count.get)
    if language_count[detected] == 0:
        return "unknown"
    return detected

# ── Fetch repos matching same language ───────────────────
def fetch_matching_repos(username: str, language: str) -> list:
    token = os.getenv("GITHUB_TOKEN")
    headers = {}
    if token:
        headers["Authorization"] = f"token {token}"

    url = f"https://api.github.com/users/{username}/repos?per_page=30"
    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        print(f"⚠️ GitHub API error: {response.status_code}")
        return []

    repos = response.json()

    matching = [
        r["clone_url"] for r in repos
        if (r.get("language") or "").lower() == language.lower()
        and not r["fork"]
    ]

    if not matching:
        print(f"⚠️ No {language} repos found — using all repos")
        return [
            r["clone_url"] for r in repos[:3]
            if not r["fork"]
        ]

    print(f"✅ Found {len(matching)} {language} repos")
    return matching[:3]

# ── Read code from repo (all languages) ──────────────────
def read_code(repo_path: str) -> str:
    code = ""
    count = 0
    extensions = (
        ".sol", ".py", ".js", ".ts",
        ".java", ".go", ".rs", ".cpp",
        ".c", ".rb"
    )

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [
            d for d in dirs
            if d not in [".git", "__pycache__", "node_modules"]
        ]
        for file in files:
            if file.endswith(extensions):
                file_path = os.path.join(root, file)
                try:
                    with open(
                        file_path, "r",
                        encoding="utf-8",
                        errors="ignore"
                    ) as f:
                        code += f"\n\n--- {file} ---\n{f.read()[:1000]}"
                        count += 1
                        if count >= 10:
                            return code
                except:
                    pass
    return code if code else "No code found"

# ── Extract signals (all languages) ──────────────────────
def extract_signals(code: str) -> dict:
    camel = len(re.findall(r'[a-z][A-Z]', code))
    snake = len(re.findall(r'[a-z]_[a-z]', code))
    comments = len(re.findall(r'#.*|//.*|/\*.*?\*/', code))
    lines = code.split("\n")
    avg_length = sum(len(l) for l in lines) / max(len(lines), 1)

    return {
        "naming": "camelCase" if camel > snake else "snake_case",
        "comment_frequency": "high" if comments > 10 else "low",
        "error_handling": "try/except" if re.search(
            r'\btry\b', code) else "if/else",
        "loop_preference": "for" if code.count("for ") > code.count(
            "while ") else "while",
        "avg_line_length": round(avg_length, 2),
        "uses_docstrings": "yes" if re.search(
            r'"""|\'\'\'|/\*\*', code) else "no",
        "indentation": "tabs" if "\t" in code else "spaces",
        "uses_classes": "yes" if re.search(r'\bclass\b', code) else "no",
        "uses_async": "yes" if re.search(
            r'\basync\b|\bawait\b', code) else "no",
        "avg_function_length": str(round(
            len(code.split("\n")) /
            max(len(re.findall(
                r'\bdef \b|\bfunction\b|\bfunc\b', code
            )), 1), 2
        ))
    }

# ── Math similarity score ─────────────────────────────────
def math_similarity(hist: dict, sub: dict) -> float:
    matches = sum(1 for k in hist if hist.get(k) == sub.get(k))
    return round(matches / len(hist), 2)

# ── Check commit author ───────────────────────────────────
def check_commit_author(repo_path: str, username: str) -> bool:
    try:
        repo = git.Repo(repo_path)
        for commit in list(repo.iter_commits(max_count=20)):
            name = (commit.author.name or "").lower()
            email = (commit.author.email or "").lower()
            if username.lower() in name or username.lower() in email:
                return True
    except:
        pass
    return False

# ── AI deep analysis ──────────────────────────────────────
def ai_analysis(
    hist_code: str,
    sub_code: str,
    math_score: float,
    agent2_score: float,
    commit_match: bool,
    language: str
) -> dict:

    prompt = f"""
    You are a strict code forensics analyst.
    Your job is to verify code ownership.

    Language: {language}
    Math similarity score: {math_score}
    Agent2 style score: {agent2_score}
    Commit author match: {commit_match}

    CRITICAL RULES:
    - commit_match=True means the person's name
      is literally in the git history
      This is the STRONGEST proof of ownership
    - Old repositories pre-2020 CANNOT be AI generated
      AI code generators did not exist before 2020
    - C code often looks clean and structured
      That is NOT evidence of AI generation
    - Do NOT flag old codebases as AI generated
    - Well written clean code is NOT AI generated
    - Professional developers write clean code too

    Historical code sample ({language}):
    {hist_code[:1500]}

    Submitted fix ({language}):
    {sub_code[:1500]}

    PRIORITY ORDER for verdict:
    1. commit_match=True → strong ownership signal
    2. agent2_score > 0.8 → styles strongly match
    3. Only reject if VERY obvious modern AI fraud

    Signs of REAL AI generated code post 2022 only:
    - Comments like This function does X by doing Y
    - Perfect docstrings on every single function
    - Generic names: result, data, temp, value, item
    - No abbreviations at all
    - Too many unnecessary safety checks
    - Markdown style formatting in comments

    If commit_match=True AND agent2_score > 0.8:
    → MUST return APPROVED
    → Only override if code is impossibly perfect

    Respond ONLY in this JSON:
    {{
        "ai_verdict": "APPROVED or REJECTED or SUSPICIOUS",
        "ai_generated": "yes or no",
        "ai_generated_confidence": "High or Medium or Low",
        "plagiarism_suspected": "yes or no",
        "bug_fixed_correctly": "yes or no",
        "reasoning": "specific evidence",
        "confidence": "High or Medium or Low"
    }}
    """

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500
    )

    raw = response.choices[0].message.content
    clean = raw.replace("```json", "").replace("```", "").strip()
    try:
        start = clean.find("{")
        end = clean.rfind("}") + 1
        return json.loads(clean[start:end])
    except:
        return {
            "ai_verdict": "APPROVED",
            "ai_generated": "no",
            "ai_generated_confidence": "Low",
            "plagiarism_suspected": "no",
            "bug_fixed_correctly": "unknown",
            "reasoning": raw[:200],
            "confidence": "Low"
        }

# ── MAIN COMBINED FINGERPRINTER ───────────────────────────
def fingerprint(github_username: str, patch_repo_url: str) -> dict:
    print("\n🔍 Combined Fingerprinter Starting...\n")
    tmp = tempfile.mkdtemp()

    # Step 1 — Clone submitted fix
    print("📖 Step 1: Cloning submitted fix...")
    try:
        patch_path = agent2_clone(
            patch_repo_url,
            os.path.join(tmp, "patch")
        )
    except Exception as e:
        return {
            "status": "error",
            "message": f"Could not clone patch repo: {str(e)}"
        }

    # Step 2 — Detect language
    print("🔍 Step 2: Detecting language...")
    language = detect_language(patch_path)
    print(f"✅ Language detected: {language}")

    # Step 3 — Fetch matching language repos
    print(f"📥 Step 3: Fetching {language} repos from history...")
    repo_urls = fetch_matching_repos(github_username, language)

    if not repo_urls:
        return {
            "status": "error",
            "message": f"No public repos found for {github_username}"
        }

    # Step 4 — Clone & read historical code
    print("📖 Step 4: Reading historical code...")
    hist_code = ""
    dev_features_list = []

    for i, url in enumerate(repo_urls[:3]):
        try:
            hist_path = agent2_clone(
                url,
                os.path.join(tmp, f"hist_{i}")
            )
            hist_code += read_code(hist_path)
            features = extract_features(hist_path)
            dev_features_list.append(features)
            print(f"✅ Cloned historical repo {i+1}")
        except Exception as e:
            print(f"⚠️ Skipping repo: {e}")

    # Step 5 — Extract signals
    print("🧬 Step 5: Extracting signals...")
    hist_signals = extract_signals(hist_code)
    sub_code = read_code(patch_path)
    sub_signals = extract_signals(sub_code)

    print(f"Historical signals: {hist_signals}")
    print(f"Submitted signals:  {sub_signals}")

    # Step 6 — Math scores
    print("📊 Step 6: Calculating similarity...")
    my_math_score = math_similarity(hist_signals, sub_signals)
    patch_features = extract_features(patch_path)
    agent2_score = compute_similarity(dev_features_list, patch_features)
    commit_match = check_commit_author(patch_path, github_username)

    print(f"My Math Score:  {my_math_score}")
    print(f"Agent2 Score:   {agent2_score}")
    print(f"Commit Match:   {commit_match}")

    # Step 7 — AI analysis
    print("🤖 Step 7: AI deep analysis...")
    ai_result = ai_analysis(
        hist_code,
        sub_code,
        my_math_score,
        agent2_score,
        commit_match,
        language
    )

    # Step 8 — Combined score
    print("📋 Step 8: Generating final verdict...")
    ai_approved = ai_result["ai_verdict"] == "APPROVED"
    ai_suspicious = ai_result["ai_verdict"] == "SUSPICIOUS"
    ai_generated = ai_result["ai_generated"] == "yes"
    ai_generated_confident = ai_result.get(
        "ai_generated_confidence", "Low"
    ) in ["High", "Medium"]
    plagiarism = ai_result["plagiarism_suspected"] == "yes"

    combined_score = round(
        my_math_score * 0.3 +
        agent2_score * 0.3 +
        (0.3 if commit_match else 0.0) +
        (0.1 if ai_approved else 0.0), 2
    )

    # Final verdict
    if commit_match and agent2_score >= 0.8:
        # Strong ownership — only reject if no commit match
        if ai_generated and ai_generated_confident and not commit_match:
            verdict = "REJECTED"
            sbt_eligible = False
        else:
            verdict = "APPROVED"
            sbt_eligible = True

    elif ai_generated and ai_generated_confident:
        # AI generated with confidence → reject
        verdict = "REJECTED"
        sbt_eligible = False

    elif plagiarism and not commit_match:
        # Plagiarized with no commit match → reject
        verdict = "REJECTED"
        sbt_eligible = False

    elif combined_score >= 0.7 and commit_match:
        # Good score with commit match → approve
        verdict = "APPROVED"
        sbt_eligible = True

    elif combined_score >= 0.5:
        # Borderline → review
        verdict = "REVIEW NEEDED"
        sbt_eligible = False

    else:
        verdict = "REJECTED"
        sbt_eligible = False

    # Cleanup temp folder
    try:
        shutil.rmtree(tmp, onerror=force_remove)
        print("🧹 Cleaned up temp files")
    except:
        pass

    return {
        "status": "success",
        "developer": github_username,
        "language_detected": language,

        "scores": {
            "signal_similarity": my_math_score,
            "style_similarity": agent2_score,
            "commit_match": commit_match,
            "combined_score": combined_score
        },

        "ai_analysis": {
            "verdict": ai_result["ai_verdict"],
            "ai_generated": ai_result["ai_generated"],
            "ai_generated_confidence": ai_result.get(
                "ai_generated_confidence", "Low"
            ),
            "plagiarism_suspected": ai_result["plagiarism_suspected"],
            "bug_fixed_correctly": ai_result["bug_fixed_correctly"],
            "reasoning": ai_result["reasoning"],
            "confidence": ai_result["confidence"]
        },

        "verdict": verdict,
        "sbt_eligible": sbt_eligible
    }