# Deploying deploy-dashboard Admin Panel to a VPS

This guide explains how to deploy the deploy-dashboard admin panel to a production VPS.

## Prerequisites

- A VPS with Ubuntu 20.04+ or Debian 11+ (this will host the admin panel)
- Root or sudo access
- A domain name pointing to your VPS (recommended)
- SSH access to your VPS

## Architecture Overview

```
Internet
    ↓
Your Domain (admin.example.com)
    ↓
VPS (Admin Panel Server)
    ├── Nginx/Caddy (Reverse Proxy with HTTPS)
    └── Admin Panel (Node.js on port 3000)
```

## Option 1: Deploy with Docker (Recommended)

This is the easiest method for production deployment.

### Step 1: Prepare Your VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose
apt-get install -y docker-compose-plugin
```

### Step 2: Clone and Configure

```bash
# Create directory
mkdir -p /opt/deploy-dashboard
cd /opt/deploy-dashboard

# Clone repository
git clone https://github.com/sivertschou/deploy-dashboard.git .
cd admin-panel

# Generate session secret
export SESSION_SECRET=$(openssl rand -hex 32)

# Create .env file
cat > .env <<EOF
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=3000
EOF

# Make sure .env is secure
chmod 600 .env
```

### Step 3: Build and Start

```bash
# Build and start the container
docker compose up -d

# Check logs
docker compose logs -f

# Verify it's running
curl http://localhost:3000
```

### Step 4: Set Up Reverse Proxy with HTTPS

#### Option A: Using Caddy (Easiest)

```bash
# Install Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# Create Caddyfile
cat > /etc/caddy/Caddyfile <<EOF
admin.example.com {
    reverse_proxy localhost:3000
}
EOF

# Restart Caddy
systemctl restart caddy
systemctl enable caddy
```

Caddy will automatically obtain and renew SSL certificates from Let's Encrypt!

#### Option B: Using Nginx

```bash
# Install Nginx and Certbot
apt-get install -y nginx certbot python3-certbot-nginx

# Create Nginx config
cat > /etc/nginx/sites-available/deploy-dashboard <<EOF
server {
    listen 80;
    server_name admin.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/deploy-dashboard /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Remove default site

# Test config
nginx -t

# Restart Nginx
systemctl restart nginx

# Get SSL certificate
certbot --nginx -d admin.example.com
```

### Step 5: Configure Firewall

```bash
# Allow HTTP, HTTPS, and SSH
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Step 6: Set Up Systemd Service (Optional but Recommended)

Create a systemd service to ensure the admin panel restarts on reboot:

```bash
cat > /etc/systemd/system/deploy-dashboard-admin.service <<EOF
[Unit]
Description=deploy-dashboard Admin Panel
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/deploy-dashboard/admin-panel
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable service
systemctl daemon-reload
systemctl enable deploy-dashboard-admin
```

### Step 7: Verify Deployment

1. Visit `https://admin.example.com` in your browser
2. You should see the deploy-dashboard login page
3. Register your admin account (first user becomes admin)
4. You're ready to add VPS servers!

## Option 2: Deploy Without Docker

If you prefer running Node.js directly:

### Step 1: Install Node.js

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### Step 2: Set Up Application

```bash
# Create app directory
mkdir -p /opt/deploy-dashboard
cd /opt/deploy-dashboard

# Clone repository
git clone https://github.com/sivertschou/deploy-dashboard.git .
cd admin-panel

# Install dependencies
npm install

# Create .env file
cat > .env <<EOF
SESSION_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
PORT=3000
EOF

# Build application
npm run build
```

### Step 3: Create Systemd Service

```bash
# Create service file
cat > /etc/systemd/system/deploy-dashboard-admin.service <<EOF
[Unit]
Description=deploy-dashboard Admin Panel
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/deploy-dashboard/admin-panel
Environment="NODE_ENV=production"
EnvironmentFile=/opt/deploy-dashboard/admin-panel/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown -R www-data:www-data /opt/deploy-dashboard

# Start service
systemctl daemon-reload
systemctl enable deploy-dashboard-admin
systemctl start deploy-dashboard-admin

# Check status
systemctl status deploy-dashboard-admin
```

### Step 4: Set Up Reverse Proxy

Follow Step 4 from Option 1 above (Caddy or Nginx).

## Option 3: Deploy on Same VPS as Your Apps

You can run the admin panel on one of your managed VPS servers:

```bash
# On your VPS
cd /opt
git clone https://github.com/sivertschou/deploy-dashboard.git
cd deploy-dashboard/admin-panel

# Create docker-compose with Caddy labels
cat > docker-compose.yml <<EOF
version: '3.8'

services:
  admin:
    build: .
    environment:
      - SESSION_SECRET=${SESSION_SECRET}
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    networks:
      - caddy
    deploy:
      labels:
        caddy: admin.example.com
        caddy.reverse_proxy: "{{upstreams 3000}}"
        caddy.tls: "your-email@example.com"

networks:
  caddy:
    external: true
    name: caddy_caddy
EOF

# Deploy as a stack
docker stack deploy -c docker-compose.yml deploy-dashboard-admin
```

## Post-Deployment Steps

### 1. Create Admin Account

Visit your admin panel URL and register the first account (becomes admin automatically).

### 2. Secure Your Installation

```bash
# Set up automatic security updates
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Set up fail2ban for SSH protection
apt-get install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### 3. Set Up Backups

```bash
# Create backup script
cat > /opt/deploy-dashboard/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/deploy-dashboard-backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp /opt/deploy-dashboard/admin-panel/data/deploy-dashboard.db $BACKUP_DIR/deploy-dashboard_$DATE.db

# Keep only last 7 days
find $BACKUP_DIR -name "deploy-dashboard_*.db" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/deploy-dashboard/backup.sh

# Add to crontab (daily at 2am)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/deploy-dashboard/backup.sh") | crontab -
```

### 4. Set Up Monitoring (Optional)

```bash
# View admin panel logs
docker compose logs -f  # If using Docker
journalctl -u deploy-dashboard-admin -f  # If using systemd

# Monitor resources
htop

# Check disk space
df -h
```

## Maintenance

### Updating the Admin Panel

```bash
cd /opt/deploy-dashboard
git pull

# If using Docker
cd admin-panel
docker compose down
docker compose build
docker compose up -d

# If using systemd
cd admin-panel
npm install
npm run build
systemctl restart deploy-dashboard-admin
```

### Backup and Restore Database

```bash
# Backup
cp /opt/deploy-dashboard/admin-panel/data/deploy-dashboard.db ~/backup.db

# Restore
cp ~/backup.db /opt/deploy-dashboard/admin-panel/data/deploy-dashboard.db
```

### View Logs

```bash
# Docker
docker compose -f /opt/deploy-dashboard/admin-panel/docker-compose.yml logs -f

# Systemd
journalctl -u deploy-dashboard-admin -f

# Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Caddy
journalctl -u caddy -f
```

## Troubleshooting

### Admin Panel Won't Start

```bash
# Check if port 3000 is in use
netstat -tlnp | grep 3000

# Check Docker logs
docker compose logs

# Check systemd logs
journalctl -u deploy-dashboard-admin -n 50
```

### Can't Access Admin Panel

```bash
# Check if service is running
systemctl status deploy-dashboard-admin  # or docker ps

# Check firewall
ufw status

# Check Nginx/Caddy
systemctl status nginx  # or caddy
nginx -t  # Test Nginx config
```

### SSL Certificate Issues

```bash
# Renew certificate manually
certbot renew

# Check certificate status
certbot certificates

# Caddy automatically renews - check logs
journalctl -u caddy -f
```

### Database Issues

```bash
# Check database file
ls -lh /opt/deploy-dashboard/admin-panel/data/

# Check permissions
chown -R www-data:www-data /opt/deploy-dashboard/admin-panel/data/

# Test database
sqlite3 /opt/deploy-dashboard/admin-panel/data/deploy-dashboard.db "SELECT * FROM users;"
```

## Security Best Practices

1. **Use HTTPS** - Always use SSL/TLS in production
2. **Strong Passwords** - Enforce strong admin passwords
3. **Firewall** - Only allow necessary ports
4. **Updates** - Keep system and packages updated
5. **Backups** - Automate daily database backups
6. **Monitoring** - Set up log monitoring
7. **Fail2ban** - Protect SSH access
8. **Non-root** - Run application as non-root user

## Environment Variables Reference

```bash
# Required
SESSION_SECRET=<32+ character random string>

# Optional
NODE_ENV=production
PORT=3000
```

## DNS Configuration

Point your domain to your VPS:

```
Type: A
Name: admin (or @)
Value: YOUR_VPS_IP
TTL: 3600
```

Wait for DNS propagation (can take up to 48 hours, usually much faster).

## Cost Considerations

**Minimum VPS Requirements for Admin Panel:**
- 1 CPU core
- 512 MB RAM (1GB recommended)
- 10 GB disk space
- Ubuntu 20.04 or Debian 11

**Estimated Monthly Cost:**
- DigitalOcean: $6/month (Basic Droplet)
- Linode: $5/month (Nanode)
- Vultr: $5/month (Cloud Compute)
- Hetzner: €4.51/month (CX11)

## Next Steps

After deploying the admin panel:

1. Register your admin account
2. Add your first VPS using the admin panel
3. Install the agent on that VPS using the provided install script
4. Deploy your first application
5. Set up GitHub Actions for automated deployments

## Need Help?

- Check the main [README.md](./README.md) for full documentation
- Review [GETTING_STARTED.md](./GETTING_STARTED.md) for setup guide
- See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for commands

Happy deploying! 🚀
