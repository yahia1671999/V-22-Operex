import { execSync } from 'child_process';

try {
  console.log("Restoring src/components/pages/ from git...");
  execSync('git checkout -- src/components/pages/', { stdio: 'inherit' });
  console.log("Successfully restored all pristine files!");
} catch (e: any) {
  console.error("Failed to restore files via git:", e.message);
}
