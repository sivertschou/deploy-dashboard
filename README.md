# deploy-dashboard

A platform for managing VPS instances with Docker Swarm and Caddy-based deployments.

## Features

- **Admin Panel** - Next.js dashboard for managing deployments and monitoring
- **VPS Agent** - Lightweight Go service that runs on each VPS
- **Docker Swarm Integration** - Native support for Docker Swarm deployments
- **Caddy-Docker-Proxy** - Automatic HTTPS and reverse proxy configuration
- **Real-time Monitoring** - Track CPU, memory, and disk usage
- **Deployment Logs** - View deployment progress in real-time
- **GitHub Actions** - Easy CI/CD integration

## Architecture

```
┌─────────────────┐
│  Admin Panel    │  (Next.js + SQLite)
│  (Your Server)  │
└────────┬────────┘
         │
         │ HTTPS API
         │
    ┌────┴────┬────────┬────────┐
    │         │        │        │
┌───▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐
│ VPS 1 │ │ VPS 2│ │ VPS 3│ │ VPS N│
│       │ │      │ │      │ │      │
│ Agent │ │ Agent│ │ Agent│ │ Agent│
└───────┘ └──────┘ └──────┘ └──────┘
```

## Quick Start

### 1. Set Up Admin Panel

```bash
cd admin-panel
npm install
npm run build
npm start
```

The admin panel will start on `http://localhost:3000`.

On first run:
1. Visit the admin panel
2. Register your admin account (first user becomes admin)
3. You're ready to add VPS servers!

### 2. Install Agent on VPS

SSH into your VPS and run:

```bash
curl -fsSL https://raw.githubusercontent.com/sivertschou/deploy-dashboard/main/agent/install.sh | sudo bash
```

The installer will:
- Install Docker (if not present)
- Initialize Docker Swarm
- Install Caddy with docker-proxy plugin
- Download and install the deploy-dashboard agent
- Configure and start the agent service

You'll be prompted for:
- **Admin Panel URL** - The URL where your admin panel is hosted
- **VPS ID** - Get this from the admin panel after adding the VPS
- **API Key** - Generated when you add a VPS in the admin panel

### 3. Add VPS in Admin Panel

1. Click "VPS Servers" in the navigation
2. Click "Add VPS Server"
3. Enter a name and IP address
4. Copy the generated API key
5. Use this API key when installing the agent on your VPS

### 4. Create Your First Deployment

1. Click "Deployments" in the navigation
2. Click "New Deployment"
3. Select your VPS
4. Enter deployment name
5. Paste your docker-compose.yml
6. Add any environment variables
7. Click "Deploy"

## Docker Compose Example

```yaml
version: '3.8'

services:
  app:
    image: your-registry/your-app:latest
    networks:
      - caddy
    deploy:
      replicas: 2
      labels:
        caddy: myapp.example.com
        caddy.reverse_proxy: "{{upstreams 3000}}"
        caddy.tls: "internal"
    environment:
      - NODE_ENV=production

networks:
  caddy:
    external: true
    name: caddy_caddy
```

## Caddy Labels

deploy-dashboard uses [caddy-docker-proxy](https://github.com/lucaslorentz/caddy-docker-proxy) for automatic HTTPS and reverse proxy configuration.

Common labels:

```yaml
labels:
  # Basic domain routing
  caddy: myapp.example.com

  # Reverse proxy to container port
  caddy.reverse_proxy: "{{upstreams 3000}}"

  # TLS configuration
  caddy.tls: "internal"  # or your email for Let's Encrypt

  # Multiple domains
  caddy: "myapp.example.com api.example.com"

  # Custom Caddy directives
  caddy.encode: "gzip"
  caddy.header: "X-Custom-Header value"
```

## GitHub Actions Integration

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker image
        # ... build your image ...

      - name: Deploy to VPS
        env:
          VIBBEKUBE_API_KEY: ${{ secrets.VIBBEKUBE_API_KEY }}
          VIBBEKUBE_URL: ${{ secrets.VIBBEKUBE_URL }}
          VPS_ID: ${{ secrets.VPS_ID }}
        run: |
          curl -X POST "${VIBBEKUBE_URL}/api/vps/${VPS_ID}/deploy" \
            -H "Authorization: Bearer ${VIBBEKUBE_API_KEY}" \
            -H "Content-Type: application/json" \
            -d @deploy-config.json
```

See `examples/github-workflow.yml` for a complete example.

## API Reference

### Admin Panel API

#### Authentication

```bash
# Register (first user becomes admin)
POST /api/auth/register
{
  "username": "admin",
  "password": "your-password"
}

# Login
POST /api/auth/login
{
  "username": "admin",
  "password": "your-password"
}

# Logout
POST /api/auth/logout
```

#### VPS Management

```bash
# List all VPS
GET /api/vps

# Add VPS
POST /api/vps
{
  "name": "my-vps-1",
  "ipAddress": "192.168.1.100"
}

# Get VPS details
GET /api/vps/{id}

# Delete VPS
DELETE /api/vps/{id}
```

#### Deployments

```bash
# List deployments
GET /api/deployments

# Create deployment
POST /api/vps/{id}/deploy
{
  "name": "myapp",
  "dockerCompose": "version: '3.8'...",
  "envVars": {
    "KEY": "value"
  }
}

# Get deployment details
GET /api/deployments/{id}

# Get deployment logs
GET /api/deployments/{id}/logs
```

#### API Keys (for CI/CD)

```bash
# List API keys
GET /api/api-keys

# Create API key
POST /api/api-keys
{
  "name": "GitHub Actions"
}

# Delete API key
DELETE /api/api-keys/{id}
```

### Agent API

The agent exposes a local API on port 9090:

```bash
# Health check
GET http://localhost:9090/health

# Deploy (called by admin panel)
POST http://localhost:9090/deploy
Authorization: Bearer {api-key}
{
  "deploymentId": 123,
  "name": "myapp",
  "dockerCompose": "...",
  "envVars": {}
}
```

## Configuration

### Admin Panel

Environment variables (`.env.local`):

```bash
# Session secret (generate with: openssl rand -hex 32)
SESSION_SECRET=your-secret-key-here

# Node environment
NODE_ENV=production

# Port (default: 3000)
PORT=3000
```

### VPS Agent

Configuration file: `/etc/deploy-dashboard-agent/config.json`

```json
{
  "AdminPanelURL": "https://admin.example.com",
  "VPSID": "1",
  "APIKey": "your-api-key",
  "ReportInterval": 30
}
```

## Troubleshooting

### Agent Not Connecting

1. Check agent status:
```bash
systemctl status deploy-dashboard-agent
```

2. View agent logs:
```bash
journalctl -u deploy-dashboard-agent -f
```

3. Verify configuration:
```bash
cat /etc/deploy-dashboard-agent/config.json
```

4. Test network connectivity:
```bash
curl -v https://your-admin-panel.com/api/auth/me
```

### Deployment Failing

1. Check deployment logs in the admin panel

2. Verify Docker Swarm is active:
```bash
docker info | grep Swarm
```

3. Check Docker service status:
```bash
docker service ls
docker service ps {service-name}
```

4. View service logs:
```bash
docker service logs {service-name}
```

### Caddy Not Routing Traffic

1. Check Caddy logs:
```bash
docker service logs caddy_caddy
```

2. Verify Caddy is running:
```bash
docker service ls | grep caddy
```

3. Check labels on your service:
```bash
docker service inspect {service-name} --format='{{json .Spec.Labels}}'
```

4. Ensure network is correct:
```bash
docker network ls | grep caddy
```

## Building from Source

### Admin Panel

```bash
cd admin-panel
npm install
npm run build
```

### Agent

```bash
cd agent
go mod download
go build -o deploy-dashboard-agent main.go
```

For cross-compilation:

```bash
# Linux AMD64
GOOS=linux GOARCH=amd64 go build -o deploy-dashboard-agent-linux-amd64 main.go

# Linux ARM64
GOOS=linux GOARCH=arm64 go build -o deploy-dashboard-agent-linux-arm64 main.go
```

## Security Considerations

1. **Use HTTPS** - Always run the admin panel behind HTTPS
2. **Strong Passwords** - Use strong passwords for admin accounts
3. **API Keys** - Rotate API keys regularly
4. **Firewall** - Restrict admin panel access with firewall rules
5. **Keep Updated** - Regularly update Docker, Caddy, and the agent
6. **VPS Isolation** - Consider network isolation between VPS instances

## Production Deployment

### Admin Panel (Recommended: Deploy on a separate server)

Using systemd:

```bash
# Create service file
sudo nano /etc/systemd/system/deploy-dashboard-admin.service
```

```ini
[Unit]
Description=deploy-dashboard Admin Panel
After=network.target

[Service]
Type=simple
User=deploy-dashboard
WorkingDirectory=/opt/deploy-dashboard-admin
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable deploy-dashboard-admin
sudo systemctl start deploy-dashboard-admin
```

### Using Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name admin.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.example.com;

    ssl_certificate /etc/letsencrypt/live/admin.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [github.com/sivertschou/deploy-dashboard/issues](https://github.com/sivertschou/deploy-dashboard/issues)
- Documentation: [github.com/sivertschou/deploy-dashboard](https://github.com/sivertschou/deploy-dashboard)
