import fs from 'fs';
import path from 'path';
import { sqlite } from '../../src/db/index';

const BACKUPS_DIR = path.join(process.cwd(), 'backups');

export interface BackupResult {
  success: boolean;
  timestamp: string;
  backupDir: string;
  files: {
    db: string;
    wal?: string;
    shm?: string;
  };
  sizeBytes: number;
}

/**
 * Perform a safe, live hot-backup of the SQLite database.
 */
export async function performDatabaseBackup(): Promise<BackupResult> {
  console.log(`\n[BACKUP] 🔄 Starting online SQLite database backup process...`);
  
  if (!fs.existsSync(BACKUPS_DIR)) {
    console.log(`[BACKUP] Backups directory doesn't exist. Creating: ${BACKUPS_DIR}`);
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  // Format filename with local/UTC ISO timestamp safely
  const now = new Date();
  const pad = (num: number) => String(num).padStart(2, '0');
  const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  
  const originalDbPath = process.env.DATABASE_PATH || 'sqlite.db';
  const backupDbName = `backup-${timestampStr}.db`;
  const backupDbPath = path.join(BACKUPS_DIR, backupDbName);

  try {
    // Stage 1: Safe online backup of the main SQLite database using better-sqlite3 backup API
    // This resolves WAL changes and yields a consistent self-contained db file
    console.log(`[BACKUP] 📦 Backing up main database to: ${backupDbPath}`);
    await sqlite.backup(backupDbPath);
    console.log(`[BACKUP] ✅ Main database backup completed successfully.`);

    // Stage 2: Copy WAL and SHM if they exist to satisfy all operational specs
    const walPath = `${originalDbPath}-wal`;
    const shmPath = `${originalDbPath}-shm`;
    
    let backedUpWal: string | undefined = undefined;
    let backedUpShm: string | undefined = undefined;

    if (fs.existsSync(walPath)) {
      const backupWalName = `${backupDbName}-wal`;
      const backupWalPath = path.join(BACKUPS_DIR, backupWalName);
      console.log(`[BACKUP] 📦 Copying WAL file to: ${backupWalPath}`);
      fs.copyFileSync(walPath, backupWalPath);
      backedUpWal = backupWalName;
    }

    if (fs.existsSync(shmPath)) {
      const backupShmName = `${backupDbName}-shm`;
      const backupShmPath = path.join(BACKUPS_DIR, backupShmName);
      console.log(`[BACKUP] 📦 Copying SHM file to: ${backupShmPath}`);
      fs.copyFileSync(shmPath, backupShmPath);
      backedUpShm = backupShmName;
    }

    // Measure size of the created backup database
    const backupStats = fs.statSync(backupDbPath);
    const totalSizeBytes = backupStats.size;

    console.log(`[BACKUP] 🎉 Hot-backup completed successfully at ${now.toISOString()}`);
    console.log(`- Base File Size: ${(totalSizeBytes / 1024).toFixed(2)} KB\n`);

    return {
      success: true,
      timestamp: now.toISOString(),
      backupDir: BACKUPS_DIR,
      files: {
        db: backupDbName,
        wal: backedUpWal,
        shm: backedUpShm
      },
      sizeBytes: totalSizeBytes
    };
  } catch (error: any) {
    console.error(`[BACKUP ERROR] ❌ Database backup failed:`, error);
    throw error;
  }
}

/**
 * Initializes weekly/daily scheduled automatic database backups.
 */
export function initializeSchedulerBackup(intervalMs: number = 24 * 60 * 60 * 1000) {
  console.log(`[BACKUP] Scheduled task enabled: running auto-backup every ${intervalMs / (60 * 60 * 1000)} hours.`);
  setInterval(async () => {
    try {
      await performDatabaseBackup();
    } catch (e) {
      console.error(`[BACKUP] Error in automatic scheduled backup:`, e);
    }
  }, intervalMs);
}
