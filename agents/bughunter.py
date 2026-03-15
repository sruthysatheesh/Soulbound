from groq import Groq
from dotenv import load_dotenv
import os
import json

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def analyze(repo_path: str, scanner_output: str = "") -> dict:
    print("\n🤖 TheBugHunter Agent Starting...\n")

    # Read code files directly as backup
    code_content = ""
    extensions = (".sol", ".py", ".js", ".ts")
    count = 0

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
                        code_content += f"\n\n--- {file} ---\n{f.read()[:1000]}"
                        count += 1
                        if count >= 5:
                            break
                except:
                    pass

    # Build analysis prompt
    if scanner_output and "found no issues" not in scanner_output:
        # Use Semgrep findings
        analysis_input = f"""
Semgrep scanner results:
{scanner_output}

Actual code for context:
{code_content[:2000]}
"""
        print("✅ Using Semgrep findings for analysis")
    else:
        # Fallback — AI reads code directly
        analysis_input = f"""
No scanner findings available.
Analyze this code directly for vulnerabilities:

{code_content[:3000]}
"""
        print("⚠️ Semgrep found nothing — AI reading code directly")

    messages = [
        {
            "role": "system",
            "content": """You are TheBugHunter, an expert 
security auditing agent.

Your job is to find ALL security vulnerabilities.

Be thorough and strict:
- Check for injection attacks
- Check for authentication issues
- Check for access control problems
- Check for reentrancy in Solidity
- Check for integer overflow
- Check for hardcoded secrets
- Check for insecure dependencies

Never say there are no vulnerabilities
without thoroughly checking everything.

Always respond in exact JSON format."""
        },
        {
            "role": "user",
            "content": f"""
Analyze this repository for ALL security vulnerabilities:

{analysis_input}

Respond ONLY in this JSON format:
{{
    "status": "success",
    "total_bugs_found": 3,
    "vulnerabilities": [
        {{
            "vulnerability_name": "name",
            "severity": "High/Medium/Low",
            "file": "filename",
            "line": 0,
            "description": "what this means",
            "recommendation": "how to fix it"
        }}
    ],
    "overall_risk": "High/Medium/Low",
    "summary": "one line summary",
    "ipfs_uri": "ipfs://pending"
}}
"""
        }
    ]

    # Agent loop
    for step in range(5):
        print(f"🔄 Agent Step {step + 1}")

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=2000
        )

        output = response.choices[0].message.content
        print(f"Agent output: {output[:300]}...\n")

        messages.append({
            "role": "assistant",
            "content": output
        })

        # Try to parse JSON
        try:
            clean = output.replace(
                "```json", ""
            ).replace("```", "").strip()
            start = clean.find("{")
            end = clean.rfind("}") + 1
            result = json.loads(clean[start:end])

            # Make sure vulnerabilities exist
            if "vulnerabilities" not in result:
                result["vulnerabilities"] = []
            if "total_bugs_found" not in result:
                result["total_bugs_found"] = len(
                    result["vulnerabilities"]
                )

            print(f"✅ Found {result['total_bugs_found']} vulnerabilities!")
            return result

        except:
            messages.append({
                "role": "user",
                "content": "Please respond with valid JSON only. No text before or after."
            })

    # Fallback
    return {
        "status": "success",
        "total_bugs_found": 0,
        "vulnerabilities": [],
        "overall_risk": "Unknown",
        "summary": "Analysis failed to parse",
        "ipfs_uri": "ipfs://pending"
    }