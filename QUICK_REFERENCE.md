# deploy-dashboard Quick Reference

## Installation Commands

### Admin Panel
```bash
# Install and run
cd admin-panel
npm install
npm run build
npm start

# Or with Docker
docker-compose up -d
```

### Agent (on VPS)
```bash
# Automated installation
curl -fsSL https://raw.githubusercontent.com/sivertschou/deploy-dashboard/main/agent/install.sh | sudo bash

# Manual installation
go build -o deploy-dashboard-agent main.go
sudo mv deploy-dashboard-agent /usr/local/bin/
```

## Configuration

### Admin Panel `.env`
```bash
SESSION_SECRET=your-32-character-secret
NODE_ENV=production
PORT=3000
```

### Agent `/etc/deploy-dashboard-agent/config.json`
```json
{
  "AdminPanelURL": "https://admin.example.com",
  "VPSID": "1",
  "APIKey": "your-api-key",
  "ReportInterval": 30
}
```

## API Endpoints

### Authentication
```bash
POST /api/auth/register    # Register new user
POST /api/auth/login       # Login
POST /api/auth/logout      # Logout
GET  /api/auth/me          # Get current user
```

### VPS Management
```bash
GET    /api/vps            # List all VPS
POST   /api/vps            # Add new VPS
GET    /api/vps/:id        # Get VPS details
DELETE /api/vps/:id        # Delete VPS
POST   /api/vps/:id/deploy # Create deployment
```

### Deployments
```bash
GET /api/deployments          # List deployments
GET /api/deployments/:id      # Get deployment
GET /api/deployments/:id/logs # Get logs
```

### API Keys
```bash
GET    /api/api-keys     # List keys (admin)
POST   /api/api-keys     # Create key (admin)
DELETE /api/api-keys/:id # Delete key (admin)
```

## Docker Compose Template

```yaml
version: '3.8'

services:
  app:
    image: your-image:latest
    networks:
      - caddy
    deploy:
      replicas: 2
      labels:
        caddy: myapp.example.com
        caddy.reverse_proxy: "{{upstreams 3000}}"
        caddy.tls: "your-email@example.com"

networks:
  caddy:
    external: true
    name: caddy_caddy
```

## Caddy Labels Reference

```yaml
# Basic domain
caddy: myapp.example.com

# Reverse proxy
caddy.reverse_proxy: "{{upstreams 3000}}"

# TLS/HTTPS
caddy.tls: "your-email@example.com"  # Let's Encrypt
caddy.tls: "internal"                # Self-signed

# Multiple domains
caddy: "app.example.com api.example.com"

# Custom directives
caddy.encode: "gzip"
caddy.header: "X-Custom-Header value"
caddy.ratelimit: "100/m"
```

## Common Commands

### Admin Panel
```bash
# Start
npm start

# Development mode
npm run dev

# Build
npm run build

# With Docker
docker-compose up -d
docker-compose logs -f
docker-compose down
```

### Agent
```bash
# Check status
sudo systemctl status deploy-dashboard-agent

# View logs
sudo journalctl -u deploy-dashboard-agent -f

# Restart
sudo systemctl restart deploy-dashboard-agent

# Stop
sudo systemctl stop deploy-dashboard-agent
```

### Docker Commands (on VPS)
```bash
# List services
docker service ls

# View service logs
docker service logs service-name -f

# Scale service
docker service scale service-name=5

# Remove stack
docker stack rm stack-name

# List stacks
docker stack ls

# Inspect service
docker service inspect service-name

# View Caddy logs
docker service logs caddy_caddy -f
```

## Troubleshooting

### Agent not connecting
```bash
# Check agent status
sudo systemctl status deploy-dashboard-agent

# View logs
sudo journalctl -u deploy-dashboard-agent -f

# Test connectivity
curl -v https://your-admin-panel.com

# Check config
sudo cat /etc/deploy-dashboard-agent/config.json
```

### Deployment failing
```bash
# Check deployment logs in admin panel
# Or on VPS:
docker service ls
docker service ps service-name
docker service logs service-name -f
```

### Caddy not routing
```bash
# Check Caddy logs
docker service logs caddy_caddy -f

# Verify Caddy is running
docker service ls | grep caddy

# Check service labels
docker service inspect service-name --format='{{json .Spec.Labels}}'

# Verify network
docker network ls | grep caddy
```

### Database issues
```bash
# Location: admin-panel/data/deploy-dashboard.db
# Backup database
cp admin-panel/data/deploy-dashboard.db backup.db

# Check database
sqlite3 admin-panel/data/deploy-dashboard.db "SELECT * FROM users;"
```

## Environment Variables

### Required for Admin Panel
- `SESSION_SECRET` - Session encryption key (32+ chars)

### Optional for Admin Panel
- `NODE_ENV` - Environment (production/development)
- `PORT` - Server port (default: 3000)

## Security Checklist

- [ ] HTTPS enabled for admin panel
- [ ] Strong SESSION_SECRET set
- [ ] Strong admin password
- [ ] Firewall configured
- [ ] API keys rotated regularly
- [ ] Agent runs as non-root (when possible)
- [ ] Database backed up regularly
- [ ] Docker and Caddy updated regularly

## Port Usage

- **3000** - Admin panel (default)
- **9090** - Agent API (VPS local only)
- **80** - Caddy HTTP (VPS)
- **443** - Caddy HTTPS (VPS)

## File Locations

### Admin Panel
- Config: `.env` or `.env.local`
- Database: `data/deploy-dashboard.db`
- Logs: stdout (or via process manager)

### Agent
- Config: `/etc/deploy-dashboard-agent/config.json`
- Binary: `/usr/local/bin/deploy-dashboard-agent`
- Logs: `journalctl -u deploy-dashboard-agent`
- Service: `/etc/systemd/system/deploy-dashboard-agent.service`

### Docker (on VPS)
- Caddy config: `/opt/caddy/docker-compose.yml`
- Docker volumes: `/var/lib/docker/volumes/`

## Deployment Workflow

1. **Build** image
2. **Push** to registry
3. **Deploy** via admin panel or API
4. **Monitor** in dashboard
5. **Check** logs if needed

## GitHub Actions Secrets

```
VIBBEKUBE_API_KEY - API key from admin panel
VIBBEKUBE_URL     - Admin panel URL
VPS_ID            - Target VPS ID
```

## Quick Start (New VPS)

```bash
# 1. On VPS
curl -fsSL https://raw.githubusercontent.com/sivertschou/deploy-dashboard/main/agent/install.sh | sudo bash

# 2. In admin panel
# Add VPS, copy API key

# 3. During VPS install
# Enter: admin URL, VPS ID, API key

# 4. Deploy app
# Create deployment in admin panel
```

## Monitoring Metrics

- CPU usage (%)
- Memory usage (%)
- Disk usage (%)
- Last seen timestamp
- Deployment status
- Service health

## Support Resources

- README.md - Full documentation
- GETTING_STARTED.md - Setup guide
- STRUCTURE.md - Code organization
- examples/ - Reference configs
- GitHub Issues - Bug reports

## Version Compatibility

- Node.js: 20+
- Go: 1.21+
- Docker: 20.10+
- Ubuntu: 20.04+
- Debian: 11+

## License

MIT License
