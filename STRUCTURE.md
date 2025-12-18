# Project Structure

This document explains the organization of the deploy-dashboard codebase.

## Repository Layout

```
deploy-dashboard/
├── admin-panel/          # Next.js admin dashboard
├── agent/                # Go agent for VPS instances
├── examples/             # Example configurations
├── README.md            # Main documentation
├── GETTING_STARTED.md   # Setup guide
└── STRUCTURE.md         # This file
```

## Admin Panel (`admin-panel/`)

The admin panel is a Next.js 14+ application using the App Router.

```
admin-panel/
├── app/                  # Next.js app directory
│   ├── api/             # API routes
│   │   ├── auth/        # Authentication endpoints
│   │   │   ├── login/   # POST /api/auth/login
│   │   │   ├── logout/  # POST /api/auth/logout
│   │   │   ├── register/# POST /api/auth/register
│   │   │   └── me/      # GET /api/auth/me
│   │   ├── vps/         # VPS management
│   │   │   ├── route.ts # GET/POST /api/vps
│   │   │   └── [id]/    # VPS-specific endpoints
│   │   ├── deployments/ # Deployment management
│   │   └── api-keys/    # API key management
│   ├── dashboard/       # Dashboard page
│   ├── vps/             # VPS management pages
│   ├── deployments/     # Deployment pages
│   ├── api-keys/        # API keys page
│   ├── login/           # Login/register page
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home (redirects to dashboard)
│   └── globals.css      # Global styles
├── components/          # React components
│   └── DashboardLayout.tsx # Main layout wrapper
├── lib/                 # Utility libraries
│   ├── db.ts           # Database operations
│   ├── session.ts      # Session configuration
│   ├── auth.ts         # Authentication helpers
│   └── crypto.ts       # Cryptographic utilities
├── middleware.ts        # Auth middleware
├── next.config.ts      # Next.js configuration
├── tailwind.config.ts  # Tailwind CSS config
├── Dockerfile          # Container image definition
├── docker-compose.yml  # Docker Compose config
└── package.json        # Node.js dependencies
```

### Key Files

#### `lib/db.ts`
Database schema and operations using better-sqlite3:
- User management
- VPS management
- Deployment tracking
- Deployment logs
- API keys

Tables:
- `users` - Admin users
- `vps` - VPS instances
- `deployments` - Deployment records
- `deployment_logs` - Deployment log entries
- `api_keys` - CI/CD API keys

#### `lib/session.ts`
Session configuration using iron-session:
- Cookie-based sessions
- HTTP-only cookies
- 7-day expiration

#### `lib/auth.ts`
Authentication helpers:
- `getSession()` - Get current session
- `requireAuth()` - Require authenticated user
- `requireAdmin()` - Require admin user
- `verifyVpsApiKey()` - Verify VPS agent API key
- `verifyDeployApiKey()` - Verify CI/CD API key

#### `middleware.ts`
Redirects unauthenticated users to login page.

### API Routes

#### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session
- `GET /api/auth/me` - Get current user

#### VPS Management
- `GET /api/vps` - List all VPS instances
- `POST /api/vps` - Add new VPS
- `GET /api/vps/[id]` - Get VPS details
- `DELETE /api/vps/[id]` - Remove VPS
- `POST /api/vps/[id]/status` - Update VPS status (called by agent)
- `POST /api/vps/[id]/deploy` - Create deployment

#### Deployments
- `GET /api/deployments` - List deployments
- `GET /api/deployments/[id]` - Get deployment details
- `GET /api/deployments/[id]/logs` - Get deployment logs
- `POST /api/deployments/[id]/status` - Update deployment status (called by agent)

#### API Keys
- `GET /api/api-keys` - List API keys (admin only)
- `POST /api/api-keys` - Create API key (admin only)
- `DELETE /api/api-keys/[id]` - Delete API key (admin only)

### Pages

#### `/dashboard`
Overview of all VPS instances and recent deployments.

#### `/vps`
List of all VPS instances with status indicators.

#### `/vps/[id]`
Detailed view of a specific VPS including metrics and deployments.

#### `/deployments`
List of all deployments with ability to create new ones.

#### `/deployments/[id]`
Detailed deployment view with real-time logs.

#### `/api-keys`
Manage API keys for CI/CD integration (admin only).

#### `/login`
Login and registration page.

## Agent (`agent/`)

The agent is a Go application that runs on each VPS instance.

```
agent/
├── main.go              # Main application
├── go.mod              # Go module definition
├── install.sh          # Installation script
└── build.sh            # Build script
```

### Agent Architecture

```
┌─────────────────────────────────────┐
│         deploy-dashboard Agent             │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Status Reporter            │  │
│  │   (runs every 30s)           │  │
│  │   - CPU usage                │  │
│  │   - Memory usage             │  │
│  │   - Disk usage               │  │
│  │   - Docker containers        │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   HTTP API (port 9090)       │  │
│  │   - /health                  │  │
│  │   - /deploy                  │  │
│  └──────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### Key Components

#### Configuration (`/etc/deploy-dashboard-agent/config.json`)
```json
{
  "AdminPanelURL": "https://admin.example.com",
  "VPSID": "1",
  "APIKey": "agent-api-key",
  "ReportInterval": 30
}
```

#### Status Reporter
Runs in a goroutine, reports to admin panel every 30 seconds:
- System metrics (CPU, memory, disk)
- Docker container list
- Online status

#### Deploy Handler
Receives deployment requests from admin panel:
1. Creates temporary working directory
2. Writes docker-compose.yml and .env files
3. Executes `docker stack deploy`
4. Streams logs back to admin panel
5. Updates deployment status

#### Health Endpoint
Simple health check at `http://localhost:9090/health`.

### Installation Script (`install.sh`)

The installation script automates setup:

1. **Check Requirements**
   - Verify root access
   - Detect OS (Ubuntu/Debian)

2. **Install Docker**
   - Add Docker repository
   - Install Docker Engine
   - Enable and start Docker service

3. **Initialize Docker Swarm**
   - Initialize swarm mode
   - Set advertise address

4. **Install Caddy**
   - Add Caddy repository
   - Install Caddy package

5. **Deploy Caddy-Docker-Proxy**
   - Create stack configuration
   - Deploy as Docker service

6. **Install Agent**
   - Download pre-built binary (or compile)
   - Create configuration
   - Create systemd service
   - Start agent

## Examples (`examples/`)

### `docker-compose.yml`
Example Docker Compose configuration with:
- Multi-replica service
- Caddy labels for automatic HTTPS
- External network connection
- Volume management

### `github-workflow.yml`
Complete GitHub Actions workflow:
- Build Docker image
- Push to registry
- Deploy to VPS via API
- Environment variable management

## Data Flow

### Status Updates
```
VPS Agent → Admin Panel API → SQLite Database
(every 30s)   POST /api/vps/[id]/status
```

### Deployment Flow
```
User/CI → Admin Panel → VPS Agent → Docker Swarm
        POST /api/vps/[id]/deploy
                    → POST http://vps:9090/deploy
                                → docker stack deploy
                    ← Status updates
        ← Deployment logs
```

### Authentication Flow
```
Browser → Admin Panel → Iron Session
        POST /api/auth/login
                    → Verify credentials
                    → Create session
        ← Set cookie
```

## Database Schema

### `users`
- `id` - Primary key
- `username` - Unique username
- `password_hash` - Bcrypt hash
- `is_admin` - Admin flag
- `created_at` - Timestamp

### `vps`
- `id` - Primary key
- `name` - VPS name
- `ip_address` - IP address
- `api_key` - Agent API key
- `status` - online/offline
- `cpu_usage` - Current CPU %
- `memory_usage` - Current RAM %
- `disk_usage` - Current disk %
- `last_seen` - Last status update
- `created_at` - Timestamp

### `deployments`
- `id` - Primary key
- `vps_id` - Foreign key to vps
- `name` - Deployment name
- `status` - pending/deploying/deployed/failed
- `docker_compose` - YAML content
- `env_vars` - JSON object
- `created_at` - Timestamp
- `deployed_at` - Deployment completion time

### `deployment_logs`
- `id` - Primary key
- `deployment_id` - Foreign key to deployments
- `timestamp` - Log timestamp
- `level` - info/error/warning
- `message` - Log message

### `api_keys`
- `id` - Primary key
- `name` - Key description
- `key_hash` - SHA256 hash of key
- `created_at` - Timestamp
- `last_used` - Last usage timestamp

## Security Considerations

### Admin Panel
- Session-based authentication
- HTTP-only cookies
- Bcrypt password hashing
- CSRF protection (built into Next.js)
- SQL injection protection (parameterized queries)

### Agent
- API key authentication
- TLS for status reporting
- Isolated deployments
- No shell injection (direct exec.Command usage)

### API Keys
- SHA256 hashing
- Bearer token authentication
- Separate keys for CI/CD and agents

## Development

### Running Locally

**Admin Panel:**
```bash
cd admin-panel
npm install
npm run dev
```

**Agent:**
```bash
cd agent
go run main.go -config config.json
```

### Testing

The project doesn't include automated tests yet. To test:

1. Start admin panel
2. Register an account
3. Add a VPS (use localhost for testing)
4. Start agent with test config
5. Verify status updates
6. Create test deployment

### Building

**Admin Panel:**
```bash
npm run build
```

**Agent:**
```bash
./build.sh
```

## Contributing

When contributing:
1. Follow existing code style
2. Update documentation
3. Test on Ubuntu 20.04+
4. Keep dependencies minimal
5. Maintain backwards compatibility

## License

MIT License - See LICENSE file for details.
