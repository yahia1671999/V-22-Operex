import 'dotenv/config';
import { db } from './index';
import * as schema from './schema';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    const hashedPassword = await bcrypt.hash('admin', 10);

    // 1. Create Admin User
    await db.insert(schema.appUsers).values({
      id: 'admin',
      email: 'admin@admin.com',
      name: 'Super Admin',
      role: 'Admin',
      password: hashedPassword,
      status: 'Active',
      permissions: JSON.stringify({
        all: true,
        view: true,
        create: true,
        edit: true,
        delete: true,
        export: true
      })
    }).onConflictDoUpdate({
      target: schema.appUsers.id,
      set: {
        password: hashedPassword,
        role: 'Admin',
        status: 'Active'
      }
    });

    console.log('✅ Admin user created: admin@admin.com / admin');

    // 2. Mission Types
    const mTypes = [
      { id: 'mt-1', name: 'مأمورية داخلية', allowances: [{ id: 'a1', name: 'بدل مواصلات', amount: 50, type: 'Daily' }] },
      { id: 'mt-2', name: 'مأمورية خارجية', allowances: [{ id: 'a2', name: 'بدل سفر', amount: 200, type: 'Once' }, { id: 'a3', name: 'إعاشة', amount: 100, type: 'Daily' }] },
      { id: 'mt-3', name: 'زيارة موقع', allowances: [] },
    ];
    for (const t of mTypes) {
      await db.insert(schema.missionTypes).values(t).onConflictDoNothing();
    }
    console.log('✅ Mission types seeded');

    // 3. Projects
    const projects = [
      { id: 'p-1', name: 'مشروع تطوير النظام المالي', clientName: 'شركة التقنية', status: 'Active' },
      { id: 'p-2', name: 'مشروع أتمتة الموارد البشرية', clientName: 'وزارة العمل', status: 'Active' },
    ];
    for (const p of projects) {
      await db.insert(schema.projects).values(p as any).onConflictDoNothing();
    }
    console.log('✅ Projects seeded');

    // 4. Default System Settings
    await db.insert(schema.systemSettings).values({
      id: 'global',
      organizationName: 'Paradise AI',
      logoUrl: '',
    }).onConflictDoNothing();
    console.log('✅ Default system settings seeded');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
