#!/usr/bin/env bash
# Generate a self-signed TLS certificate for LAN HTTPS probe hosting (S02).
#
# RabbitOS Creations install only from an HTTPS origin. For LAN testing we serve
# the probe over HTTPS with a self-signed certificate whose SubjectAltName covers
# the host's LAN IP. The R1 WebView must trust this certificate (install the CA on
# the device); whether RabbitOS honors a user CA is exactly what UAT item H19
# measures. Never disable certificate validation in the production client.
#
# Usage:
#   scripts/make-dev-cert.sh <lan-ip> [extra-dns-name ...]
# Example:
#   scripts/make-dev-cert.sh 192.168.1.23 r1-probe.local

set -euo pipefail

IP="${1:-}"
if [ -z "$IP" ]; then
  echo "usage: $0 <lan-ip> [extra-dns-name ...]" >&2
  exit 1
fi
shift || true

CERT_DIR="certs"
mkdir -p "$CERT_DIR"

SAN="IP:${IP},IP:127.0.0.1,DNS:localhost"
for name in "$@"; do
  SAN="${SAN},DNS:${name}"
done

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "${CERT_DIR}/dev-key.pem" \
  -out "${CERT_DIR}/dev-cert.pem" \
  -days 90 \
  -subj "/CN=Paseo R1 Probe Dev (${IP})" \
  -addext "subjectAltName=${SAN}" \
  -addext "basicConstraints=critical,CA:TRUE"

chmod 600 "${CERT_DIR}/dev-key.pem"

echo "Wrote ${CERT_DIR}/dev-cert.pem and ${CERT_DIR}/dev-key.pem"
echo "SubjectAltName: ${SAN}"
echo
echo "Next:"
echo "  1. Start the LAN server:  npm run serve:lan"
echo "  2. Install ${CERT_DIR}/dev-cert.pem as a trusted CA on the R1 (record the result under H19)."
echo "  3. On the host, open https://${IP}:4173/demo/install.html and scan the QR from the R1."
