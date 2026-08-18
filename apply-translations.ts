import fs from 'fs';
import path from 'path';

const PAGES_DIR = path.join(process.cwd(), 'src', 'components', 'pages');

// Match Arabic characters excluding those wrapped in t("...")
const ARABIC_JSX_TEXT_REGEX = />([^<>{}]*[\u0600-\u06FF]+[^<>{}]*)</g;
const ARABIC_ATTR_DOUBLE_QUOTE = /(placeholder|title|description|label)="([^"]*[\u0600-\u06FF]+[^"]*)"/g;
const ARABIC_ATTR_SINGLE_QUOTE = /(placeholder|title|description|label)='([^']*[\u0600-\u06FF]+[^']*)'/g;

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

function processPageFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // 1. Inject import useLanguage if not present (excluding LanguageContext itself)
  if (!filePath.includes('LanguageContext.tsx') && !content.includes('useLanguage')) {
    // Find the last import line and insert ours
    const lines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIdx = i;
      }
    }
    if (lastImportIdx !== -1) {
      lines.splice(lastImportIdx + 1, 0, `import { useLanguage } from '../../contexts/LanguageContext';`);
      content = lines.join('\n');
    } else {
      content = `import { useLanguage } from '../../contexts/LanguageContext';\n` + content;
    }
  }

  // 2. Inject React Hook call "const { t, language } = useLanguage();" and "const isRtl = language === 'ar';"
  // inside Component definitions if useLanguage is imported but no hook call exists
  if (!filePath.includes('LanguageContext.tsx')) {
    // Match common React functional component declarations
    const componentRegexes = [
      /export\s+const\s+(\w+):\s*React\.FC(\s*<\s*[^>]*\s*>)?\s*=\s*(?:\([^)]*\)|_)\s*=>\s*\{/g,
      /export\s+const\s+(\w+)\s*=\s*(?:\([^)]*\)|_)\s*=>\s*\{/g,
      /export\s+function\s+(\w+)\s*\([^)]*\)\s*\{/g,
      /const\s+(\w+):\s*React\.FC(\s*<\s*[^>]*\s*>)?\s*=\s*(?:\([^)]*\)|_)\s*=>\s*\{/g
    ];

    let foundComponent = false;
    for (const regex of componentRegexes) {
      if (regex.test(content)) {
        regex.lastIndex = 0; // reset
        content = content.replace(regex, (match) => {
          foundComponent = true;
          // Check if hook is already called in the block
          const hookSearchText = 'useLanguage(';
          const hasHook = originalContent.includes(hookSearchText);
          if (hasHook) {
            return match; // Keep unchanged
          }
          // Append hook calls right at the start of the function body
          return `${match}\n  const { t, language } = useLanguage();\n  const isRtl = language === 'ar';`;
        });
        break; // Process the first major match
      }
    }
  }

  // 3. Match raw JSX Arabic text outside curly braces and translate
  // Example: <div>مرحبا</div> -> <div>{t('مرحبا')}</div>
  content = content.replace(ARABIC_JSX_TEXT_REGEX, (match, p1) => {
    const term = p1.trim();
    if (!term) return match;
    // Skip if it contains JSX brackets or JS symbols that aren't plain text
    if (term.includes('{') || term.includes('}') || term.includes('<') || term.includes('>')) {
      return match;
    }
    return `>{t('${term}')}<`;
  });

  // 4. Match double quoted ARABIC attribute values: placeholder="مرحبا" -> placeholder={t('مرحبا')}
  content = content.replace(ARABIC_ATTR_DOUBLE_QUOTE, (match, attrName, attrVal) => {
    const term = attrVal.trim();
    if (!term) return match;
    return `${attrName}={t('${term}')}`;
  });

  // 5. Match single quoted ARABIC attribute values: placeholder='مرحبا' -> placeholder={t('مرحبا')}
  content = content.replace(ARABIC_ATTR_SINGLE_QUOTE, (match, attrName, attrVal) => {
    const term = attrVal.trim();
    if (!term) return match;
    return `${attrName}={t('${term}')}`;
  });

  // 6. Match JS string literals inside components that are Arabic (e.g. "مسودة" or 'مسودة') and wrap keys:
  // But skip lines that are comments or already have t()
  const lines = content.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return line;
    // Skip if already wrapped in t('...') or exists language context mapping
    if (trimmed.includes("t('") || trimmed.includes('t("') || trimmed.includes('t(`')) return line;
    if (filePath.includes('LanguageContext.tsx') || filePath.includes('translate-local.ts')) return line;

    // Replace JS string literals with t('term')
    let newLine = line;
    // Double quotes
    const doubleQuoteLit = /"([^"'\r\n]*[\u0600-\u06FF]+[^"'\r\n]*)"/g;
    newLine = newLine.replace(doubleQuoteLit, (match, p1) => {
      const term = p1.trim();
      return `t('${term}')`;
    });

    // Single quotes
    const singleQuoteLit = /'([^"'\r\n]*[\u0600-\u06FF]+[^"'\r\n]*)'/g;
    newLine = newLine.replace(singleQuoteLit, (match, p1) => {
      const term = p1.trim();
      return `t('${term}')`;
    });

    return newLine;
  });

  content = processedLines.join('\n');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

function runProcessor() {
  const files = walkDir(PAGES_DIR);
  console.log(`Analyzing ${files.length} page files...`);
  let modifiedCount = 0;

  files.forEach(file => {
    try {
      const relative = path.relative(process.cwd(), file);
      const modified = processPageFile(file);
      if (modified) {
        modifiedCount++;
        console.log(`Modified and localized: ${relative}`);
      }
    } catch (e: any) {
      console.error(`Error processing file ${file}:`, e.message);
    }
  });

  console.log(`\n🎉 Completed translation application! Modified ${modifiedCount} files successfully.`);
}

runProcessor();
