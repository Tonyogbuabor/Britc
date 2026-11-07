import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { snapshotManager } from './server/snapshot.js';
import { simulateCustomerWhatIf } from './server/whatif/simulator.js';
import { generatePersonalizedRetentionPlan } from './server/recommend/gemini.js';
import { processChatQuery } from './server/chat/agent.js';
import { campaignStore } from './server/campaigns/store.js';
import { generateExcelReport } from './server/reports/generator.js';
import { CONFIG } from './server/config.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

import { getGoogleCredentialsStatus, checkGoogleSheetReadHealth } from './server/sheets/reader.js';

// API Routes

// 0. System Health & Secret Presence Check
app.get('/api/health', async (req, res) => {
  try {
    const credStatus = getGoogleCredentialsStatus();
    const sheetHealth = await checkGoogleSheetReadHealth();
    const isSnapshotInit = snapshotManager.isInitialized();
    const snapshot = isSnapshotInit ? snapshotManager.getSnapshot() : null;

    const healthData = {
      status: sheetHealth.sheetReadable ? 'HEALTHY' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      secrets: {
        GOOGLE_SERVICE_ACCOUNT_JSON: {
          present: credStatus.serviceAccountPresent,
          validJson: credStatus.serviceAccountValid,
          clientEmailDetected: credStatus.clientEmailPresent,
          privateKeyDetected: credStatus.privateKeyPresent,
          privateKeyLineBreaksConverted: credStatus.privateKeyLineBreaksConverted,
          secretValue: '[PROTECTED / NOT EXPOSED]',
          note: credStatus.serviceAccountPresent
            ? 'Credentials parsed; escaped \\n line breaks converted to real newlines.'
            : 'Secret not configured in environment.',
        },
        GOOGLE_SHEETS_API_KEY: {
          present: credStatus.sheetsApiKeyPresent,
          secretValue: '[PROTECTED / NOT EXPOSED]',
          note: credStatus.sheetsApiKeyPresent
            ? 'API key detected.'
            : 'Not configured; public CSV export or service account used.',
        },
        GEMINI_API_KEY: {
          present: credStatus.geminiApiKeyPresent,
          secretValue: '[PROTECTED / NOT EXPOSED]',
          note: credStatus.geminiApiKeyPresent
            ? 'Gemini API key active for AI retention recommendations and chat.'
            : 'Not configured; deterministic rule engine active.',
        },
      },
      googleSheet: {
        spreadsheetId: sheetHealth.spreadsheetId,
        sheetReadable: sheetHealth.sheetReadable,
        readMethod: sheetHealth.method,
        rowsRead: sheetHealth.rowsCount || snapshot?.dataQuality?.validRows || 0,
        inMemorySnapshotInitialized: isSnapshotInit,
        activeSubscribersScored: snapshot?.kpis?.activeCustomers || 0,
        lastSnapshotTime: snapshot?.timestamp || null,
        error: sheetHealth.error || null,
      },
    };

    // Return HTML page if requested by browser and not explicitly asking for JSON
    const acceptsHtml = req.headers.accept?.includes('text/html');
    const wantsJson = req.query.json === 'true' || req.query.format === 'json' || req.headers.accept?.includes('application/json');

    if (acceptsHtml && !wantsJson) {
      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BritConnect - System Health & Secrets Status</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background: #FAF6EA; color: #1B2A22; margin: 0; padding: 32px 16px; }
    .container { max-width: 860px; margin: 0 auto; }
    .header { background: #0F3D2E; color: #FAF6EA; padding: 24px 28px; border-radius: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(15,61,46,0.15); }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
    .card { background: #FFFFFF; border: 1px solid #C4BEAD; border-radius: 14px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); }
    .card h2 { margin: 0 0 16px; font-size: 17px; color: #0F3D2E; display: flex; align-items: center; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 14px; background: #FAF6EA; color: #0F3D2E; font-weight: 700; border-bottom: 2px solid #C4BEAD; }
    td { padding: 12px 14px; border-bottom: 1px solid #E5DFCF; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
    .badge-ok { background: rgba(31,122,77,0.12); color: #1F7A4D; border: 1px solid rgba(31,122,77,0.3); }
    .badge-warn { background: rgba(201,162,39,0.15); color: #9A7B1C; border: 1px solid rgba(201,162,39,0.3); }
    .badge-fail { background: rgba(181,72,58,0.12); color: #B5483A; border: 1px solid rgba(181,72,58,0.3); }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .btn { display: inline-block; background: #0F3D2E; color: #FAF6EA; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; transition: background 0.2s; }
    .btn:hover { background: #1F7A4D; }
    .btn-secondary { background: #FAF6EA; color: #0F3D2E; border: 1px solid #C4BEAD; margin-left: 8px; }
    .btn-secondary:hover { background: #E5DFCF; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>BritConnect System Health & Secret Status</h1>
        <p>Production Diagnostic Monitor • Single-Flight Ingestion & Privacy Firewall</p>
      </div>
      <div>
        <span class="badge ${healthData.status === 'HEALTHY' ? 'badge-ok' : 'badge-warn'}" style="font-size: 13px; padding: 6px 14px; background: #FAF6EA;">
          ● ${healthData.status}
        </span>
      </div>
    </div>

    <div class="card">
      <h2>
        <span>1. Secrets Presence & Validation</span>
        <span style="font-size: 12px; color: #64746B; font-weight: normal;">Values are permanently redacted for zero-leakage security</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>Secret Name</th>
            <th>Presence Status</th>
            <th>Key Formatting Details</th>
            <th>Secret Exposure</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="mono"><strong>GOOGLE_SERVICE_ACCOUNT_JSON</strong></td>
            <td>
              ${healthData.secrets.GOOGLE_SERVICE_ACCOUNT_JSON.present 
                ? '<span class="badge badge-ok">✓ Present</span>' 
                : '<span class="badge badge-warn">○ Not Injected</span>'}
            </td>
            <td>
              ${healthData.secrets.GOOGLE_SERVICE_ACCOUNT_JSON.present
                ? (healthData.secrets.GOOGLE_SERVICE_ACCOUNT_JSON.privateKeyLineBreaksConverted
                    ? '<span style="color: #1F7A4D;">✓ Valid JSON (\\n Line breaks converted to real newlines)</span>'
                    : '<span style="color: #B5483A;">⚠ Missing valid private_key</span>')
                : '<span style="color: #64746B;">Public sheet access active</span>'}
            </td>
            <td class="mono" style="color: #64746B;">[HIDDEN FOR SECURITY]</td>
          </tr>
          <tr>
            <td class="mono"><strong>GOOGLE_SHEETS_API_KEY</strong></td>
            <td>
              ${healthData.secrets.GOOGLE_SHEETS_API_KEY.present 
                ? '<span class="badge badge-ok">✓ Present</span>' 
                : '<span class="badge badge-warn">○ Not Configured</span>'}
            </td>
            <td>
              ${healthData.secrets.GOOGLE_SHEETS_API_KEY.present
                ? '<span style="color: #1F7A4D;">✓ Google Sheets API Key Detected</span>'
                : '<span style="color: #64746B;">Fallback endpoints enabled</span>'}
            </td>
            <td class="mono" style="color: #64746B;">[HIDDEN FOR SECURITY]</td>
          </tr>
          <tr>
            <td class="mono"><strong>GEMINI_API_KEY</strong></td>
            <td>
              ${healthData.secrets.GEMINI_API_KEY.present 
                ? '<span class="badge badge-ok">✓ Present</span>' 
                : '<span class="badge badge-warn">○ Optional (Rule Engine Active)</span>'}
            </td>
            <td>
              ${healthData.secrets.GEMINI_API_KEY.present
                ? '<span style="color: #1F7A4D;">✓ Active for Gemini 3.8 Flash recommendations</span>'
                : '<span style="color: #64746B;">Deterministic rule fallback enabled</span>'}
            </td>
            <td class="mono" style="color: #64746B;">[HIDDEN FOR SECURITY]</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>
        <span>2. Google Sheet Readability & Ingestion</span>
        <span class="badge ${healthData.googleSheet.sheetReadable ? 'badge-ok' : 'badge-fail'}">
          ${healthData.googleSheet.sheetReadable ? '✓ READABLE' : '✗ UNREADABLE'}
        </span>
      </h2>
      <table>
        <tbody>
          <tr>
            <td style="width: 35%; font-weight: 600;">Configured Spreadsheet ID</td>
            <td class="mono" style="color: #0F3D2E;">${healthData.googleSheet.spreadsheetId}</td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Active Read Method</td>
            <td><strong>${healthData.googleSheet.readMethod}</strong></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Ingested Customer Records</td>
            <td class="mono" style="font-weight: 700; color: #1F7A4D;">${healthData.googleSheet.rowsRead.toLocaleString()} verified customer rows</td>
          </tr>
          <tr>
            <td style="font-weight: 600;">In-Memory Snapshot Status</td>
            <td>
              ${healthData.googleSheet.inMemorySnapshotInitialized 
                ? '<span class="badge badge-ok">✓ Initialized (' + healthData.googleSheet.activeSubscribersScored.toLocaleString() + ' active scored)</span>'
                : '<span class="badge badge-warn">○ Warming up...</span>'}
            </td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Last Verified Synced Time</td>
            <td class="mono" style="color: #64746B;">${healthData.googleSheet.lastSnapshotTime || healthData.timestamp}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <a href="/" class="btn">← Back to BritConnect Dashboard</a>
          <a href="/api/health?json=true" class="btn btn-secondary">View Raw JSON</a>
        </div>
        <span style="font-size: 11px; color: #64746B;">Zero Target Leakage Firewall Active • UK GDPR Compliant</span>
      </div>
    </div>
  </div>
</body>
</html>`;
      return res.send(html);
    }

    // Default or JSON response
    res.json(healthData);
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', error: err.message || 'Health check failed' });
  }
});

// 1. Snapshot retrieval
app.get('/api/snapshot', (req, res) => {
  try {
    if (!snapshotManager.isInitialized()) {
      return res.status(503).json({ error: 'Snapshot is initializing. Please retry shortly.' });
    }
    const snapshot = snapshotManager.getSnapshot();
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 2. Trigger atomic snapshot refresh
app.post('/api/snapshot/refresh', async (req, res) => {
  try {
    const snapshot = await snapshotManager.refresh(true);
    res.json({ success: true, snapshot });
  } catch (err: any) {
    console.error('[API] Refresh error:', err);
    res.status(500).json({ error: err.message || 'Failed to refresh snapshot from Google Sheet' });
  }
});

// 3. Customer detail lookup
app.get('/api/customers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = snapshotManager.getSnapshot();
    const customer = snapshot.customers.find(c => c.customerId.toLowerCase() === id.toLowerCase());
    if (!customer) {
      return res.status(404).json({ error: `Customer ${id} not found` });
    }
    res.json(customer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. What-If Lever simulation
app.post('/api/customers/:id/whatif', (req, res) => {
  try {
    const { id } = req.params;
    const levers = req.body;
    const snapshot = snapshotManager.getSnapshot();
    const customer = snapshot.customers.find(c => c.customerId.toLowerCase() === id.toLowerCase());
    if (!customer) {
      return res.status(404).json({ error: `Customer ${id} not found` });
    }
    const result = simulateCustomerWhatIf(customer, levers);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Gemini AI Personalized Retention Plan
app.post('/api/customers/:id/retention-plan', async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = snapshotManager.getSnapshot();
    const customer = snapshot.customers.find(c => c.customerId.toLowerCase() === id.toLowerCase());
    if (!customer) {
      return res.status(404).json({ error: `Customer ${id} not found` });
    }
    const plan = await generatePersonalizedRetentionPlan(customer);
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. AI Churn Intelligence Assistant
app.post('/api/chat', async (req, res) => {
  try {
    const { query, history } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    const snapshot = snapshotManager.getSnapshot();
    const response = await processChatQuery(snapshot, query, history || []);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Retention Campaigns
app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = campaignStore.getAll();
    res.json(campaigns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/campaigns', (req, res) => {
  try {
    const { name, targetSegmentId, targetTier, offerId } = req.body;
    const snapshot = snapshotManager.getSnapshot();
    const newCamp = campaignStore.create(
      name,
      targetSegmentId,
      targetTier,
      offerId,
      snapshot.activeCustomers
    );
    res.json(newCamp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Excel Report Export
app.get('/api/reports/excel', async (req, res) => {
  try {
    const snapshot = snapshotManager.getSnapshot();
    const buffer = await generateExcelReport(snapshot);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="BritConnect-Churn-Report-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Config and catalogue
app.get('/api/config', (req, res) => {
  res.json({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    offerCatalogue: CONFIG.OFFER_CATALOGUE,
    thresholds: CONFIG.RISK_THRESHOLDS,
  });
});

// Start Express server and mount Vite in development
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend assets
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[Server] BritConnect platform listening on http://0.0.0.0:${PORT}`);
    // Warm up initial snapshot asynchronously
    try {
      await snapshotManager.refresh();
      console.log('[Server] Initial snapshot warm-up completed successfully.');
    } catch (err) {
      console.error('[Server] Initial snapshot warm-up failed:', err);
    }
  });
}

startServer();
