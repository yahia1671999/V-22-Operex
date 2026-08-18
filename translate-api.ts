import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// Initialize GoogleGenAI SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function main() {
  const arabicFile = path.join(process.cwd(), 'extracted_arabic.json');
  if (!fs.existsSync(arabicFile)) {
    console.error("Error: extracted_arabic.json does not exist. Please run extract-arabic.ts first.");
    return;
  }

  const list: string[] = JSON.parse(fs.readFileSync(arabicFile, 'utf-8'));
  console.log(`Loaded ${list.length} Arabic phrases to translate.`);

  // Filter out useless sequences or purely numeric ones
  const filteredList = list.filter(item => {
    const s = item.trim();
    if (!s) return false;
    if (/^\d+$/.test(s)) return false;
    return true;
  });

  console.log(`Filtered into ${filteredList.length} genuine phrases to translate.`);

  // Chunks of 120 phrases
  const CHUNK_SIZE = 120;
  const chunks: string[][] = [];
  for (let i = 0; i < filteredList.length; i += CHUNK_SIZE) {
    chunks.push(filteredList.slice(i, i + CHUNK_SIZE));
  }

  console.log(`Divided into ${chunks.length} batches of translations... Executing IN PARALLEL...`);

  const translationsMap: Record<string, string> = {
    "نشط": "Active",
    "غير نشط": "Inactive",
    "قيد الانتظار": "Pending Approval",
    "معتمد": "Approved",
    "مرفوض": "Rejected",
    "مسودة": "Draft",
    "مرسل": "Submitted",
    "مقفل": "Locked",
    "مكتمل": "Completed",
    "إلغاء": "Cancel",
    "حفظ": "Save",
    "إضافة": "Add",
    "تعديل": "Edit",
    "حذف": "Delete",
    "موافق": "OK",
    "تأكيد": "Confirm"
  };

  const promises = chunks.map(async (chunk, i) => {
    const prompt = `You are a professional Saudi HR, payroll, and ERP localization and translation expert. 
Translate these Arabic UI strings/labels from a company system (Salarix) into high-quality, professional, clear and polished English counterparts.
Translate each phrase accurately in context (HR, employee dashboard, allowances, check-in, wifi networks, tasks division, calendar, time commitments, payroll).

Return the translations STRICTLY as a JSON object mapping the exact original Arabic string to its English translation.
Ensure the JSON output is clean and parses perfectly. Do not include markdown code blocks or any text other than the JSON object.

Arabic UI Strings:
${JSON.stringify(chunk, null, 2)}`;

    let success = false;
    let retries = 3;
    let batchMap: Record<string, string> = {};

    while (!success && retries > 0) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
        });

        const reply = response.text?.trim() || '{}';
        batchMap = JSON.parse(reply);
        success = true;
        console.log(`[Batch ${i + 1}/${chunks.length}] Translated ${Object.keys(batchMap).length} items successfully.`);
      } catch (err: any) {
        retries--;
        console.error(`[Batch ${i + 1}/${chunks.length}] Error: ${err.message}. Retries remaining: ${retries}`);
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    return batchMap;
  });

  const results = await Promise.all(promises);

  // Merge results
  results.forEach(batchMap => {
    for (const [ar, en] of Object.entries(batchMap)) {
      translationsMap[ar] = en as string;
    }
  });

  fs.writeFileSync('translated_dictionary.json', JSON.stringify(translationsMap, null, 2), 'utf-8');
  console.log(`\n🎉 Parallel Translation Complete! Map has ${Object.keys(translationsMap).length} entries. Saved to translated_dictionary.json`);
}

main().catch(err => {
  console.error("FATAL ERROR in main:", err);
});
