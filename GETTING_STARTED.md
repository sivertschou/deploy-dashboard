# Getting Started with deploy-dashboard

This guide will walk you through setting up deploy-dashboard from scratch.

## Prerequisites

- A server to run the admin panel (can be your local machine, a VPS, or a cloud provider)
- One or more VPS instances running Ubuntu 20.04+ or Debian 11+
- Docker installed (if running admin panel with Docker)
- Node.js 20+ (if running admin panel directly)
- Domain name(s) for your applications (optional, but recommended)

## Step 1: Set Up the Admin Panel

### Option A: Using Node.js Directly

```bash
# Clone the repository
git clone https://github.com/sivertschou/deploy-dashboard.git
cd deploy-dashboard/admin-panel

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and set your SESSION_SECRET
# Generate one with: openssl rand -hex 32
nano .env

# Build the application
npm run build

# Start the admin panel
npm start
```

The admin panel will be available at `http://localhost:3000`.

### Option B: Using Docker

```bash
# Clone the repository
git clone https://github.com/sivertschou/deploy-dashboard.git
cd deploy-dashboard/admin-panel

# Set your SESSION_SECRET
export SESSION_SECRET=$(openssl rand -hex 32)

# Build and start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

### Option C: Deploy to Production (Recommended)

For production, deploy the admin panel behind a reverse proxy with HTTPS:

1. Set up Nginx or Caddy as a reverse proxy
2. Obtain SSL certificate (Let's Encrypt recommended)
3. Configure the reverse proxy to forward to the admin panel
4. Set strong SESSION_SECRET in environment variables

See the README for detailed production deployment instructions.

## Step 2: Create Your Admin Account

1. Open your browser and navigate to the admin panel URL
2. You'll be redirected to the login page
3. Click "Need an account? Register"
4. Enter your username and password
5. Click "Register"

**Important:** The first user to register automatically becomes an admin. Make sure you're the first one!

## Step 3: Add Your First VPS

1. In the admin panel, click "VPS Servers" in the navigation
2. Click "Add VPS Server"
3. Enter a name for your VPS (e.g., "production-1")
4. Enter the IP address of your VPS
5. Click "Add VPS"
6. **Copy the generated API key** - you'll need this in the next step

## Step 4: Install the Agent on Your VPS

SSH into your VPS and run:

```bash
# Download and run the installer
curl -fsSL https://raw.githubusercontent.com/sivertschou/deploy-dashboard/main/agent/install.sh | sudo bash
```

The installer will:
1. Install Docker if not present
2. Initialize Docker Swarm
3. Install and configure Caddy with docker-proxy
4. Install the deploy-dashboard agent

During installation, you'll be prompted for:

- **Admin Panel URL**: Enter the full URL where your admin panel is hosted (e.g., `https://admin.example.com`)
- **VPS ID**: Enter the ID of the VPS you created (found in the URL or VPS list)
- **API Key**: Paste the API key you copied in Step 3

### Manual Installation (if automatic download fails)

If the installer can't download the agent binary:

```bash
# Install Go
sudo apt-get update
sudo apt-get install -y golang-go

# Clone and build the agent
git clone https://github.com/sivertschou/deploy-dashboard.git
cd deploy-dashboard/agent
go build -o deploy-dashboard-agent main.go

# Install the binary
sudo mv deploy-dashboard-agent /usr/local/bin/
sudo chmod +x /usr/local/bin/deploy-dashboard-agent

# Create config directory
sudo mkdir -p /etc/deploy-dashboard-agent

# Create config file
sudo nano /etc/deploy-dashboard-agent/config.json
```

Add this content (replace with your values):

```json
{
  "AdminPanelURL": "https://admin.example.com",
  "VPSID": "1",
  "APIKey": "your-api-key-here",
  "ReportInterval": 30
}
```

Create systemd service:

```bash
sudo nano /etc/systemd/system/deploy-dashboard-agent.service
```

```ini
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
```

Start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable deploy-dashboard-agent
sudo systemctl start deploy-dashboard-agent
```

## Step 5: Verify Connection

1. Go back to the admin panel
2. Click "Dashboard" or "VPS Servers"
3. You should see your VPS with a green "online" status
4. Check the CPU, memory, and disk usage metrics

If the VPS shows as "offline":
- Check agent logs: `sudo journalctl -u deploy-dashboard-agent -f`
- Verify the config: `sudo cat /etc/deploy-dashboard-agent/config.json`
- Test network connectivity from VPS to admin panel

## Step 6: Deploy Your First Application

### Prepare Your Application

1. Containerize your application (create a Dockerfile)
2. Push your image to a container registry (Docker Hub, GHCR, etc.)
3. Create a docker-compose.yml file

Example `docker-compose.yml`:

```yaml
version: '3.8'

services:
  myapp:
    image: your-registry/your-app:latest
    networks:
      - caddy
    deploy:
      replicas: 2
      labels:
        caddy: myapp.example.com
        caddy.reverse_proxy: "{{upstreams 3000}}"
        caddy.tls: your-email@example.com
    environment:
      - NODE_ENV=production

networks:
  caddy:
    external: true
    name: caddy_caddy
```

### Deploy via Admin Panel

1. Click "Deployments" in the navigation
2. Click "New Deployment"
3. Select your VPS from the dropdown
4. Enter a deployment name (e.g., "myapp")
5. Paste your docker-compose.yml
6. Add any environment variables (optional)
7. Click "Deploy"

### Monitor Deployment

1. You'll see the deployment status change to "deploying"
2. Click on the deployment to view logs
3. Once complete, the status will change to "deployed"
4. Your app should now be accessible at the domain specified in your Caddy labels

### Troubleshooting

If deployment fails:
- Check the deployment logs in the admin panel
- SSH into your VPS and check Docker services: `docker service ls`
- View service logs: `docker service logs myapp_myapp`
- Verify Caddy is running: `docker service logs caddy_caddy`

## Step 7: Set Up CI/CD (Optional)

### GitHub Actions Example

1. In the admin panel, go to "API Keys"
2. Click "Create API Key"
3. Name it "GitHub Actions" and copy the key
4. In your GitHub repository, go to Settings > Secrets
5. Add these secrets:
   - `VIBBEKUBE_API_KEY`: The API key you just created
   - `VIBBEKUBE_URL`: Your admin panel URL
   - `VPS_ID`: The ID of your VPS

6. Create `.github/workflows/deploy.yml`:

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

      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Push to registry
        # Push your image to a registry

      - name: Deploy to VPS
        run: |
          curl -X POST "${{ secrets.VIBBEKUBE_URL }}/api/vps/${{ secrets.VPS_ID }}/deploy" \
            -H "Authorization: Bearer ${{ secrets.VIBBEKUBE_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"name":"myapp","dockerCompose":"...","envVars":{}}'
```

See `examples/github-workflow.yml` for a complete example.

## Next Steps

- **Add more VPS instances** to scale your infrastructure
- **Set up monitoring** by checking the dashboard regularly
- **Configure backups** for your application data
- **Set up domain names** and SSL certificates via Caddy labels
- **Explore advanced Caddy configuration** for custom routing rules

## Common Tasks

### Add Another VPS
1. Admin Panel > VPS Servers > Add VPS Server
2. Run installer on new VPS with the generated API key

### Update an Application
1. Push new image to registry
2. Create new deployment with updated docker-compose.yml
3. Docker Swarm will perform rolling update

### View Application Logs
```bash
# SSH into VPS
docker service logs service-name -f
```

### Scale an Application
Update replicas in your docker-compose.yml:
```yaml
deploy:
  replicas: 5  # Increase from 2 to 5
```

### Remove a Deployment
```bash
# SSH into VPS
docker stack rm deployment-name
```

## Getting Help

- **Documentation**: See README.md for comprehensive documentation
- **Troubleshooting**: See README.md troubleshooting section
- **Issues**: Report bugs on GitHub Issues
- **Examples**: Check the `examples/` directory for reference configurations

## Security Best Practices

1. **Use HTTPS** for the admin panel in production
2. **Use strong passwords** for admin accounts
3. **Rotate API keys** regularly
4. **Keep software updated** (Docker, Caddy, Agent)
5. **Use firewall rules** to restrict access
6. **Enable SSL/TLS** for your applications via Caddy
7. **Store secrets** in environment variables, not in docker-compose files

## What's Next?

Now that you have deploy-dashboard running:

- Deploy your first application
- Set up automated deployments with GitHub Actions
- Monitor your VPS metrics from the dashboard
- Explore advanced Caddy configurations
- Scale your applications across multiple VPS instances

Happy deploying!
