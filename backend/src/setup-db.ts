import { initializeDatabase } from './db.js';
import { pool } from './db.js';

async function main() {
  try {
    console.log('Setting up database schema...');
    await initializeDatabase();
    console.log('Database setup complete!');
    
    // Test connection
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0]);
    
    process.exit(0);
  } catch (error: any) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

main();




