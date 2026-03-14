import requests
import os
from dotenv import load_dotenv
from tools.crypto import encrypt_report

load_dotenv()

def upload_to_ipfs(report: dict) -> str:
    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {
        "pinata_api_key": os.getenv("PINATA_API_KEY"),
        "pinata_secret_api_key": os.getenv("PINATA_API_SECRET")
    }
    
    # Encrypt the report before it hits the public IPFS ledger
    encrypted_payload = encrypt_report(report)
    
    response = requests.post(url, json=encrypted_payload, headers=headers)
    if response.status_code == 200:
        cid = response.json()["IpfsHash"]
        return f"ipfs://{cid}"
    else:
        raise Exception(f"Failed to upload to IPFS: {response.text}")