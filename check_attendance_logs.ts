
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './src/db/schema';

const dbPath = './server/database/sqlite.db';
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

async function check() {
  try {
    const logs = await db.select().from(schema.attendanceLogs);
    console.log('Recent Attendance Logs:', JSON.stringify(logs.slice(-5), null, 2));
  } catch (e) {
    console.error('ERROR:', e);
  }
}

check();
