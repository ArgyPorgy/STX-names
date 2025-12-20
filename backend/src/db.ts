import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.url.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

// Initialize database schema
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create usernames table
    await client.query(`
      CREATE TABLE IF NOT EXISTS usernames (
        username VARCHAR(30) PRIMARY KEY,
        owner VARCHAR(255) NOT NULL,
        registered_at BIGINT NOT NULL,
        tx_id VARCHAR(255) NOT NULL,
        block_height INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create transfers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transfers (
        id SERIAL PRIMARY KEY,
        username VARCHAR(30) NOT NULL,
        from_owner VARCHAR(255) NOT NULL,
        to_owner VARCHAR(255) NOT NULL,
        tx_id VARCHAR(255) NOT NULL,
        block_height INTEGER NOT NULL,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (username) REFERENCES usernames(username) ON DELETE CASCADE
      )
    `);

    // Create releases table
    await client.query(`
      CREATE TABLE IF NOT EXISTS releases (
        id SERIAL PRIMARY KEY,
        username VARCHAR(30) NOT NULL,
        previous_owner VARCHAR(255) NOT NULL,
        tx_id VARCHAR(255) NOT NULL,
        block_height INTEGER NOT NULL,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (username) REFERENCES usernames(username) ON DELETE CASCADE
      )
    `);

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_usernames_owner ON usernames(owner);
      CREATE INDEX IF NOT EXISTS idx_usernames_registered_at ON usernames(registered_at);
      CREATE INDEX IF NOT EXISTS idx_transfers_username ON transfers(username);
      CREATE INDEX IF NOT EXISTS idx_transfers_from_owner ON transfers(from_owner);
      CREATE INDEX IF NOT EXISTS idx_transfers_to_owner ON transfers(to_owner);
      CREATE INDEX IF NOT EXISTS idx_releases_username ON releases(username);
      CREATE INDEX IF NOT EXISTS idx_releases_previous_owner ON releases(previous_owner);
    `);

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Database operations
export const db = {
  // Username operations
  async insertUsername(data: {
    username: string;
    owner: string;
    registeredAt: number;
    txId: string;
    blockHeight: number;
  }) {
    const result = await pool.query(
      `INSERT INTO usernames (username, owner, registered_at, tx_id, block_height)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE
       SET owner = EXCLUDED.owner,
           registered_at = EXCLUDED.registered_at,
           tx_id = EXCLUDED.tx_id,
           block_height = EXCLUDED.block_height,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [data.username, data.owner, data.registeredAt, data.txId, data.blockHeight]
    );
    return result.rows[0];
  },

  async getUsername(username: string) {
    const result = await pool.query(
      'SELECT * FROM usernames WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  },

  async getUsernameByOwner(owner: string) {
    const result = await pool.query(
      'SELECT * FROM usernames WHERE owner = $1',
      [owner]
    );
    return result.rows[0] || null;
  },

  async getAllUsernames(limit = 100, offset = 0) {
    const result = await pool.query(
      'SELECT * FROM usernames ORDER BY registered_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  },

  async getUsernamesCount() {
    const result = await pool.query('SELECT COUNT(*) as count FROM usernames');
    return parseInt(result.rows[0].count, 10);
  },

  // Transfer operations
  async insertTransfer(data: {
    username: string;
    fromOwner: string;
    toOwner: string;
    txId: string;
    blockHeight: number;
    timestamp: number;
  }) {
    const result = await pool.query(
      `INSERT INTO transfers (username, from_owner, to_owner, tx_id, block_height, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.username, data.fromOwner, data.toOwner, data.txId, data.blockHeight, data.timestamp]
    );
    return result.rows[0];
  },

  async updateUsernameOwner(username: string, newOwner: string) {
    const result = await pool.query(
      `UPDATE usernames 
       SET owner = $1, updated_at = CURRENT_TIMESTAMP
       WHERE username = $2
       RETURNING *`,
      [newOwner, username]
    );
    return result.rows[0];
  },

  // Release operations
  async insertRelease(data: {
    username: string;
    previousOwner: string;
    txId: string;
    blockHeight: number;
    timestamp: number;
  }) {
    const result = await pool.query(
      `INSERT INTO releases (username, previous_owner, tx_id, block_height, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.username, data.previousOwner, data.txId, data.blockHeight, data.timestamp]
    );
    return result.rows[0];
  },

  async deleteUsername(username: string) {
    const result = await pool.query(
      'DELETE FROM usernames WHERE username = $1 RETURNING *',
      [username]
    );
    return result.rows[0] || null;
  },

  // Event history
  async getRecentEvents(limit = 50) {
    const result = await pool.query(`
      SELECT 
        'registration' as event_type,
        username,
        owner as event_owner,
        tx_id,
        block_height,
        registered_at as timestamp
      FROM usernames
      UNION ALL
      SELECT 
        'transfer' as event_type,
        username,
        to_owner as event_owner,
        tx_id,
        block_height,
        timestamp
      FROM transfers
      UNION ALL
      SELECT 
        'release' as event_type,
        username,
        previous_owner as event_owner,
        tx_id,
        block_height,
        timestamp
      FROM releases
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  },
};




