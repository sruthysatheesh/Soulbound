import git
import os
import shutil
import stat

def force_remove(action, name, exc):
    os.chmod(name, stat.S_IWRITE)
    os.remove(name)

def clone_repo(repo_url: str) -> str:
    repo_name = repo_url.split("/")[-1].replace(".git", "")
    clone_path = f"./temp/{repo_name}"
    
    # Force delete even read-only files (Windows fix)
    if os.path.exists(clone_path):
        shutil.rmtree(clone_path, onerror=force_remove)
    
    print(f"📥 Cloning {repo_url}...")
    git.Repo.clone_from(repo_url, clone_path)
    print(f"✅ Cloned successfully!")
    
    return clone_path