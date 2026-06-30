// ================================================================
// CONFIG — Fuel Micros Enricher GAS
// ================================================================

const PROP = {
  GEMINI_API_KEY:   'GEMINI_API_KEY',
  GEMINI_MODEL:     'GEMINI_MODEL',
  FIREBASE_PROJECT: 'FIREBASE_PROJECT',
  FUEL_UID:         'FUEL_UID',
};

const DEFAULTS = {
  GEMINI_API_KEY:   'AIzaSyDt5tuG9XlmtKWsmLGBFW9GXtK6TWZmrPA',
  GEMINI_MODEL:     'gemini-2.5-flash',
  FIREBASE_PROJECT: 'fitness-aos',
  FUEL_UID:         '59ole36uNpNwml5H6VDYCXyCME92',
};

const MICRO_KEYS = [
  'vitamin_a_ug', 'vitamin_d_ug', 'vitamin_e_mg', 'vitamin_k_ug',
  'vitamin_c_mg', 'vitamin_b1_mg', 'vitamin_b2_mg', 'vitamin_b3_mg',
  'vitamin_b5_mg', 'vitamin_b6_mg', 'vitamin_b7_ug', 'folate_ug', 'vitamin_b12_ug',
  'calcium_mg', 'phosphorus_mg', 'magnesium_mg', 'iron_mg', 'zinc_mg',
  'selenium_ug', 'iodine_ug', 'potassium_mg', 'sodium_mg', 'omega3_mg',
];

// Wie viele Tage zurück wir Logs lesen
const LOOKBACK_DAYS = 60;

// Max Mahlzeiten per Run (Gemini-Calls ~2-3s each → 6min limit)
const MAX_PER_RUN = 50;

function getProp_(key) {
  const val = PropertiesService.getScriptProperties().getProperty(key);
  return val != null ? val : (DEFAULTS[key] || null);
}

function requireProp_(key) {
  const val = getProp_(key);
  if (!val) throw new Error('Script Property missing: ' + key);
  return val;
}

function setupProperties() {
  Logger.log('Script Properties setzen via: File → Project properties → Script properties');
  Logger.log('Benötigt: GEMINI_API_KEY, optional: GEMINI_MODEL, FIREBASE_PROJECT, FUEL_UID');
}
