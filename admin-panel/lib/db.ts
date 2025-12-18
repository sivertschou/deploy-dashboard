import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'data', 'deploy-dashboard.db');

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    const fs = require('fs');
    const dataDir = path.join(process.cwd(), 'data');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS vps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      ip_address TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      last_seen INTEGER,
      status TEXT DEFAULT 'offline',
      cpu_usage REAL,
      memory_usage REAL,
      disk_usage REAL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vps_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      docker_compose TEXT NOT NULL,
      env_vars TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      deployed_at INTEGER,
      FOREIGN KEY (vps_id) REFERENCES vps(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deployment_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deployment_id INTEGER NOT NULL,
      timestamp INTEGER DEFAULT (unixepoch()),
      level TEXT DEFAULT 'info',
      message TEXT NOT NULL,
      FOREIGN KEY (deployment_id) REFERENCES deployments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_hash TEXT UNIQUE NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      last_used INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_vps_api_key ON vps(api_key);
    CREATE INDEX IF NOT EXISTS idx_deployments_vps_id ON deployments(vps_id);
    CREATE INDEX IF NOT EXISTS idx_deployment_logs_deployment_id ON deployment_logs(deployment_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
  `);
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
  created_at: number;
}

export interface VPS {
  id: number;
  name: string;
  ip_address: string;
  api_key: string;
  last_seen: number | null;
  status: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  created_at: number;
}

export interface Deployment {
  id: number;
  vps_id: number;
  name: string;
  status: string;
  docker_compose: string;
  env_vars: string | null;
  created_at: number;
  deployed_at: number | null;
}

export interface DeploymentLog {
  id: number;
  deployment_id: number;
  timestamp: number;
  level: string;
  message: string;
}

export interface ApiKey {
  id: number;
  name: string;
  key_hash: string;
  created_at: number;
  last_used: number | null;
}

export const userDb = {
  create: (username: string, password: string, isAdmin: boolean = false) => {
    const database = getDb();
    const passwordHash = bcrypt.hashSync(password, 10);
    const stmt = database.prepare(
      'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)'
    );
    const result = stmt.run(username, passwordHash, isAdmin ? 1 : 0);
    return result.lastInsertRowid;
  },

  findByUsername: (username: string): User | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | undefined;
  },

  findById: (id: number): User | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  },

  count: (): number => {
    const database = getDb();
    const stmt = database.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get() as { count: number };
    return result.count;
  },

  verifyPassword: (user: User, password: string): boolean => {
    return bcrypt.compareSync(password, user.password_hash);
  }
};

export const vpsDb = {
  create: (name: string, ipAddress: string, apiKey: string) => {
    const database = getDb();
    const stmt = database.prepare(
      'INSERT INTO vps (name, ip_address, api_key) VALUES (?, ?, ?)'
    );
    const result = stmt.run(name, ipAddress, apiKey);
    return result.lastInsertRowid;
  },

  findAll: (): VPS[] => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM vps ORDER BY created_at DESC');
    return stmt.all() as VPS[];
  },

  findById: (id: number): VPS | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM vps WHERE id = ?');
    return stmt.get(id) as VPS | undefined;
  },

  findByApiKey: (apiKey: string): VPS | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM vps WHERE api_key = ?');
    return stmt.get(apiKey) as VPS | undefined;
  },

  updateStatus: (id: number, status: string, cpuUsage: number, memoryUsage: number, diskUsage: number) => {
    const database = getDb();
    const stmt = database.prepare(
      'UPDATE vps SET status = ?, cpu_usage = ?, memory_usage = ?, disk_usage = ?, last_seen = unixepoch() WHERE id = ?'
    );
    return stmt.run(status, cpuUsage, memoryUsage, diskUsage, id);
  },

  delete: (id: number) => {
    const database = getDb();
    const stmt = database.prepare('DELETE FROM vps WHERE id = ?');
    return stmt.run(id);
  }
};

export const deploymentDb = {
  create: (vpsId: number, name: string, dockerCompose: string, envVars?: string) => {
    const database = getDb();
    const stmt = database.prepare(
      'INSERT INTO deployments (vps_id, name, docker_compose, env_vars) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(vpsId, name, dockerCompose, envVars || null);
    return result.lastInsertRowid;
  },

  findAll: (): Deployment[] => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM deployments ORDER BY created_at DESC LIMIT 100');
    return stmt.all() as Deployment[];
  },

  findById: (id: number): Deployment | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM deployments WHERE id = ?');
    return stmt.get(id) as Deployment | undefined;
  },

  findByVpsId: (vpsId: number): Deployment[] => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM deployments WHERE vps_id = ? ORDER BY created_at DESC LIMIT 50');
    return stmt.all(vpsId) as Deployment[];
  },

  updateStatus: (id: number, status: string) => {
    const database = getDb();
    const stmt = database.prepare('UPDATE deployments SET status = ?, deployed_at = unixepoch() WHERE id = ?');
    return stmt.run(status, id);
  }
};

export const deploymentLogDb = {
  create: (deploymentId: number, level: string, message: string) => {
    const database = getDb();
    const stmt = database.prepare(
      'INSERT INTO deployment_logs (deployment_id, level, message) VALUES (?, ?, ?)'
    );
    const result = stmt.run(deploymentId, level, message);
    return result.lastInsertRowid;
  },

  findByDeploymentId: (deploymentId: number): DeploymentLog[] => {
    const database = getDb();
    const stmt = database.prepare(
      'SELECT * FROM deployment_logs WHERE deployment_id = ? ORDER BY timestamp ASC'
    );
    return stmt.all(deploymentId) as DeploymentLog[];
  }
};

export const apiKeyDb = {
  create: (name: string, keyHash: string) => {
    const database = getDb();
    const stmt = database.prepare(
      'INSERT INTO api_keys (name, key_hash) VALUES (?, ?)'
    );
    const result = stmt.run(name, keyHash);
    return result.lastInsertRowid;
  },

  findAll: (): ApiKey[] => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM api_keys ORDER BY created_at DESC');
    return stmt.all() as ApiKey[];
  },

  findByKeyHash: (keyHash: string): ApiKey | undefined => {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM api_keys WHERE key_hash = ?');
    return stmt.get(keyHash) as ApiKey | undefined;
  },

  updateLastUsed: (id: number) => {
    const database = getDb();
    const stmt = database.prepare('UPDATE api_keys SET last_used = unixepoch() WHERE id = ?');
    return stmt.run(id);
  },

  delete: (id: number) => {
    const database = getDb();
    const stmt = database.prepare('DELETE FROM api_keys WHERE id = ?');
    return stmt.run(id);
  }
};
