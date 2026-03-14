from dotenv import load_dotenv
import os
import re
import ast
import json
import tempfile
import shutil
import stat
import requests
import git
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Import agent2 system
from agents.agent2.fingerprint import verify_developer as math_verify
from agents.agent2.clone_repo import clone_repo as agent2_clone
from agents.agent2.github_fetch import fetch_repos
from agents.agent2.style_features import extract_features
from agents.agent2.similarity import compute_similarity

load_dotenv()

# ── Force delete for Windows ──────────────────────────────
def force_remove(action, name, exc):
    os.chmod(name, stat.S_IWRITE)
    os.remove(name)

# ── Detect language ───────────────────────────────────────
def detect_language(repo_path: str) -> str:
    language_count = {
        "Solidity": 0, "Python": 0,
        "JavaScript": 0, "TypeScript": 0,
        "Java": 0, "Go": 0, "Rust": 0,
        "C++": 0, "C": 0, "Ruby": 0,
    }
    ext_map = {
        ".sol": "Solidity", ".py": "Python",
        ".js": "JavaScript", ".ts": "TypeScript",
        ".java": "Java", ".go": "Go",
        ".rs": "Rust", ".cpp": "C++",
        ".c": "C", ".rb": "Ruby",
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
    return detected if language_count[detected] > 0 else "unknown"

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
        return [r["clone_url"] for r in repos[:3] if not r["fork"]]

    print(f"✅ Found {len(matching)} {language} repos")
    return matching[:3]

# ── Read code from repo ───────────────────────────────────
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
                        encoding="utf-8", errors="ignore"
                    ) as f:
                        code += f"\n\n--- {file} ---\n{f.read()[:1000]}"
                        count += 1
                        if count >= 10:
                            return code
                except:
                    pass
    return code if code else "No code found"

# ── Extract style signals ─────────────────────────────────
def extract_signals(code: str) -> dict:
    camel = len(re.findall(r'[a-z][A-Z]', code))
    snake = len(re.findall(r'[a-z]_[a-z]', code))
    comments = len(re.findall(r'#.*|//.*|/\*.*?\*/', code))
    lines = code.split("\n")
    avg_length = sum(len(l) for l in lines) / max(len(lines), 1)

    return {
        "naming": "camelCase" if camel > snake else "snake_case",
        "comment_frequency": "high" if comments > 10 else "low",
        "error_handling": "try/except" if re.search(r'\btry\b', code) else "if/else",
        "loop_preference": "for" if code.count("for ") > code.count("while ") else "while",
        "avg_line_length": round(avg_length, 2),
        "uses_docstrings": "yes" if re.search(r'"""|\'\'\'|/\*\*', code) else "no",
        "indentation": "tabs" if "\t" in code else "spaces",
        "uses_classes": "yes" if re.search(r'\bclass\b', code) else "no",
        "uses_async": "yes" if re.search(r'\basync\b|\bawait\b', code) else "no",
        "avg_function_length": str(round(
            len(code.split("\n")) /
            max(len(re.findall(
                r'\bdef \b|\bfunction\b|\bfunc\b', code
            )), 1), 2
        ))
    }

# ── Math signal similarity ────────────────────────────────
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

# ── TF-IDF Cosine Similarity ──────────────────────────────
def tfidf_similarity(hist_code: str, sub_code: str) -> float:
    try:
        vectorizer = TfidfVectorizer(
            analyzer='word',
            token_pattern=r'[a-zA-Z_][a-zA-Z0-9_]*',
            max_features=500
        )
        tfidf_matrix = vectorizer.fit_transform(
            [hist_code, sub_code]
        )
        score = cosine_similarity(
            tfidf_matrix[0:1],
            tfidf_matrix[1:2]
        )[0][0]
        return round(float(score), 4)
    except:
        return 0.0

# ── AST Feature Extraction ────────────────────────────────
def extract_ast_features(code: str) -> dict:
    features = {
        "num_functions": 0,
        "num_classes": 0,
        "num_imports": 0,
        "avg_args_per_function": 0.0,
        "uses_list_comprehension": 0,
        "uses_lambda": 0,
        "num_try_except": 0,
        "num_return_statements": 0,
        "num_loops": 0,
        "num_conditionals": 0
    }
    try:
        tree = ast.parse(code)
        functions = []
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                features["num_functions"] += 1
                functions.append(len(node.args.args))
            elif isinstance(node, ast.ClassDef):
                features["num_classes"] += 1
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                features["num_imports"] += 1
            elif isinstance(node, ast.ListComp):
                features["uses_list_comprehension"] += 1
            elif isinstance(node, ast.Lambda):
                features["uses_lambda"] += 1
            elif isinstance(node, ast.Try):
                features["num_try_except"] += 1
            elif isinstance(node, ast.Return):
                features["num_return_statements"] += 1
            elif isinstance(node, (ast.For, ast.While)):
                features["num_loops"] += 1
            elif isinstance(node, ast.If):
                features["num_conditionals"] += 1

        if functions:
            features["avg_args_per_function"] = round(
                sum(functions) / len(functions), 2
            )
    except:
        pass
    return features

# ── AST Similarity ────────────────────────────────────────
def ast_similarity(hist_code: str, sub_code: str) -> float:
    try:
        hist_f = extract_ast_features(hist_code)
        sub_f = extract_ast_features(sub_code)

        hist_vec = np.array(list(hist_f.values()), dtype=float)
        sub_vec = np.array(list(sub_f.values()), dtype=float)

        hist_norm = np.linalg.norm(hist_vec)
        sub_norm = np.linalg.norm(sub_vec)

        if hist_norm == 0 or sub_norm == 0:
            return 0.0

        score = np.dot(hist_vec, sub_vec) / (hist_norm * sub_norm)
        return round(float(score), 4)
    except:
        return 0.0

# ── AI Pattern Detector (No LLM) ─────────────────────────
def detect_ai_patterns(code: str) -> dict:
    ai_score = 0
    total_checks = 10
    evidence = []

    lines = code.split("\n")
    non_empty = [l for l in lines if l.strip()]

    # Check 1 — Perfect indentation
    indents = []
    for line in non_empty:
        stripped = line.lstrip()
        if stripped:
            indent = len(line) - len(stripped)
            indents.append(indent)
    if indents and all(i % 4 == 0 for i in indents if i > 0):
        ai_score += 1
        evidence.append("Perfect 4-space indentation everywhere")

    # Check 2 — Generic variable names
    generic_names = [
        'result', 'data', 'value', 'temp',
        'item', 'element', 'output', 'response'
    ]
    generic_count = sum(
        1 for name in generic_names
        if re.search(rf'\b{name}\b', code)
    )
    if generic_count >= 3:
        ai_score += 1
        evidence.append(f"Generic names found: {generic_count}")

    # Check 3 — Overly descriptive comments
    comment_lines = [
        l for l in lines
        if l.strip().startswith(('#', '//'))
    ]
    long_comments = [c for c in comment_lines if len(c.strip()) > 50]
    if len(long_comments) > 3:
        ai_score += 1
        evidence.append("Overly descriptive comments detected")

    # Check 4 — Every function has docstring
    try:
        tree = ast.parse(code)
        funcs_with_docs = 0
        total_funcs = 0
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                total_funcs += 1
                if (node.body and
                    isinstance(node.body[0], ast.Expr) and
                    isinstance(node.body[0].value, ast.Constant)):
                    funcs_with_docs += 1
        if total_funcs > 0 and funcs_with_docs / total_funcs > 0.8:
            ai_score += 1
            evidence.append("Every function has docstring")
    except:
        pass

    # Check 5 — Excessive try/except
    try_count = len(re.findall(r'\btry\b', code))
    if try_count > 5:
        ai_score += 1
        evidence.append("Excessive error handling blocks")

    # Check 6 — No abbreviations
    abbrevs = re.findall(r'\b[a-z]{1,3}\b', code)
    if len(abbrevs) < 5:
        ai_score += 1
        evidence.append("No abbreviations used")

    # Check 7 — Consistent line lengths
    if non_empty:
        lengths = [len(l) for l in non_empty]
        avg = sum(lengths) / len(lengths)
        variance = sum((l - avg) ** 2 for l in lengths) / len(lengths)
        if variance < 100:
            ai_score += 1
            evidence.append("Suspiciously consistent line lengths")

    # Check 8 — Markdown style comments
    markdown_patterns = ['`', '**', '##', '---']
    markdown_count = sum(1 for p in markdown_patterns if p in code)
    if markdown_count >= 2:
        ai_score += 1
        evidence.append("Markdown style found in comments")

    # Check 9 — Overly long function names
    func_names = re.findall(r'def ([a-zA-Z_]+)', code)
    if func_names:
        avg_name_len = sum(len(n) for n in func_names) / len(func_names)
        if avg_name_len > 20:
            ai_score += 1
            evidence.append("Overly descriptive function names")

    # Check 10 — No personal shortcuts
    shortcuts = [r'\bi\b', r'\bj\b', r'\bk\b', r'\bx\b', r'\bn\b']
    shortcut_count = sum(1 for s in shortcuts if re.search(s, code))
    if shortcut_count == 0:
        ai_score += 1
        evidence.append("No personal shortcuts used")

    ai_probability = round(ai_score / total_checks, 2)

    return {
        "ai_probability": ai_probability,
        "ai_generated": "yes" if ai_probability >= 0.5 else "no",
        "ai_generated_confidence": (
            "High" if ai_probability >= 0.7 else
            "Medium" if ai_probability >= 0.5 else
            "Low"
        ),
        "evidence": evidence,
        "checks_triggered": ai_score,
        "total_checks": total_checks
    }

# ── MAIN FINGERPRINTER ────────────────────────────────────
def fingerprint(github_username: str, patch_repo_url: str) -> dict:
    print("\n🔍 ML Fingerprinter Starting...\n")
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

    # Step 3 — Fetch matching repos
    print(f"📥 Step 3: Fetching {language} repos...")
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

    # Step 6 — Calculate all scores
    print("📊 Step 6: Calculating scores...")
    signal_score = math_similarity(hist_signals, sub_signals)
    patch_features = extract_features(patch_path)
    agent2_score = compute_similarity(dev_features_list, patch_features)
    tfidf_score = tfidf_similarity(hist_code, sub_code)
    ast_score = ast_similarity(hist_code, sub_code)
    commit_match = check_commit_author(patch_path, github_username)

    print(f"Signal Score:   {signal_score}")
    print(f"Agent2 Score:   {agent2_score}")
    print(f"TF-IDF Score:   {tfidf_score}")
    print(f"AST Score:      {ast_score}")
    print(f"Commit Match:   {commit_match}")

    # Step 7 — ML AI detection
    print("🤖 Step 7: ML AI detection...")
    ai_detection = detect_ai_patterns(sub_code)

    print(f"AI Probability: {ai_detection['ai_probability']}")
    print(f"Evidence:       {ai_detection['evidence']}")

    # Step 8 — Combined score
    print("📋 Step 8: Generating final verdict...")

    combined_score = round(
        signal_score * 0.2 +
        agent2_score * 0.2 +
        tfidf_score * 0.2 +
        ast_score * 0.1 +
        (0.3 if commit_match else 0.0), 2
    )

    ai_generated = ai_detection["ai_generated"] == "yes"
    ai_confident = ai_detection[
        "ai_generated_confidence"
    ] in ["High", "Medium"]

    # Final verdict logic
    if commit_match and agent2_score >= 0.8:
        if ai_generated and ai_confident:
            verdict = "REVIEW NEEDED"
            sbt_eligible = False
        else:
            verdict = "APPROVED"
            sbt_eligible = True

    elif ai_generated and ai_confident:
        verdict = "REJECTED"
        sbt_eligible = False

    elif combined_score >= 0.7 and commit_match:
        verdict = "APPROVED"
        sbt_eligible = True

    elif combined_score >= 0.5:
        verdict = "REVIEW NEEDED"
        sbt_eligible = False

    else:
        verdict = "REJECTED"
        sbt_eligible = False

    # Cleanup
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
            "signal_similarity": signal_score,
            "style_similarity": agent2_score,
            "tfidf_similarity": tfidf_score,
            "ast_similarity": ast_score,
            "commit_match": commit_match,
            "combined_score": combined_score
        },

        "ai_detection": {
            "ai_generated": ai_detection["ai_generated"],
            "ai_probability": ai_detection["ai_probability"],
            "confidence": ai_detection["ai_generated_confidence"],
            "evidence": ai_detection["evidence"],
            "checks_triggered": ai_detection["checks_triggered"],
            "total_checks": ai_detection["total_checks"]
        },

        "verdict": verdict,
        "sbt_eligible": sbt_eligible
    }