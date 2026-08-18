import 'dotenv/config';
import { db } from './src/db/index';
import { employees } from './src/db/schema';

async function test() {
  try {
    console.log('Testing employee select...');
    const results = await db.select().from(employees);
    console.log('Results length:', results.length);
    console.log('First result (sanitized):', results[0] ? { ...results[0], id: '...' } : 'None');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

test();
