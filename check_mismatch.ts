
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './src/db/schema';

const dbPath = './server/database/sqlite.db';
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

async function check() {
  const users = await db.select().from(schema.appUsers);
  const emps = await db.select().from(schema.employees);
  
  console.log('--- Users ---');
  console.log(users.map(u => u.email));
  
  console.log('--- Employees ---');
  console.log(emps.map(e => e.email));
  
  const common = users.filter(u => emps.some(e => e.email === u.email));
  console.log('--- Matching Emails ---');
  console.log(common.map(u => u.email));
}

check();
