import os

def detect_language(code_path: str) -> str:
    for root, dirs, files in os.walk(code_path):
        for file in files:
            if file.endswith(".sol"):
                return "solidity"
    return "general"

def read_code_files(code_path: str) -> str:
    code_content = ""
    total_chars = 0
    MAX_CHARS = 30000  # AI token limit safety cap

    for root, dirs, files in os.walk(code_path):
        for file in files:
            if file.endswith((".sol", ".py", ".js", ".ts")):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        
                        # Stop if we exceed character limit
                        if total_chars + len(content) > MAX_CHARS:
                            code_content += f"\n\n--- FILE: {rel_path} (truncated) ---\n{content[:500]}"
                            return code_content
                        
                        code_content += f"\n\n--- FILE: {rel_path} ---\n{content}"
                        total_chars += len(content)
                except:
                    pass

    return code_content if code_content else "No code files found"

def run_scanner(code_path: str) -> str:
    print("📖 Reading all code files...")
    return read_code_files(code_path)
