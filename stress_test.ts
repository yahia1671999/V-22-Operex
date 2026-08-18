async function stressTest() {
    const paths = [
        'employees', 'transactions', 'payroll-runs', 'allowance-types', 
        'app-users', 'attendance-records', 'attendance-devices', 
        'attendance-shifts', 'absence-types', 'absence-records',
        'mission-types', 'missions', 'projects', 'project-tasks',
        'admin-departments', 'leave-requests', 'system-settings',
        'employee/dashboard'
    ];

    console.log(`Starting stress test with ${paths.length} requests...`);
    
    // We need a token if it's protected, but let's see if we get ANY response (even 401/403)
    // Actually, local requests don't have a token unless we login.
    // Let's just see if they get a response.
    
    const results = await Promise.all(paths.map(async (path) => {
        try {
            const start = Date.now();
            const res = await fetch(`http://localhost:3000/api/${path}`);
            const duration = Date.now() - start;
            return { path, status: res.status, duration };
        } catch (e: any) {
            return { path, error: e.message };
        }
    }));

    console.table(results);
    process.exit(0);
}

stressTest();
