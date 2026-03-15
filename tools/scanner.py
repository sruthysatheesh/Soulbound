import subprocess
import sys
import os
import json

def run_semgrep(code_path: str) -> str:
    try:
        print("🔍 Running Semgrep...")

        result = subprocess.run(
            [
                sys.executable, "-m", "semgrep",
                "--config", "auto",
                "--json",
                "--quiet",
                "--timeout", "30",
                code_path
            ],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.stdout:
            return result.stdout
        else:
            print(f"⚠️ Semgrep stderr: {result.stderr[:300]}")
            return ""

    except subprocess.TimeoutExpired:
        print("⚠️ Semgrep timed out after 60s")
        return ""
    except Exception as e:
        print(f"⚠️ Semgrep failed: {str(e)}")
        return ""

def parse_semgrep_output(raw: str) -> list:
    if not raw:
        return []

    try:
        data = json.loads(raw)
        findings = []

        for result in data.get("results", []):
            findings.append({
                "rule": result.get("check_id", "unknown"),
                "file": os.path.basename(
                    result.get("path", "unknown")
                ),
                "line": result.get("start", {}).get("line", 0),
                "message": result.get(
                    "extra", {}
                ).get("message", ""),
                "severity": result.get(
                    "extra", {}
                ).get("severity", "WARNING")
            })

        return findings
    except:
        return []

def run_scanner(code_path: str) -> str:
    raw = run_semgrep(code_path)
    findings = parse_semgrep_output(raw)

    if not findings:
        print("⚠️ Semgrep found no issues")
        return "Semgrep found no issues or scan failed"

    print(f"✅ Semgrep found {len(findings)} issues!")

    output = f"Semgrep found {len(findings)} security issues:\n\n"

    for i, f in enumerate(findings, 1):
        output += f"""Issue {i}:
Rule     : {f['rule']}
File     : {f['file']}
Line     : {f['line']}
Severity : {f['severity']}
Message  : {f['message']}
---
"""
    return output
