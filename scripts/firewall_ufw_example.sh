#!/usr/bin/env bash
set -euo pipefail

# Example hardening script for Ubuntu + UFW
# Adjust SSH source IP before enabling in production.

ufw default deny incoming
ufw default allow outgoing

# Allow SSH (customize source if possible)
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

ufw --force enable
ufw status verbose
