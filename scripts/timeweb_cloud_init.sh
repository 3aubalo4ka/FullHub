#!/bin/sh
set -eu

# FullHub one-shot bootstrap for Ubuntu 24.04/22.04 on Timeweb Cloud.
# Compatible with user-data requirement (#cloud-config or #!/bin/sh).

### ====== CONFIGURE THESE VALUES ======
APP_DIR="/opt/fullhub"
APP_USER="fullhub"
APP_GROUP="fullhub"
APP_PORT="4173"

# Repo source (preferred)
REPO_URL="https://github.com/<your-org>/<your-repo>.git"
REPO_BRANCH="main"

# If using private repo, set token (or leave empty)
GIT_TOKEN=""

# Domain and TLS
DOMAIN="fullhub.website"
EMAIL="admin@fullhub.website"
ENABLE_TLS="true"

# JWT secret (MUST be strong; if empty - generated automatically)
JWT_SECRET=""
### ====================================

log() { echo "[fullhub-bootstrap] $*"; }

run_as_app_user() {
  su -s /bin/sh -c "$1" "$APP_USER"
}

ensure_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root" >&2
    exit 1
  fi
}

gen_secret() {
  if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET="$(openssl rand -hex 48)"
  fi
}

install_packages() {
  log "Installing system packages"
  apt-get update -y
  apt-get install -y ca-certificates curl git gnupg nginx ufw

  if ! command -v node >/dev/null 2>&1; then
    log "Installing Node.js 20 LTS"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi

  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
  fi

  if [ "$ENABLE_TLS" = "true" ]; then
    apt-get install -y certbot python3-certbot-nginx
  fi
}

prepare_user_and_dirs() {
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
    log "Updating existing repository"
    run_as_app_user "git -C '$APP_DIR' fetch --all"
    run_as_app_user "git -C '$APP_DIR' checkout '$REPO_BRANCH'"
    run_as_app_user "git -C '$APP_DIR' pull --ff-only origin '$REPO_BRANCH'"
  else
    log "Cloning repository"
    rm -rf "$APP_DIR"/*
    run_as_app_user "git clone --branch '$REPO_BRANCH' '$clone_url' '$APP_DIR'"
  fi
}

write_env_file() {
  umask 077
  cat > "$APP_DIR/.env" <<ENV
PORT=$APP_PORT
JWT_SECRET=$JWT_SECRET
RESET_IP_ALLOWLIST=127.0.0.1
ENV
  chown "$APP_USER:$APP_GROUP" "$APP_DIR/.env"
}

install_app_deps() {
  log "Installing app dependencies"
  run_as_app_user "cd '$APP_DIR' && npm ci --omit=dev || npm install --omit=dev"
}

start_with_pm2() {
  log "Starting app with PM2"
  run_as_app_user "cd '$APP_DIR' && set -a && . ./.env && set +a && pm2 delete fullhub >/dev/null 2>&1 || true && pm2 start server.js --name fullhub --update-env && pm2 save"
  pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" > /tmp/pm2-startup.sh || true
  sh /tmp/pm2-startup.sh || true
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
  nginx -t
  systemctl enable nginx
  systemctl restart nginx
}

configure_firewall() {
  log "Configuring UFW"
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
}

enable_tls() {
  if [ "$ENABLE_TLS" != "true" ]; then
    log "Skipping TLS (ENABLE_TLS=false)"
    return
  fi

  if [ -z "$DOMAIN" ]; then
    log "Skipping TLS because DOMAIN is not set"
    return
  fi

  log "Issuing Let's Encrypt certificate"
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect || true
}

final_healthcheck() {
  log "Final health check"
  sleep 2
  curl -fsS "http://127.0.0.1:$APP_PORT/api/health" || true
  run_as_app_user "pm2 list" || true
  systemctl status nginx --no-pager || true
}

main() {
  ensure_root
  gen_secret
  install_packages
  prepare_user_and_dirs
  clone_or_update_repo
  write_env_file
  install_app_deps
  start_with_pm2
  configure_nginx
  configure_firewall
  enable_tls
  final_healthcheck
  log "Bootstrap completed"
}

main "$@"
