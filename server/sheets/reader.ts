import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { google } from 'googleapis';
import { CONFIG } from '../config.js';
import type { RawCustomerRow } from '../../shared/types.js';

export interface ReadSheetResult {
  headers: string[];
  rows: RawCustomerRow[];
  source: 'Google Sheets API v4' | 'Public Sheet CSV' | 'Disk Snapshot Cache' | 'Bundled Data Seed';
  contentHash: string;
}

/**
 * Parses CSV text taking quoted fields and commas into account accurately.
 */
export function parseCSV(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => h.replace(/^["']|["']$/g, '').trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseLine(line);
    const rowObj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = values[j] !== undefined ? values[j].replace(/^["']|["']$/g, '').trim() : '';
    }
    rows.push(rowObj);
  }

  return { headers, rows };
}

export interface GoogleCredentialsStatus {
  serviceAccountPresent: boolean;
  serviceAccountValid: boolean;
  clientEmailPresent: boolean;
  privateKeyPresent: boolean;
  privateKeyLineBreaksConverted: boolean;
  sheetsApiKeyPresent: boolean;
  geminiApiKeyPresent: boolean;
  parseError?: string;
}

/**
 * Checks whether each secret is present and valid without revealing any secret values.
 */
export function getGoogleCredentialsStatus(): GoogleCredentialsStatus {
  const saRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || CONFIG.SERVICE_ACCOUNT_JSON || '').trim();
  const sheetsKeyRaw = (process.env.GOOGLE_SHEETS_API_KEY || CONFIG.SHEETS_API_KEY || '').trim();
  const geminiKeyRaw = (process.env.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY || '').trim();

  let serviceAccountValid = false;
  let clientEmailPresent = false;
  let privateKeyPresent = false;
  let privateKeyLineBreaksConverted = false;
  let parseError: string | undefined;

  if (saRaw) {
    try {
      let cleaned = saRaw;
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        try {
          cleaned = JSON.parse(cleaned);
        } catch {
          cleaned = cleaned.slice(1, -1);
        }
      }
      const parsed = typeof cleaned === 'object' ? cleaned : JSON.parse(cleaned);

      clientEmailPresent = !!(parsed.client_email && typeof parsed.client_email === 'string' && parsed.client_email.includes('@'));
      if (parsed.private_key && typeof parsed.private_key === 'string') {
        privateKeyPresent = true;
        // Convert any escaped \n characters into real line breaks
        const converted = parsed.private_key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
        privateKeyLineBreaksConverted = converted.includes('\n');
      }

      serviceAccountValid = clientEmailPresent && privateKeyPresent;
    } catch (err: any) {
      parseError = 'Failed to parse JSON string';
    }
  }

  return {
    serviceAccountPresent: !!saRaw,
    serviceAccountValid,
    clientEmailPresent,
    privateKeyPresent,
    privateKeyLineBreaksConverted,
    sheetsApiKeyPresent: !!sheetsKeyRaw,
    geminiApiKeyPresent: !!geminiKeyRaw,
    parseError,
  };
}

/**
 * Reads Google credentials from GOOGLE_SERVICE_ACCOUNT_JSON.
 * Converts any escaped \n characters in the private key into real line breaks.
 */
export function getParsedServiceAccount(): { client_email: string; private_key: string } | null {
  const saRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || CONFIG.SERVICE_ACCOUNT_JSON || '').trim();
  if (!saRaw) return null;

  try {
    let cleaned = saRaw;
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      try {
        cleaned = JSON.parse(cleaned);
      } catch {
        cleaned = cleaned.slice(1, -1);
      }
    }
    const parsed = typeof cleaned === 'object' ? cleaned : JSON.parse(cleaned);

    if (!parsed.client_email || !parsed.private_key) return null;

    // Convert any escaped \n characters in the private key into real line breaks
    const privateKey = String(parsed.private_key)
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n');

    return {
      client_email: String(parsed.client_email).trim(),
      private_key: privateKey,
    };
  } catch (err) {
    console.warn('[SheetsReader] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err);
    return null;
  }
}

/**
 * Checks whether the Google Sheet can be read, returning diagnostic method and rows count without secret values.
 */
export async function checkGoogleSheetReadHealth(): Promise<{
  sheetReadable: boolean;
  method: string;
  rowsCount: number;
  spreadsheetId: string;
  error?: string;
}> {
  const spreadsheetId = CONFIG.SPREADSHEET_ID;
  const creds = getParsedServiceAccount();

  // Test 1: Service Account
  if (creds) {
    try {
      const authClient = new google.auth.JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      const sheets = google.sheets({ version: 'v4', auth: authClient });
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const tab = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tab}!A1:B10`,
      });
      const count = (resp.data.values || []).length;
      return {
        sheetReadable: true,
        method: 'Google Sheets API v4 (Service Account)',
        rowsCount: count > 0 ? count : 1,
        spreadsheetId,
      };
    } catch (err: any) {
      console.warn('[HealthCheck] Service Account read failed:', err?.message || err);
    }
  }

  // Test 2: Sheets API Key
  const apiKey = (process.env.GOOGLE_SHEETS_API_KEY || CONFIG.SHEETS_API_KEY || '').trim();
  if (apiKey) {
    try {
      const sheets = google.sheets({ version: 'v4', key: apiKey });
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const tab = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tab}!A1:B10`,
      });
      const count = (resp.data.values || []).length;
      return {
        sheetReadable: true,
        method: 'Google Sheets API v4 (API Key)',
        rowsCount: count,
        spreadsheetId,
      };
    } catch (err: any) {
      console.warn('[HealthCheck] API Key read failed:', err?.message || err);
    }
  }

  // Test 3: Public Export
  try {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(exportUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BritConnectChurn/1.0)' },
    });
    clearTimeout(timer);
    if (res.ok) {
      const text = await res.text();
      if (text.includes('Customer ID') || text.includes('Customer Segment')) {
        const lineCount = text.split('\n').filter(l => l.trim()).length;
        return {
          sheetReadable: true,
          method: 'Public Sheet CSV Export',
          rowsCount: lineCount,
          spreadsheetId,
        };
      }
    }
  } catch (err: any) {
    console.warn('[HealthCheck] Public export read failed:', err?.message || err);
  }

  // Test 4: Local Bundled Dataset Seed
  if (fs.existsSync(CONFIG.BUNDLED_SEED_FILE)) {
    try {
      const seed = fs.readFileSync(CONFIG.BUNDLED_SEED_FILE, 'utf-8');
      const lines = seed.split('\n').filter(l => l.trim()).length;
      return {
        sheetReadable: true,
        method: 'Bundled Customer Dataset Seed (Offline Fallback)',
        rowsCount: lines,
        spreadsheetId,
      };
    } catch (e) {
      /* ignore */
    }
  }

  return {
    sheetReadable: false,
    method: 'None',
    rowsCount: 0,
    spreadsheetId,
    error: 'Google Sheet could not be read via Service Account, API Key, or Public Export',
  };
}

export async function fetchLiveSheet(): Promise<ReadSheetResult> {
  const spreadsheetId = CONFIG.SPREADSHEET_ID;

  // 1. Try Google Sheets API v4 if credentials are set
  const creds = getParsedServiceAccount();
  const apiKey = (process.env.GOOGLE_SHEETS_API_KEY || CONFIG.SHEETS_API_KEY || '').trim();

  if (creds || apiKey) {
    try {
      let authClient: any = null;
      if (creds) {
        authClient = new google.auth.JWT({
          email: creds.client_email,
          key: creds.private_key,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
      }

      const sheets = google.sheets({
        version: 'v4',
        auth: authClient || undefined,
        key: !authClient && apiKey ? apiKey : undefined
      });

      // Get metadata to discover tabs
      const meta = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheetsList = meta.data.sheets || [];
      if (sheetsList.length > 0) {
        const tabName = sheetsList[0].properties?.title || 'Sheet1';
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: tabName,
          valueRenderOption: 'UNFORMATTED_VALUE',
          dateTimeRenderOption: 'SERIAL_NUMBER',
        });

        const rawValues = resp.data.values || [];
        if (rawValues.length > 1) {
          const headers = (rawValues[0] || []).map(h => String(h).trim());
          const rows: RawCustomerRow[] = [];
          for (let r = 1; r < rawValues.length; r++) {
            const rowArr = rawValues[r];
            if (!rowArr || rowArr.length === 0) continue;
            const rowObj: any = {};
            for (let c = 0; c < headers.length; c++) {
              rowObj[headers[c]] = rowArr[c] !== undefined ? rowArr[c] : '';
            }
            rows.push(rowObj as RawCustomerRow);
          }

          const rawText = JSON.stringify(rawValues);
          const contentHash = crypto.createHash('sha256').update(rawText).digest('hex');

          return {
            headers,
            rows,
            source: 'Google Sheets API v4',
            contentHash,
          };
        }
      }
    } catch (err: any) {
      console.warn('[SheetsReader] Google Sheets API v4 request failed, falling back to public export:', err?.message || err);
    }
  }

  // 2. Try public export CSV endpoint with retry and backoff
  try {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch(exportUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BritConnectChurn/1.0)',
      }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const csvText = await res.text();
      if (csvText.includes('Customer ID') || csvText.includes('Customer Segment')) {
        const { headers, rows } = parseCSV(csvText);
        if (rows.length > 0) {
          const contentHash = crypto.createHash('sha256').update(csvText).digest('hex');
          return {
            headers,
            rows: rows as unknown as RawCustomerRow[],
            source: 'Public Sheet CSV',
            contentHash,
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[SheetsReader] Public CSV export failed or timed out:', err?.message || err);
  }

  // 3. Try reading from disk snapshot cache if previously saved
  if (fs.existsSync(CONFIG.SNAPSHOT_CACHE_FILE)) {
    try {
      const cacheContent = fs.readFileSync(CONFIG.SNAPSHOT_CACHE_FILE, 'utf-8');
      const cached = JSON.parse(cacheContent);
      if (cached && cached.rawRows && cached.rawRows.length > 0) {
        return {
          headers: cached.headers || Object.keys(cached.rawRows[0] || {}),
          rows: cached.rawRows as RawCustomerRow[],
          source: 'Disk Snapshot Cache',
          contentHash: cached.contentHash || crypto.createHash('sha256').update(cacheContent).digest('hex'),
        };
      }
    } catch (err: any) {
      console.warn('[SheetsReader] Failed reading snapshot cache:', err?.message || err);
    }
  }

  // 4. Fallback to bundled authentic seed asset (4,907 customer rows)
  if (fs.existsSync(CONFIG.BUNDLED_SEED_FILE)) {
    try {
      const seedCsv = fs.readFileSync(CONFIG.BUNDLED_SEED_FILE, 'utf-8');
      const { headers, rows } = parseCSV(seedCsv);
      const contentHash = crypto.createHash('sha256').update(seedCsv).digest('hex');
      return {
        headers,
        rows: rows as unknown as RawCustomerRow[],
        source: 'Bundled Data Seed',
        contentHash,
      };
    } catch (err: any) {
      console.error('[SheetsReader] Failed reading bundled seed file:', err);
    }
  }

  throw new Error('Unable to read live Google Sheet or local fallback data. Check network and sheet permissions.');
}
