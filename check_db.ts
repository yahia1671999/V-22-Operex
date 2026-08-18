import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './src/db/schema';

async function main() {
  for (const dbPath of ['./server/database/sqlite.db', './sqlite.db']) {
    console.log('--- Checking DB at:', dbPath, fs.existsSync(dbPath) ? '(Exists)' : '(Not found)');
    if (!fs.existsSync(dbPath)) continue;
    try {
      const sqlite = new Database(dbPath);
      const db = drizzle(sqlite, { schema });
      
      console.log('Executing migrations...');
      await migrate(db, { migrationsFolder: './drizzle' });
      console.log('Migrations executed successfully!');

      const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log('Tables:', JSON.stringify(tables, null, 2));
      const info = sqlite.prepare("PRAGMA table_info(employees)").all();
      console.log('Employees Columns:', JSON.stringify(info, null, 2));
      const userInfo = sqlite.prepare("PRAGMA table_info(app_users)").all();
      console.log('App Users Columns:', JSON.stringify(userInfo, null, 2));
      sqlite.close();
    } catch (err: any) {
      console.error('Error opening/migrating db:', err.message);
      if (err.cause) {
        console.error('Underlying cause:', err.cause);
      } else {
        console.error('Full Error:', err);
      }
    }
  }
}

main().catch(console.error);


