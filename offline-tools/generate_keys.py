from getpass import getpass
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def main():
    password = getpass("Create a password for the private key: ").encode()
    if len(password) < 10:
        raise SystemExit("Use a password of at least 10 characters.")

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    private_pem = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.BestAvailableEncryption(password),
    )
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    Path("csp_private_key.pem").write_bytes(private_pem)
    Path("csp_public_key.pem").write_bytes(public_pem)
    print("Created csp_private_key.pem and csp_public_key.pem")
    print("Keep csp_private_key.pem offline. Never upload it to GitHub or Cloudflare.")


if __name__ == "__main__":
    main()
