#!/bin/sh
set -eu

# FullHub robust user-data bootstrap (Timeweb Cloud)
# - fixes "Welcome to nginx" by replacing default site config
# - deploys app from provided GitHub repo
# - creates optional console sudo user (login/password) for server access

### ====== REQUIRED/EDITABLE CONFIG ======
REPO_URL="https://github.com/3aubalo4ka/FullHub.git"
REPO_BRANCH="main"
DOMAIN="fullhub.website"
EMAIL="admin@fullhub.website"

# Set these if repo is private
GIT_TOKEN=""

# Server app settings
APP_DIR="/opt/fullhub"
APP_USER="fullhub"
APP_GROUP="fullhub"
APP_PORT="4173"
JWT_SECRET=""
ENABLE_TLS="true"

# Optional: create console login user (for web-console/ssh login)
# Fill both values to enable. Leave empty to skip.
CONSOLE_LOGIN="3aubalo4ka"
CONSOLE_PASSWORD="3aubalo4ka"
### ======================================

log() { echo "[fullhub-user-data] $*"; }
run_as_app_user() { su -s /bin/sh -c "$1" "$APP_USER"; }

ensure_root() {
  [ "$(id -u)" -eq 0 ] || { echo "Run as root" >&2; exit 1; }
}

gen_secret() {
  if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET="$(openssl rand -hex 48)"
  fi
}

install_packages() {
  log "Installing packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl git gnupg nginx ufw openssl

  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi

  if [ "$ENABLE_TLS" = "true" ]; then
    apt-get install -y certbot python3-certbot-nginx
  fi
}

create_console_user_if_needed() {
  if [ -n "$CONSOLE_LOGIN" ] && [ -n "$CONSOLE_PASSWORD" ]; then
    if ! id -u "$CONSOLE_LOGIN" >/dev/null 2>&1; then
      useradd -m -s /bin/bash "$CONSOLE_LOGIN"
    fi
    echo "$CONSOLE_LOGIN:$CONSOLE_PASSWORD" | chpasswd
    usermod -aG sudo "$CONSOLE_LOGIN"
    log "Console user '$CONSOLE_LOGIN' ensured (sudo enabled)"
  else
    log "Console user creation skipped (CONSOLE_LOGIN/CONSOLE_PASSWORD empty)"
  fi
}

prepare_app_user_and_dir() {
  if ! id -u "$APP_USER" >/dev/null 2>&1; then
    useradd --system --create-home --shell /bin/bash "$APP_USER"
  fi
  mkdir -p "$APP_DIR"
  chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"
}

clone_or_update_repo() {
  clone_url="$REPO_URL"
  case "$REPO_URL" in
    https://*)
      if [ -n "$GIT_TOKEN" ]; then
        clone_url="https://${GIT_TOKEN}@${REPO_URL#https://}"
      fi
      ;;
  esac

  if [ -d "$APP_DIR/.git" ]; then
    log "Updating repo"
    run_as_app_user "git -C '$APP_DIR' fetch --all"
    run_as_app_user "git -C '$APP_DIR' checkout '$REPO_BRANCH'"
    run_as_app_user "git -C '$APP_DIR' pull --ff-only origin '$REPO_BRANCH'"
  else
    log "Cloning repo"
    rm -rf "$APP_DIR"/*
    run_as_app_user "git clone --branch '$REPO_BRANCH' '$clone_url' '$APP_DIR'"
  fi
}

write_env() {
  umask 077
  cat > "$APP_DIR/.env" <<ENV
PORT=$APP_PORT
JWT_SECRET=$JWT_SECRET
RESET_IP_ALLOWLIST=127.0.0.1
ENV
  chown "$APP_USER:$APP_GROUP" "$APP_DIR/.env"
}

install_dependencies() {
  log "Installing npm dependencies"
  run_as_app_user "cd '$APP_DIR' && npm ci --omit=dev || npm install --omit=dev"
}

configure_systemd_service() {
  log "Configuring systemd service"
  cat > /etc/systemd/system/fullhub.service <<SERVICE
[Unit]
Description=FullHub Node Backend
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable fullhub.service
  systemctl restart fullhub.service
}

configure_nginx() {
  log "Configuring Nginx"
  cat > /etc/nginx/sites-available/fullhub.conf <<NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

  ln -sf /etc/nginx/sites-available/fullhub.conf /etc/nginx/sites-enabled/fullhub.conf
  rm -f /etc/nginx/sites-enabled/default
  rm -f /etc/nginx/conf.d/default.conf
  rm -f /var/www/html/index.nginx-debian.html
  nginx -t
  systemctl enable nginx
  systemctl restart nginx
}

configure_firewall() {
  log "Configuring firewall"
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
}

enable_tls() {
  [ "$ENABLE_TLS" = "true" ] || { log "TLS disabled"; return; }
  [ -n "$DOMAIN" ] || { log "DOMAIN empty; skipping TLS"; return; }

  log "Enabling TLS via certbot"
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect || true
}

post_checks() {
  log "Health check"
  sleep 2
  curl -fsS "http://127.0.0.1:$APP_PORT/api/health" || true
  systemctl status fullhub.service --no-pager || true
  systemctl status nginx --no-pager || true
}

main() {
  ensure_root
  gen_secret
  install_packages
  create_console_user_if_needed
  prepare_app_user_and_dir
  clone_or_update_repo
  write_env
  install_dependencies
  configure_systemd_service
  configure_nginx
  configure_firewall
  enable_tls
  post_checks
  log "Done"
}

main "$@"
