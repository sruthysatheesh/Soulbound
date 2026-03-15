from dotenv import load_dotenv
import os
import re
import ast
import tempfile
import shutil
import stat
import time
import requests
import git
import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

load_dotenv()

# ─────────────────────────────────────────────
# Force delete (Windows fix)
# ─────────────────────────────────────────────
def force_remove(func, path, exc):
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


# ─────────────────────────────────────────────
# Safe cleanup with retry
# ─────────────────────────────────────────────
def safe_cleanup(path):

    for _ in range(5):
        try:
            shutil.rmtree(path, onerror=force_remove)
            return
        except PermissionError:
            time.sleep(1)

    print(f"⚠️ Could not fully delete temp folder: {path}")


# ─────────────────────────────────────────────
# Detect language
# ─────────────────────────────────────────────
def detect_language(repo_path):

    ext_map = {
        ".py": "Python",
        ".js": "JavaScript",
        ".ts": "TypeScript",
        ".sol": "Solidity",
        ".java": "Java",
        ".go": "Go",
        ".rs": "Rust",
        ".cpp": "C++",
        ".c": "C",
        ".rb": "Ruby"
    }

    counts = {}

    for root, dirs, files in os.walk(repo_path):

        dirs[:] = [d for d in dirs if d not in [".git", "__pycache__", "node_modules"]]

        for file in files:

            ext = os.path.splitext(file)[1]

            if ext in ext_map:
                lang = ext_map[ext]
                counts[lang] = counts.get(lang, 0) + 1

    if not counts:
        return "unknown"

    return max(counts, key=counts.get)


# ─────────────────────────────────────────────
# Clone repository
# ─────────────────────────────────────────────
def clone_repo(repo_url, path):

    git.Repo.clone_from(repo_url, path)

    return path


# ─────────────────────────────────────────────
# Read code from repository
# ─────────────────────────────────────────────
def read_code(repo_path):

    code = ""
    count = 0

    extensions = (".py",".js",".ts",".sol",".java",".go",".rs",".cpp",".c",".rb")

    for root, dirs, files in os.walk(repo_path):

        dirs[:] = [d for d in dirs if d not in [".git","node_modules","__pycache__"]]

        for file in files:

            if file.endswith(extensions):

                try:

                    with open(os.path.join(root,file),"r",encoding="utf8",errors="ignore") as f:

                        code += f.read()
                        count += 1

                        if count >= 10:
                            return code

                except:
                    pass

    return code


# ─────────────────────────────────────────────
# Extract style signals
# ─────────────────────────────────────────────
def extract_signals(code):

    camel = len(re.findall(r'[a-z][A-Z]', code))
    snake = len(re.findall(r'[a-z]_[a-z]', code))
    comments = len(re.findall(r'#.*|//.*|/\*.*?\*/', code))

    lines = code.split("\n")

    avg_line_length = sum(len(l) for l in lines) / max(len(lines),1)

    return {
        "naming": "camelCase" if camel > snake else "snake_case",
        "comments": "high" if comments > 10 else "low",
        "indent": "tabs" if "\t" in code else "spaces",
        "avg_line_length": round(avg_line_length,2)
    }


# ─────────────────────────────────────────────
# AST feature extraction
# ─────────────────────────────────────────────
def extract_ast_features(code):

    features = {
        "functions":0,
        "classes":0,
        "loops":0,
        "conditionals":0
    }

    try:

        tree = ast.parse(code)

        for node in ast.walk(tree):

            if isinstance(node, ast.FunctionDef):
                features["functions"] += 1

            elif isinstance(node, ast.ClassDef):
                features["classes"] += 1

            elif isinstance(node,(ast.For,ast.While)):
                features["loops"] += 1

            elif isinstance(node, ast.If):
                features["conditionals"] += 1

    except:
        pass

    lines = max(len(code.split("\n")),1)

    for k in features:
        features[k] = features[k] / lines * 100

    return features


# ─────────────────────────────────────────────
# AST similarity
# ─────────────────────────────────────────────
def ast_similarity(code1, code2):

    f1 = extract_ast_features(code1)
    f2 = extract_ast_features(code2)

    v1 = np.array(list(f1.values()))
    v2 = np.array(list(f2.values()))

    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)

    if n1 == 0 or n2 == 0:
        return 0

    return float(np.dot(v1,v2)/(n1*n2))


# ─────────────────────────────────────────────
# TFIDF similarity
# ─────────────────────────────────────────────
def tfidf_similarity(code1, code2):

    try:

        vectorizer = TfidfVectorizer(
            token_pattern=r'[a-zA-Z_][a-zA-Z0-9_]*',
            max_features=500
        )

        matrix = vectorizer.fit_transform([code1,code2])

        score = cosine_similarity(matrix[0:1],matrix[1:2])[0][0]

        return float(score)

    except:
        return 0


# ─────────────────────────────────────────────
# Commit verification
# ─────────────────────────────────────────────
def commit_ratio(repo_path, username):

    try:

        repo = git.Repo(repo_path)

        commits = list(repo.iter_commits(max_count=50))

        if not commits:
            repo.close()
            return 0

        matches = 0

        for c in commits:

            name = (c.author.name or "").lower()
            email = (c.author.email or "").lower()

            if username.lower() in name or username.lower() in email:
                matches += 1

        repo.close()

        return matches / len(commits)

    except:
        return 0


# ─────────────────────────────────────────────
# AI pattern detection
# ─────────────────────────────────────────────
def detect_ai_patterns(code):

    score = 0
    checks = 6

    if "\t" not in code and "    " in code:
        score += 1

    if len(re.findall(r'\b(result|data|value|temp)\b',code)) > 5:
        score += 1

    if len(re.findall(r'#.*',code)) > 10:
        score += 1

    if len(re.findall(r'\btry\b',code)) > 3:
        score += 1

    if len(re.findall(r'def [a-zA-Z_]{20,}',code)) > 1:
        score += 1

    if len(re.findall(r'\b[a-z]{1}\b',code)) == 0:
        score += 1

    probability = round(score/checks,2)

    return {
        "ai_probability":probability,
        "ai_generated": probability > 0.5
    }


# ─────────────────────────────────────────────
# Developer DNA Agent
# ─────────────────────────────────────────────
def fingerprint(username, patch_repo_url):

    tmp = tempfile.mkdtemp()

    try:

        print("Cloning patch repo...")
        patch_path = clone_repo(patch_repo_url, os.path.join(tmp,"patch"))

        patch_code = read_code(patch_path)

        language = detect_language(patch_path)

        print("Detected language:",language)

        # fetch user repos
        url = f"https://api.github.com/users/{username}/repos"

        repos = requests.get(url).json()

        similarities = []

        for repo in repos[:3]:

            if repo["fork"]:
                continue

            try:

                path = clone_repo(repo["clone_url"], os.path.join(tmp,repo["name"]))

                hist_code = read_code(path)

                tfidf = tfidf_similarity(hist_code,patch_code)
                ast_score = ast_similarity(hist_code,patch_code)

                similarities.append((tfidf+ast_score)/2)

            except:
                pass

        if similarities:
            style_similarity = sum(similarities)/len(similarities)
        else:
            style_similarity = 0

        commit_score = commit_ratio(patch_path, username)

        ai_detection = detect_ai_patterns(patch_code)

        final_score = 0.7*style_similarity + 0.3*commit_score

        if final_score >= 0.75 and not ai_detection["ai_generated"]:
            verdict = "APPROVED"
            sbt = True

        elif final_score >= 0.5:
            verdict = "REVIEW NEEDED"
            sbt = False

        else:
            verdict = "REJECTED"
            sbt = False

        return {

            "developer":username,
            "language":language,

            "scores":{
                "style_similarity":round(style_similarity,3),
                "commit_ratio":round(commit_score,3),
                "final_score":round(final_score,3)
            },

            "ai_detection":ai_detection,

            "verdict":verdict,
            "sbt_eligible":sbt
        }

    finally:

        safe_cleanup(tmp)