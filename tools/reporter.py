import requests
import os
from dotenv import load_dotenv

load_dotenv()

def upload_to_ipfs(report: dict) -> str:
    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {
        "pinata_api_key": os.getenv("PINATA_API_KEY"),
        "pinata_secret_api_key": os.getenv("PINATA_API_SECRET")
    }
    response = requests.post(url, json=report, headers=headers)
    if response.status_code == 200:
        cid = response.json()["IpfsHash"]
        return f"ipfs://{cid}"
    else:
        raise Exception(f"Failed to upload to IPFS: {response.text}")