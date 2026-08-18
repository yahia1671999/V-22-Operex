
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './src/db/schema';
import { eq } from 'drizzle-orm';

const dbPath = './sqlite.db';
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

async function check() {
  const email = 'moy915996@gmail.com';
  const users = await db.select().from(schema.appUsers).where(eq(schema.appUsers.email, email));
  const emps = await db.select().from(schema.employees).where(eq(schema.employees.email, email));
  
  console.log('--- Check for moy915996@gmail.com ---');
  console.log('AppUsers:', JSON.stringify(users, null, 2));
  console.log('Employees:', JSON.stringify(emps, null, 2));

  const allUsers = await db.select().from(schema.appUsers);
  console.log('--- All AppUsers ---');
  console.log(allUsers.map(u => ({ id: u.id, email: u.email, role: u.role, employeeId: u.employeeId })));
}

check();
