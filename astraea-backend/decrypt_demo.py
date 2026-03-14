import sys
import json
import base64
import requests
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend

def decrypt_payload(encrypted_dict: dict, private_key_path: str = "org_private_key.pem") -> dict:
    """Decrypts the IPFS payload using the Organization's Private Key."""
    print("🔑 Loading Organization Private Key...")
    with open(private_key_path, "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None, backend=default_backend())
        
    print("🔓 Unlocking AES Session Key with RSA...")
    encrypted_session_key = base64.b64decode(encrypted_dict["encrypted_key_base64"])
    encrypted_payload = base64.b64decode(encrypted_dict["encrypted_payload_base64"])
    
    session_key = private_key.decrypt(
        encrypted_session_key,
        padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None)
    )
    
    print("🔓 Decrypting JSON Report with AES Session Key...\n")
    fernet = Fernet(session_key)
    decrypted_bytes = fernet.decrypt(encrypted_payload)
    
    return json.loads(decrypted_bytes.decode("utf-8"))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python decrypt_demo.py <ipfs_uri>")
        sys.exit(1)
        
    ipfs_uri = sys.argv[1]
    cid = ipfs_uri.replace("ipfs://", "")
    gateway_url = f"https://gateway.pinata.cloud/ipfs/{cid}"
    
    print(f"🌐 Fetching encrypted payload from IPFS: {gateway_url}")
    response = requests.get(gateway_url)
    
    if response.status_code != 200:
        print(f"❌ Failed to fetch from IPFS: {response.text}")
        sys.exit(1)
        
    encrypted_data = response.json()
    
    try:
        decrypted_report = decrypt_payload(encrypted_data)
        print("================ VULNERABILITY REPORT ================")
        print(json.dumps(decrypted_report, indent=4))
        print("======================================================")
    except Exception as e:
        print(f"❌ Decryption Failed: Are you sure you are the target Organization? ({e})")
