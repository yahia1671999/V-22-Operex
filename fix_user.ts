
import { db } from './src/db/index';
import * as schema from './src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

async function fix() {
  const email = 'moy915996@gmail.com';
  console.log('Checking user:', email);
  
  const users = await db.select().from(schema.appUsers).where(eq(schema.appUsers.email, email));
  if (users.length > 0) {
    const user = users[0];
    console.log('Found user:', user.name);
    
    const emps = await db.select().from(schema.employees).where(eq(schema.employees.email, email));
    if (emps.length === 0) {
      console.log('Adding employee record for', email);
      await db.insert(schema.employees).values({
        id: crypto.randomUUID(),
        employeeId: 'EMP-' + Math.floor(1000 + Math.random() * 9000),
        name: user.name || 'User',
        email: user.email,
        jobTitle: 'Developer',
        status: 'Active'
      });
      console.log('Employee record added.');
    } else {
      console.log('Employee record already exists.');
    }
  } else {
    console.log('User not found in appUsers. Creating dummy user for testing.');
    const userId = crypto.randomUUID();
    await db.insert(schema.appUsers).values({
      id: userId,
      email: email,
      name: 'Test user',
      role: 'Employee',
      status: 'Active'
    });
    await db.insert(schema.employees).values({
      id: crypto.randomUUID(),
      employeeId: 'EMP-TEST',
      name: 'Test User',
      email: email,
      jobTitle: 'Tester',
      status: 'Active'
    });
    console.log('Test user and employee created.');
  }
}

fix().catch(console.error);
