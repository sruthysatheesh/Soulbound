"""
tools/llm_client.py
───────────────────
Unified LLM client abstraction.

Set LLM_PROVIDER in .env to switch between providers:
  LLM_PROVIDER=groq    → uses Groq cloud API (default)
  LLM_PROVIDER=ollama  → uses local Ollama server

Ollama env vars (optional, defaults shown):
  OLLAMA_BASE_URL=http://localhost:11434/v1
  OLLAMA_MODEL=deepseek-coder-v2:latest
"""

import os
from dotenv import load_dotenv

load_dotenv()

def get_client():
    """
    Returns (client, model_name) for the configured LLM provider.
    Both clients expose an identical .chat.completions.create() interface.
    """
    provider = os.getenv("LLM_PROVIDER", "groq").lower()

    if provider == "ollama":
        from openai import OpenAI
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        model    = os.getenv("OLLAMA_MODEL", "deepseek-coder-v2:latest")
        client   = OpenAI(base_url=base_url, api_key="ollama")
        print(f"🦙 LLM: Ollama @ {base_url}  model={model}")
        return client, model

    else:  # default → groq
        from groq import Groq
        model  = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        print(f"☁️  LLM: Groq cloud  model={model}")
        return client, model


import re as _re

def clean_json(raw: str) -> str:
    """
    Extracts and structurally repairs a JSON object from local-LLM output.
    Uses json-repair as the core engine to fix missing commas, unquoted keys,
    trailing commas, comments, and all other common local-model JSON defects.
    Falls back to manual cleaning if json-repair is unavailable.
    """
    s = raw.strip()

    # 1. Strip markdown code fences
    if "```json" in s:
        s = s.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in s:
        s = s.split("```", 1)[1].split("```", 1)[0]

    # 2. Extract first top-level JSON object
    start = s.find("{")
    end   = s.rfind("}") + 1
    if start != -1 and end > 0:
        s = s[start:end]

    # 3. Try json-repair (handles missing commas, unquoted keys, etc.)
    try:
        from json_repair import repair_json
        return repair_json(s, return_objects=False)
    except ImportError:
        pass

    # 4. Manual fallback: strip comments and trailing commas
    s = _re.sub(r'/\*.*?\*/', '', s, flags=_re.DOTALL)   # block comments
    s = _re.sub(r'//[^\n]*', '', s)                       # line comments
    s = _re.sub(r',\s*([}\]])', r'\1', s)                 # trailing commas
    s = _re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', s)  # ctrl chars
    return s.strip()


def is_ollama() -> bool:
    """Returns True when the active provider is Ollama."""
    load_dotenv()
    return os.getenv("LLM_PROVIDER", "groq").lower() == "ollama"
