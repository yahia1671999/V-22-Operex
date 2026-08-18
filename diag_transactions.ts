
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './src/db/schema';
import path from 'path';

const dbPath = './server/database/sqlite.db';
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

async function diag() {
  try {
    console.log('Fetching transactions...');
    const results = await db.select().from(schema.transactions);
    console.log('Transactions length:', results.length);
    if (results.length > 0) {
        console.log('First record sample:', JSON.stringify(results[0], null, 2));
    }
  } catch (e) {
    console.error('DIAG ERROR:', e);
  }
}

diag();
