import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend

def generate_org_keys():
    """Generates an RSA Public/Private Keypair for the Target Organization."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    public_key = private_key.public_key()

    priv_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    pub_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    with open("org_private_key.pem", "wb") as f:
        f.write(priv_pem)
    with open("org_public_key.pem", "wb") as f:
        f.write(pub_pem)
        
    print("Created org_private_key.pem and org_public_key.pem")

def encrypt_report(report_dict: dict, public_key_pem_path: str = "org_public_key.pem") -> dict:
    """Encrypts a JSON report using hybrid encryption (AES + RSA)."""
    # 1. Generate a symmetric session key (AES) using Fernet
    session_key = Fernet.generate_key()
    fernet = Fernet(session_key)
    
    # 2. Encrypt the actual JSON payload with AES
    report_bytes = json.dumps(report_dict).encode("utf-8")
    encrypted_payload = fernet.encrypt(report_bytes)
    
    # 3. Load the Organization's Public RSA Key
    with open(public_key_pem_path, "rb") as f:
        public_key = serialization.load_pem_public_key(
            f.read(),
            backend=default_backend()
        )
        
    # 4. Encrypt the Fernet session key with the RSA Public Key
    encrypted_session_key = public_key.encrypt(
        session_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    # Return the secure Zero-Day package
    return {
        "encryption": "Hybrid RSA-2048 + AES (Fernet)",
        "encrypted_key_base64": base64.b64encode(encrypted_session_key).decode("utf-8"),
        "encrypted_payload_base64": base64.b64encode(encrypted_payload).decode("utf-8")
    }
