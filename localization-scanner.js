const fs = require('fs');
const path = require('path');

const ARABIC_REGEX = /[\u0600-\u06FF]/;
const HARDCODED_JSX_ENG_REGEX = />\s*([A-Za-z0-9\s,\.\-!\?\(\)&]+)\s*</g;

function walkDir(dir, files = []) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip node_modules and built folders
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== 'build') {
        walkDir(fullPath, files);
      }
    } else {
      if (/\.(tsx|ts|jsx|js)$/.test(file)) {
        files.push(fullPath);
      }
    }
  });
  return files;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const results = [];

  // Simple heuristic-based scanning
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Skip comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

    // Check for direct Arabic text
    if (ARABIC_REGEX.test(line)) {
      // Exclude translation dictionaries themselves in LanguageContext.tsx or similar
      if (filePath.includes('LanguageContext.tsx') && lineNum < 140) {
        // This is the arabic dictionary itself, skip
        return;
      }
      // Skip log lines
      if (trimmed.startsWith('console.')) return;

      results.push({
        lineNum,
        text: trimmed,
        type: 'Arabic',
        recommendation: `Wrap with t() or define a Translation Key under corresponding module prefix (e.g. selfService.dashboard.foo)`
      });
      return;
    }

    // Check for hardcoded English inside JSX tags (e.g., >Some Text<)
    let match;
    while ((match = HARDCODED_JSX_ENG_REGEX.exec(line)) !== null) {
      const text = match[1].trim();
      // Skip numbers, spaces, single characters, or boolean-like texts
      if (!text || /^\d+$/.test(text) || text.length <= 1) continue;
      if (['true', 'false', 'ok', 'OK', 'id', 'h', 'm', 's', 'px', 'en', 'ar', 'Draft', 'Pending', 'Approved', 'Rejected', 'Locked'].includes(text)) continue;

      results.push({
        lineNum,
        text: match[0],
        type: 'JSX English',
        recommendation: `Extract "${text}" to translation dictionary and replace with {t('...')}`
      });
    }
  });

  return results;
}

function runScanner() {
  const srcDir = path.join(__dirname, 'src');
  if (!fs.existsSync(srcDir)) {
    console.log('Error: src directory not found');
    return;
  }

  const files = walkDir(srcDir);
  console.log(`Scanning ${files.length} files in /src...\n`);

  const fileReports = {};
  let totalArabic = 0;
  let totalEnglish = 0;

  files.forEach(file => {
    const relativePath = path.relative(__dirname, file);
    const results = scanFile(file);
    if (results.length > 0) {
      fileReports[relativePath] = results;
      results.forEach(r => {
        if (r.type === 'Arabic') totalArabic++;
        if (r.type === 'JSX English') totalEnglish++;
      });
    }
  });

  // Print summary to file
  const reportPath = path.join(__dirname, 'localization-report.txt');
  let reportContent = `=== SALARIX LOCALIZATION COMPLIANCE REPORT ===\n`;
  reportContent += `Generated at: ${new Date().toISOString()}\n`;
  reportContent += `Total files scanned: ${files.length}\n`;
  reportContent += `Total hardcoded Arabic lines found: ${totalArabic}\n`;
  reportContent += `Total hardcoded English JSX structures: ${totalEnglish}\n\n`;

  for (const [file, items] of Object.entries(fileReports)) {
    reportContent += `--------------------------------------------------\n`;
    reportContent += `FILE: ${file} (${items.length} issues)\n`;
    reportContent += `--------------------------------------------------\n`;
    items.forEach(item => {
      reportContent += `  Line ${item.lineNum}: [${item.type}] "${item.text.substring(0, 100)}"\n`;
      reportContent += `    Recommendation: ${item.recommendation}\n\n`;
    });
  }

  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`Scan completed successfully!`);
  console.log(`Total Arabic issues: ${totalArabic}`);
  console.log(`Total English JSX issues: ${totalEnglish}`);
  console.log(`Detailed report written to: ${reportPath}`);
}

runScanner();
