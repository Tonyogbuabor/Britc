import path from 'path';
import { fileURLToPath } from 'url';
import { OFFER_CATALOGUE, DEFAULT_RISK_THRESHOLDS } from '../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  // Primary Google Sheet ID
  SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1sS3zh9SS8ptrAE-qg31L1lUNcb_PE6usl0pVucXU9_E',
  
  // Credentials (server-side only)
  SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  SHEETS_API_KEY: process.env.GOOGLE_SHEETS_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  
  // Storage paths
  DATA_DIR: path.join(__dirname, 'data'),
  SNAPSHOT_CACHE_FILE: path.join(__dirname, 'data', 'snapshot-cache.json'),
  CAMPAIGNS_FILE: path.join(__dirname, 'data', 'campaigns.json'),
  BUNDLED_SEED_FILE: path.resolve(__dirname, '..', 'public', 'assets', 'aistudio', 'BritConnect_874f6e12'),
  
  // Model settings
  HOLDOUT_TEST_SPLIT: 0.20,
  CV_FOLDS: 5,
  RANDOM_SEED: 42,
  
  // Churn Risk Thresholds
  RISK_THRESHOLDS: DEFAULT_RISK_THRESHOLDS,
  
  // Retention Offer Catalogue
  OFFER_CATALOGUE,
};
