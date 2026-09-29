import argparse
import base64
import csv
import json
from getpass import getpass
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def main():
    parser = argparse.ArgumentParser(description="Decrypt CSP completion records offline.")
    parser.add_argument("export_json", help="Encrypted JSON export downloaded from the Worker")
    parser.add_argument("--key", default="csp_private_key.pem", help="Encrypted private-key file")
    parser.add_argument("--output", default="csp_completions_decrypted.csv", help="Output CSV")
    args = parser.parse_args()

    private_key = serialization.load_pem_private_key(
        Path(args.key).read_bytes(),
        password=getpass("Private-key password: ").encode(),
    )
    export = json.loads(Path(args.export_json).read_text(encoding="utf-8"))
    decrypted = []

    for row in export.get("records", []):
        encrypted_package = json.loads(base64.b64decode(row["encrypted_record"]).decode("utf-8"))
        aes_key = private_key.decrypt(
            base64.b64decode(encrypted_package["wrappedKey"]),
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
        )
        plaintext = AESGCM(aes_key).decrypt(
            base64.b64decode(encrypted_package["iv"]),
            base64.b64decode(encrypted_package["ciphertext"]),
            None,
        )
        record = json.loads(plaintext.decode("utf-8"))
        record["receivedAt"] = row.get("received_at", "")
        decrypted.append(record)

    fields = ["name", "completedAt", "completedAtLocal", "elapsedSeconds", "schedule", "receivedAt"]
    with Path(args.output).open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(decrypted)
    print(f"Decrypted {len(decrypted)} records to {args.output}")


if __name__ == "__main__":
    main()
