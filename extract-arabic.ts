import fs from 'fs';
import path from 'path';

const ARABIC_REGEX = /[\u0600-\u06FF]+/g;

function walkDir(dir: string, files: string[] = []): string[] {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        walkDir(fullPath, files);
      }
    } else {
      if (/\.(tsx|ts)$/.test(file)) {
        files.push(fullPath);
      }
    }
  });
  return files;
}

function extractArabicFromPages() {
  const pagesDir = path.join(process.cwd(), 'src', 'components', 'pages');
  const files = walkDir(pagesDir);
  const allStrings = new Set<string>();

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Search for literals in TSX files
    // Find double quotes (e.g. "جاري التحميل")
    const doubleQuotes = content.match(/"([^"\r\n]*[\u0600-\u06FF]+[^"\r\n]*)"/g);
    if (doubleQuotes) doubleQuotes.forEach(s => allStrings.add(s.slice(1, -1).trim()));

    // Find single quotes (e.g. 'جاري التحميل')
    const singleQuotes = content.match(/'([^'\r\n]*[\u0600-\u06FF]+[^'\r\n]*)'/g);
    if (singleQuotes) singleQuotes.forEach(s => allStrings.add(s.slice(1, -1).trim()));

    // Find backticks (e.g. `جاري التحميل`)
    const backticks = content.match(/`([^`\r\n]*[\u0600-\u06FF]+[^`\r\n]*)`/g);
    if (backticks) backticks.forEach(s => allStrings.add(s.slice(1, -1).trim()));

    // Find plain JSX text (e.g. >جاري التحميل<)
    const jsxTexts = content.match(/>([^<>\r\n]*[\u0600-\u06FF]+[^<>\r\n]*)</g);
    if (jsxTexts) jsxTexts.forEach(s => allStrings.add(s.slice(1, -1).trim()));
  });

  const sortedStrings = Array.from(allStrings).sort((a, b) => b.length - a.length);
  fs.writeFileSync('extracted_arabic.json', JSON.stringify(sortedStrings, null, 2), 'utf-8');
  console.log(`Found ${sortedStrings.length} unique Arabic/bilingual string sequences! Saved to extracted_arabic.json`);
}

extractArabicFromPages();
