#!/bin/bash

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        log_error "Cannot detect OS"
        exit 1
    fi

    log_info "Detected OS: $OS $VER"

    if [[ "$OS" != "ubuntu" ]] && [[ "$OS" != "debian" ]]; then
        log_error "This script only supports Ubuntu 20.04+ and Debian 11+"
        exit 1
    fi
}

install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker is already installed"
        docker --version
        return
    fi

    log_info "Installing Docker..."

    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release

    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    systemctl enable docker
    systemctl start docker

    log_success "Docker installed successfully"
}

init_swarm() {
    if docker info 2>/dev/null | grep -q "Swarm: active"; then
        log_info "Docker Swarm is already initialized"
        return
    fi

    log_info "Initializing Docker Swarm..."
    docker swarm init --advertise-addr $(hostname -I | awk '{print $1}') || true
    log_success "Docker Swarm initialized"
}

install_caddy() {
    if command -v caddy &> /dev/null; then
        log_info "Caddy is already installed"
        caddy version
        return
    fi

    log_info "Installing Caddy..."

    apt-get update -qq
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl

    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list

    apt-get update -qq
    apt-get install -y -qq caddy

    log_success "Caddy installed successfully"
}

setup_caddy_docker_proxy() {
    log_info "Setting up Caddy Docker Proxy..."

    mkdir -p /opt/caddy

    cat > /opt/caddy/docker-compose.yml <<EOF
version: '3.8'

services:
  caddy:
    image: lucaslorentz/caddy-docker-proxy:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - caddy
    deploy:
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: any

volumes:
  caddy_data:
  caddy_config:

networks:
  caddy:
    driver: overlay
    attachable: true
EOF

    docker stack deploy -c /opt/caddy/docker-compose.yml caddy

    log_success "Caddy Docker Proxy deployed"
}

configure_firewall() {
    log_info "Configuring firewall..."

    # Install ufw if not present
    if ! command -v ufw &> /dev/null; then
        apt-get install -y -qq ufw
    fi

    # Allow SSH (critical - do this first!)
    ufw allow 22/tcp >/dev/null 2>&1

    # Allow HTTP and HTTPS for Caddy
    ufw allow 80/tcp >/dev/null 2>&1
    ufw allow 443/tcp >/dev/null 2>&1

    # Allow admin panel port
    ufw allow 3000/tcp >/dev/null 2>&1

    # Enable firewall (will prompt if not already enabled)
    ufw --force enable >/dev/null 2>&1

    log_success "Firewall configured (ports 22, 80, 443, 3000)"
}

download_or_build_agent() {
    log_info "Setting up deploy-dashboard agent..."

    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        ARCH="amd64"
    elif [ "$ARCH" = "aarch64" ]; then
        ARCH="arm64"
    fi

    AGENT_VERSION="latest"
    DOWNLOAD_URL="https://github.com/sivertschou/deploy-dashboard/releases/download/${AGENT_VERSION}/deploy-dashboard-agent-linux-${ARCH}"

    # Try to download pre-built binary
    if curl -f -L -o /tmp/deploy-dashboard-agent "$DOWNLOAD_URL" 2>/dev/null; then
        log_success "Agent downloaded successfully"
        chmod +x /tmp/deploy-dashboard-agent
        mv /tmp/deploy-dashboard-agent /usr/local/bin/deploy-dashboard-agent
        return 0
    fi

    # If download fails, build from source
    log_info "Pre-built binary not available. Building from source..."

    # Install required tools
    if ! command -v go &> /dev/null || ! command -v git &> /dev/null; then
        log_info "Installing build dependencies..."
        apt-get update -qq
        apt-get install -y -qq golang-go git
    fi

    # Clone repository and build
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"

    log_info "Cloning repository..."
    if ! git clone https://github.com/sivertschou/deploy-dashboard.git 2>/dev/null; then
        log_error "Failed to clone repository. Please check your internet connection."
        rm -rf "$TEMP_DIR"
        return 1
    fi

    cd deploy-dashboard/agent

    log_info "Initializing Go modules..."
    # Remove go.sum to regenerate it with correct checksums
    rm -f go.sum

    # Tidy will download dependencies and regenerate go.sum with correct checksums
    if ! go mod tidy; then
        log_error "Failed to initialize dependencies"
        rm -rf "$TEMP_DIR"
        return 1
    fi

    log_info "Building agent..."
    if ! go build -o deploy-dashboard-agent main.go; then
        log_error "Failed to build agent"
        rm -rf "$TEMP_DIR"
        return 1
    fi

    mv deploy-dashboard-agent /usr/local/bin/
    chmod +x /usr/local/bin/deploy-dashboard-agent

    cd /
    rm -rf "$TEMP_DIR"

    log_success "Agent built and installed successfully"
    return 0
}

setup_agent() {
    log_info "Setting up deploy-dashboard agent..."

    mkdir -p /etc/deploy-dashboard-agent

    # Auto-detect VPS IP address
    VPS_IP=$(hostname -I | awk '{print $1}')

    # Check if admin panel is running locally
    ADMIN_PANEL_URL="http://localhost:3000"
    if curl -s -f "$ADMIN_PANEL_URL/api/auth/me" >/dev/null 2>&1; then
        log_info "Detected admin panel running locally on port 3000"
    else
        # Try public IP
        ADMIN_PANEL_URL="http://$VPS_IP:3000"
        log_info "Using admin panel URL: $ADMIN_PANEL_URL"
    fi

    echo ""
    echo "==================================="
    echo "deploy-dashboard Agent Configuration"
    echo "==================================="
    echo ""
    echo "Admin Panel URL: $ADMIN_PANEL_URL"
    echo ""

    read -p "Enter VPS ID (from admin panel): " VPS_ID
    read -p "Enter API Key (from admin panel): " API_KEY

    cat > /etc/deploy-dashboard-agent/config.json <<EOF
{
  "AdminPanelURL": "${ADMIN_PANEL_URL}",
  "VPSID": "${VPS_ID}",
  "APIKey": "${API_KEY}",
  "ReportInterval": 30
}
EOF

    chmod 600 /etc/deploy-dashboard-agent/config.json

    cat > /etc/systemd/system/deploy-dashboard-agent.service <<EOF
[Unit]
Description=deploy-dashboard Agent
After=network.target docker.service

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/deploy-dashboard-agent -config /etc/deploy-dashboard-agent/config.json
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable deploy-dashboard-agent
    systemctl start deploy-dashboard-agent

    log_success "deploy-dashboard agent installed and started"
}

test_connection() {
    log_info "Testing connection to admin panel..."

    sleep 2

    if systemctl is-active --quiet deploy-dashboard-agent; then
        log_success "Agent is running"
    else
        log_error "Agent failed to start. Check logs with: journalctl -u deploy-dashboard-agent -f"
        return 1
    fi

    log_info "Check the admin panel to verify the VPS is online"
}

print_summary() {
    # Get public IP for display
    VPS_IP=$(hostname -I | awk '{print $1}')

    echo ""
    echo "=========================================="
    echo "✓ Installation Complete!"
    echo "=========================================="
    echo ""
    echo "Services installed:"
    echo "  - Docker $(docker --version | awk '{print $3}')"
    echo "  - Docker Swarm (initialized)"
    echo "  - Caddy Docker Proxy (deployed)"
    echo "  - deploy-dashboard Agent (running)"
    echo "  - Firewall (ports 22, 80, 443, 3000 open)"
    echo ""
    echo "Useful commands:"
    echo "  - Check agent status: systemctl status deploy-dashboard-agent"
    echo "  - View agent logs: journalctl -u deploy-dashboard-agent -f"
    echo "  - View Caddy logs: docker service logs caddy_caddy"
    echo "  - List Docker services: docker service ls"
    echo ""
    echo "=========================================="
    echo "Next Steps:"
    echo "=========================================="
    echo ""
    echo "1. Open your admin dashboard:"
    echo ""
    echo "   http://${VPS_IP}:3000"
    echo ""
    echo "   (You can configure a custom domain later in the dashboard)"
    echo ""
    echo "2. Sign in or register (first user becomes admin)"
    echo ""
    echo "3. Your VPS should appear as 'online' in the dashboard"
    echo ""
    echo "4. Start deploying your applications!"
    echo ""
    echo "=========================================="
    echo ""
    log_success "Installation successful!"
}

main() {
    # Clear screen if possible, ignore errors from unknown terminal types
    clear 2>/dev/null || true
    echo "==================================="
    echo "deploy-dashboard Agent Installer"
    echo "==================================="
    echo ""

    check_root
    detect_os
    install_docker
    init_swarm
    install_caddy
    setup_caddy_docker_proxy
    configure_firewall

    if download_or_build_agent; then
        setup_agent
        test_connection
        print_summary
    else
        log_error "Failed to install agent. Please check the logs above."
        exit 1
    fi
}

main "$@"
