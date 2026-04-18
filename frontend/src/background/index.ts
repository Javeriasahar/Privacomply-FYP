/**
 * PrivaComply Background Service Worker
 * Integrates CookieBlock ML classification with consent management
 */

// Import CookieBlock modules (loaded as scripts in manifest)
declare const difflib: any;
declare const Levenshtein: any;
declare const LZString: any;

// ============================================================================
// GLOBALS (from CookieBlock globals.js - adapted for TypeScript)
// ============================================================================

// Unused DefaultConfig interface removed - using simpler approach

const escapeString = (str: any): string => {
  if (typeof str !== 'string') str = String(str);
  return unescape(encodeURIComponent(str));
};

const urlToUniformDomain = (url: string | null): string | null => {
  if (url === null) return null;
  let new_url = url.trim();
  new_url = new_url.replace(/^\./, '');
  new_url = new_url.replace(/^http(s)?:\/\//, '');
  new_url = new_url.replace(/^www([0-9])?/, '');
  new_url = new_url.replace(/^\./, '');
  new_url = new_url.replace(/\/.*$/, '');
  return new_url;
};

const datetimeToExpiry = (cookie: chrome.cookies.Cookie): number => {
  const curTS = Math.floor(Date.now() / 1000);
  return cookie.session ? 0 : (cookie.expirationDate || 0) - curTS;
};

const classIndexToString = (idx: number): string => {
  switch (idx) {
    case -1: return 'Unknown';
    case 0: return 'Necessary';
    case 1: return 'Functionality';
    case 2: return 'Analytical';
    case 3: return 'Advertising';
    case 4: return 'Uncategorized';
    default: return 'Invalid';
  }
};

// ============================================================================
// FEATURE EXTRACTOR (from CookieBlock extractor.js - adapted)
// ============================================================================

let top_names: Record<string, number> = {};
let top_domains: Record<string, number> = {};
let pattern_names: RegExp[] = [];
let name_tokens: RegExp[] = [];
let iabeurope_vendors: Set<string> = new Set();
let content_terms: RegExp[] = [];

const alphaRegex = /^[A-Za-z]+$/;
const numRegex = /^[0-9]+$/;
const hexRegex = /^[0-9A-Fa-f]+$/;
const alnumRegex = /^[A-Za-z0-9]+$/;
const truthValueRegex = /\b(true|false|yes|no|0|1|on|off)\b/i;
const codeIdentRegex = /^[A-Za-z0-9_]+$/i;
const alphaAnyRegex = /[A-Za-z]/;
const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const httpRegex = /http(s)?:\/\/.*\./;
const wwwRegex = /www(2-9)?\..*/;
const separators = ',|#:;&._-';

const _tsd = parseInt(`${Date.now()}`.slice(0, 2));
const unixTimestampRegex = new RegExp(`\\b(${_tsd - 1}|${_tsd}|${_tsd + 1})[0-9]{8}([0-9]{3})?\\b`);
const patternYearMonthDay = /(19[7-9][0-9]|20[0-3][0-9]|[0-9][0-9])-[01][0-9]-[0-3][0-9]/;
const patternDayMonthYear = /[0-3][0-9]-[01][0-9]-(19[7-9][0-9]|20[0-3][0-9]|[0-9][0-9])/;
const patternMonthDayYear = /[01][0-9]-[0-3][0-9]-(19[7-9][0-9]|20[0-3][0-9])/;
const patternAlpha3DaysEng = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i;
const patternAlpha3MonthsEng = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
const patternFullDaysEng = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i;
const patternFullMonthsEng = /(January|February|March|April|May|June|July|August|September|October|November|December)/i;

const setupFeatureResources = async () => {
  // Load feature config (stored for potential future use)
  const configResponse = await fetch(chrome.runtime.getURL('background/features.json'));
  await configResponse.json(); // Config loaded but using simplified extraction

  // Load top names
  const namesResponse = await fetch(chrome.runtime.getURL('background/resources/top_names.txt'));
  const namesText = await namesResponse.text();
  namesText.split('\n').forEach((line, i) => {
    if (line && i < 500) {
      const name = line.split(',')[1];
      if (name) top_names[name] = i;
    }
  });

  // Load top domains
  const domainsResponse = await fetch(chrome.runtime.getURL('background/resources/top_domains.txt'));
  const domainsText = await domainsResponse.text();
  domainsText.split('\n').forEach((line, i) => {
    if (line && i < 500) {
      const domain = line.split(',')[1];
      if (domain) top_domains[domain] = i;
    }
  });

  // Load pattern names
  const patternsResponse = await fetch(chrome.runtime.getURL('background/resources/cookie_name_patterns.txt'));
  const patternsText = await patternsResponse.text();
  patternsText.split('\n').forEach((line, i) => {
    if (line && i < 50) {
      const pattern = line.split(',')[3];
      if (pattern) pattern_names.push(new RegExp(pattern));
    }
  });

  // Load name tokens
  const tokensResponse = await fetch(chrome.runtime.getURL('background/resources/name_features_filtered.txt'));
  const tokensText = await tokensResponse.text();
  tokensText.split('\n').forEach((line, i) => {
    if (line && i < 500) {
      const token = line.split(',')[1];
      if (token) name_tokens.push(new RegExp(token));
    }
  });

  // Load IAB vendors
  const vendorsResponse = await fetch(chrome.runtime.getURL('background/resources/iabeurope_vendors.txt'));
  const vendorsText = await vendorsResponse.text();
  vendorsText.split('\n').forEach(line => {
    if (line) iabeurope_vendors.add(urlToUniformDomain(line) || '');
  });

  // Load content terms
  const termsResponse = await fetch(chrome.runtime.getURL('background/resources/content_terms_filtered.txt'));
  const termsText = await termsResponse.text();
  termsText.split('\n').forEach((line, i) => {
    if (line && i < 500) {
      const term = line.split(',')[1];
      if (term) content_terms.push(new RegExp(term, 'i'));
    }
  });

  console.log('CookieBlock: Feature resources loaded');
};

// ============================================================================
// PREDICTOR (from CookieBlock predictor.js - adapted)
// ============================================================================

let forests: any[][] = [[], [], [], []];

const loadForests = async () => {
  for (let i = 0; i < 4; i++) {
    const p1 = await fetch(chrome.runtime.getURL(`background/model/forest_class${i}_part1.json`));
    const p2 = await fetch(chrome.runtime.getURL(`background/model/forest_class${i}_part2.json`));
    const f1 = await p1.json();
    const f2 = await p2.json();
    forests[i] = f1.concat(f2);
  }
  console.log('CookieBlock: ML models loaded');
};

const traverseDecisionTree = (rootNode: any, features: Record<number, number>): number => {
  let treeNode = rootNode;
  while (true) {
    if ('v' in treeNode) {
      return treeNode['v'];
    }
    const fidx = treeNode['f'];
    if (!(fidx in features)) {
      treeNode = treeNode[treeNode['u']];
    } else if (features[fidx] < treeNode['c']) {
      treeNode = treeNode['l'];
    } else {
      treeNode = treeNode['r'];
    }
  }
};

const getForestScore = (forest: any[], features: Record<number, number>): number => {
  return forest.reduce((total, root) => total + traverseDecisionTree(root, features), 0);
};

const predictClass = (features: Record<number, number>, nfactor: number = 1.0): number => {
  if (forests.some(f => f.length === 0)) {
    console.error('CookieBlock: Models not loaded');
    return -1;
  }

  const classScores = forests.map(forest => Math.exp(getForestScore(forest, features)));
  const totalScore = classScores.reduce((a, b) => a + b, 0);
  const probabilities = classScores.map(x => x / totalScore);

  // Bayes Decision
  const lossWeights = [
    [0, 1, 1, 1],
    [nfactor, 0, 1, 1],
    [nfactor, 1, 0, 1],
    [nfactor, 1, 1, 0]
  ];

  let minIndex = 0;
  let minLoss = Infinity;

  for (let j = 0; j < lossWeights.length; j++) {
    let cLoss = 0;
    for (let i = 0; i < probabilities.length; i++) {
      cLoss += probabilities[i] * lossWeights[j][i];
    }
    if (cLoss < minLoss) {
      minIndex = j;
      minLoss = cLoss;
    }
  }

  return minIndex;
};

// ============================================================================
// FEATURE EXTRACTION (simplified from extractor.js)
// ============================================================================

const computeEntropy = (str: string): number => {
  const occurrences: Record<string, number> = {};
  for (const char of str) {
    occurrences[char] = (occurrences[char] || 0) + 1;
  }
  let entropy = 0;
  for (const count of Object.values(occurrences)) {
    const ratio = count / str.length;
    entropy -= ratio * Math.log2(ratio);
  }
  return entropy;
};

const maybeRemoveURLEncoding = (str: string): string => {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
};

const chooseBestSeparator = (content: string, validSeps: string, minSep: number) => {
  let maxoccs = minSep;
  let bestIndex = -1;
  let chosenSep: string | null = null;

  for (let i = 0; i < validSeps.length; i++) {
    let r = validSeps[i];
    if (r === '.' || r === '|') r = '\\' + r;
    const numoccs = (content.match(new RegExp(r, 'g')) || []).length;
    if (numoccs > maxoccs) {
      chosenSep = validSeps[i];
      bestIndex = i;
      maxoccs = numoccs;
    }
  }
  return { sep: chosenSep, count: maxoccs, index: bestIndex };
};

interface CookieData {
  name: string;
  domain: string;
  path: string;
  variable_data: Array<{
    host_only: boolean;
    http_only: boolean;
    secure: boolean;
    session: boolean;
    expiry: number;
    value: string;
    same_site: string;
  }>;
}

const extractFeatures = (cookieDat: CookieData): Record<number, number> => {
  const sparse: Record<number, number> = {};
  let idx = 0;
  const varData = cookieDat.variable_data[0];

  // Top names (500 features)
  if (cookieDat.name in top_names) {
    sparse[idx + top_names[cookieDat.name]] = 1.0;
  }
  idx += 500;

  // Top domains (500 features)
  const domain = urlToUniformDomain(cookieDat.domain);
  if (domain && domain in top_domains) {
    sparse[idx + top_domains[domain]] = 1.0;
  }
  idx += 500;

  // Pattern names (50 features)
  for (let i = 0; i < pattern_names.length; i++) {
    if (pattern_names[i].test(cookieDat.name)) {
      sparse[idx + i] = 1.0;
    }
  }
  idx += 50;

  // Name tokens (500 features)
  for (let i = 0; i < name_tokens.length; i++) {
    if (name_tokens[i].test(cookieDat.name)) {
      sparse[idx + i] = 1.0;
    }
  }
  idx += 500;

  // IAB vendor (1 feature)
  if (domain && iabeurope_vendors.has(domain)) {
    sparse[idx] = 1.0;
  }
  idx += 1;

  // Domain period (1 feature)
  if (cookieDat.domain.startsWith('.')) {
    sparse[idx] = 1.0;
  }
  idx += 1;

  // Host only (1 feature)
  if (varData.host_only) sparse[idx] = 1.0;
  idx += 1;

  // Non-root path (1 feature)
  if (cookieDat.path !== '/') sparse[idx] = 1.0;
  idx += 1;

  // Cookie flags changed (5 features) - single update so all 0
  idx += 5;

  // Gestalt mean/stdev (2 features)
  idx += 2;

  // Levenshtein mean/stdev (2 features)
  idx += 2;

  // Content length mean/stdev (2 features)
  const decodedValue = maybeRemoveURLEncoding(varData.value);
  sparse[idx] = decodedValue.length;
  idx += 2;

  // Compressed length mean/stdev (2 features)
  try {
    const compressed = LZString.compressToUTF16(decodedValue);
    sparse[idx] = compressed.length;
  } catch {
    sparse[idx] = decodedValue.length;
  }
  idx += 2;

  // Entropy mean/stdev (2 features)
  sparse[idx] = computeEntropy(decodedValue);
  idx += 2;

  // Per-update features (single update)
  // http_only
  sparse[idx] = varData.http_only ? 1.0 : -1.0;
  idx += 1;

  // secure
  sparse[idx] = varData.secure ? 1.0 : -1.0;
  idx += 1;

  // session
  sparse[idx] = varData.session ? 1.0 : -1.0;
  idx += 1;

  // same_site (3 features)
  if (varData.same_site === 'no_restriction') sparse[idx] = 1.0;
  else if (varData.same_site === 'lax' || varData.same_site === 'unspecified') sparse[idx + 1] = 1.0;
  else if (varData.same_site === 'strict') sparse[idx + 2] = 1.0;
  idx += 3;

  // expiry
  sparse[idx] = varData.expiry;
  idx += 1;

  // expiry_extra (8 features)
  const exp = varData.expiry;
  sparse[idx] = exp < 3600 ? 1.0 : -1.0;
  sparse[idx + 1] = (exp >= 3600 && exp < 3600 * 12) ? 1.0 : -1.0;
  sparse[idx + 2] = (exp >= 3600 * 12 && exp < 3600 * 24) ? 1.0 : -1.0;
  sparse[idx + 3] = (exp >= 3600 * 24 && exp < 3600 * 24 * 7) ? 1.0 : -1.0;
  sparse[idx + 4] = (exp >= 3600 * 24 * 7 && exp < 3600 * 24 * 30) ? 1.0 : -1.0;
  sparse[idx + 5] = (exp >= 3600 * 24 * 30 && exp < 3600 * 24 * 30 * 6) ? 1.0 : -1.0;
  sparse[idx + 6] = (exp >= 3600 * 24 * 30 * 6 && exp < 3600 * 24 * 30 * 18) ? 1.0 : -1.0;
  sparse[idx + 7] = exp >= 3600 * 24 * 30 * 18 ? 1.0 : -1.0;
  idx += 8;

  // content_length
  sparse[idx] = decodedValue.length;
  idx += 1;

  // compressed content (2 features)
  try {
    const comp = LZString.compress(varData.value);
    sparse[idx] = comp.length;
    sparse[idx + 1] = varData.value.length - comp.length;
  } catch {
    sparse[idx] = varData.value.length;
    sparse[idx + 1] = 0;
  }
  idx += 2;

  // shannon entropy
  sparse[idx] = computeEntropy(decodedValue);
  idx += 1;

  // url encoding (1 feature)
  sparse[idx] = (varData.value !== decodedValue) ? 1.0 : -1.0;
  idx += 1;

  // delimiter separated (9 features)
  const sepResult = chooseBestSeparator(decodedValue, separators, 1);
  for (let i = 0; i < 9; i++) sparse[idx + i] = -1;
  if (sepResult.sep !== null) {
    sparse[idx + sepResult.index] = sepResult.count + 1;
  }
  idx += 9;

  // base64 encoded (1 feature)
  try {
    atob(varData.value);
    sparse[idx] = 1.0;
  } catch {
    sparse[idx] = -1.0;
  }
  idx += 1;

  // contains JS object (1 feature)
  try {
    JSON.parse(decodedValue);
    sparse[idx] = 1.0;
  } catch {
    sparse[idx] = -1.0;
  }
  idx += 1;

  // English terms in content (500 features)
  for (let i = 0; i < content_terms.length; i++) {
    sparse[idx + i] = content_terms[i].test(decodedValue) ? 1.0 : -1.0;
  }
  idx += 500;

  // CSV content (5 features)
  const csvResult = chooseBestSeparator(decodedValue, separators, 2);
  let containsNum = false, containsHex = false, containsAlpha = false, containsAlnum = false, containsBool = false;
  if (csvResult.sep) {
    const parts = decodedValue.split(csvResult.sep);
    for (const part of parts) {
      containsNum = containsNum || numRegex.test(part);
      containsHex = containsHex || hexRegex.test(part);
      containsAlpha = containsAlpha || alphaRegex.test(part);
      containsAlnum = containsAlnum || alnumRegex.test(part);
      containsBool = containsBool || truthValueRegex.test(part);
    }
  }
  sparse[idx] = containsNum ? 1.0 : -1.0;
  sparse[idx + 1] = containsHex ? 1.0 : -1.0;
  sparse[idx + 2] = containsAlpha ? 1.0 : -1.0;
  sparse[idx + 3] = containsAlnum ? 1.0 : -1.0;
  sparse[idx + 4] = containsBool ? 1.0 : -1.0;
  idx += 5;

  // JS content features (11 features) - simplified
  for (let i = 0; i < 11; i++) sparse[idx + i] = -1.0;
  idx += 11;

  // Numerical content
  sparse[idx] = numRegex.test(decodedValue) ? 1.0 : -1.0;
  idx += 1;

  // Hex content
  sparse[idx] = hexRegex.test(decodedValue) ? 1.0 : -1.0;
  idx += 1;

  // Alpha content
  sparse[idx] = alphaRegex.test(decodedValue) ? 1.0 : -1.0;
  idx += 1;

  // Is identifier
  sparse[idx] = codeIdentRegex.test(decodedValue) ? 1.0 : -1.0;
  idx += 1;

  // All uppercase
  sparse[idx] = (alphaAnyRegex.test(decodedValue) && decodedValue === decodedValue.toUpperCase()) ? 1.0 : -1.0;
  idx += 1;

  // All lowercase
  sparse[idx] = (alphaAnyRegex.test(decodedValue) && decodedValue === decodedValue.toLowerCase()) ? 1.0 : -1.0;
  idx += 1;

  // Empty content
  sparse[idx] = !varData.value ? 1.0 : -1.0;
  idx += 1;

  // Boolean content
  sparse[idx] = truthValueRegex.test(decodedValue) ? 1.0 : -1.0;
  idx += 1;

  // Timestamp content
  sparse[idx] = unixTimestampRegex.test(decodedValue) ? 1.0 : -1.0;
  idx += 1;

  // Date content
  const hasDate = patternYearMonthDay.test(decodedValue) ||
    patternDayMonthYear.test(decodedValue) ||
    patternMonthDayYear.test(decodedValue) ||
    ((patternAlpha3DaysEng.test(decodedValue) || patternFullDaysEng.test(decodedValue)) &&
      (patternAlpha3MonthsEng.test(decodedValue) || patternFullMonthsEng.test(decodedValue)));
  sparse[idx] = hasDate ? 1.0 : -1.0;
  idx += 1;

  // UUID (6 features)
  const uuidMatch = decodedValue.match(uuidRegex);
  for (let i = 0; i < 6; i++) sparse[idx + i] = -1.0;
  if (uuidMatch) {
    const ver = parseInt(uuidMatch[1]);
    if (ver > 0 && ver < 6) sparse[idx + ver - 1] = 1.0;
    else sparse[idx + 5] = 1.0;
  }
  idx += 6;

  // URL content
  sparse[idx] = (httpRegex.test(decodedValue) || wwwRegex.test(decodedValue)) ? 1.0 : -1.0;

  return sparse;
};

// ============================================================================
// MAIN BACKGROUND LOGIC
// ============================================================================

interface UserPreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  autoFillEnabled: boolean;
  showWidget: boolean;
}

interface CookieStats {
  necessary: number;
  functional: number;
  analytics: number;
  advertising: number;
  blocked: number;
}

let userPreferences: UserPreferences = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
  autoFillEnabled: true,
  showWidget: true
};

let cookieStats: CookieStats = {
  necessary: 0,
  functional: 0,
  analytics: 0,
  advertising: 0,
  blocked: 0
};

let isInitialized = false;

const loadPreferences = async () => {
  const result = await chrome.storage.sync.get('privacomply-preferences');
  if (result['privacomply-preferences']) {
    userPreferences = result['privacomply-preferences'] as UserPreferences;
  }
};

const classifyCookie = (cookie: chrome.cookies.Cookie): number => {
  const cookieData: CookieData = {
    name: escapeString(cookie.name),
    domain: escapeString(cookie.domain),
    path: escapeString(cookie.path),
    variable_data: [{
      host_only: cookie.hostOnly,
      http_only: cookie.httpOnly,
      secure: cookie.secure,
      session: cookie.session,
      expiry: datetimeToExpiry(cookie),
      value: escapeString(cookie.value),
      same_site: escapeString(cookie.sameSite)
    }]
  };

  const features = extractFeatures(cookieData);
  return predictClass(features, 1.0);
};

const shouldBlockCookie = (label: number): boolean => {
  switch (label) {
    case 0: return false; // Necessary - never block
    case 1: return !userPreferences.functional;
    case 2: return !userPreferences.analytics;
    case 3: return !userPreferences.marketing;
    default: return false;
  }
};

const removeCookie = async (cookie: chrome.cookies.Cookie) => {
  const domain = cookie.domain.replace(/^\./, '');
  const protocols = ['https://', 'http://'];

  for (const protocol of protocols) {
    try {
      await chrome.cookies.remove({
        url: `${protocol}${domain}${cookie.path}`,
        name: cookie.name,
        storeId: cookie.storeId
      });
      return true;
    } catch {
      continue;
    }
  }
  return false;
};

const handleCookie = async (cookie: chrome.cookies.Cookie) => {
  if (!isInitialized) return;

  const label = classifyCookie(cookie);
  console.info(`CookieBlock Debug: '${cookie.name}' classified as '${classIndexToString(label)}'`);
  const categoryName = classIndexToString(label);

  // Update stats
  switch (label) {
    case 0: cookieStats.necessary++; break;
    case 1: cookieStats.functional++; break;
    case 2: cookieStats.analytics++; break;
    case 3: cookieStats.advertising++; break;
  }

  // Check if should block
  if (shouldBlockCookie(label)) {
    const removed = await removeCookie(cookie);
    if (removed) {
      cookieStats.blocked++;
      console.log(`CookieBlock: Blocked ${categoryName} cookie: ${cookie.name} (${cookie.domain})`);
    }
  } else {
    console.debug(`CookieBlock: Allowed ${categoryName} cookie: ${cookie.name} (${cookie.domain})`);
  }
};

// ============================================================================
// THIRD-PARTY TRACKER DETECTION
// ============================================================================

let trackerMap: Record<string, string> = {};

const loadTrackerMap = async () => {
  try {
    const response = await fetch(chrome.runtime.getURL('trackers.json'));
    trackerMap = await response.json();
    console.log('PrivaComply: Tracker map loaded with', Object.keys(trackerMap).length, 'entries');
  } catch (e) {
    console.error('PrivaComply: Failed to load tracker map', e);
  }
};

// tabId -> hostname (persists across webRequest calls within same SW lifetime)
const tabUrls: Record<number, string> = {};

// Per-tab tracker data stored in memory — also flushed to storage.local for persistence
const tabTrackers: Record<number, Record<string, { category: string; count: number; types: string[] }>> = {};

const TRACKER_STORAGE_KEY = 'privacomply-trackers';

const extractRootDomain = (hostname: string): string => {
  const parts = hostname.split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : hostname;
};

const saveTrackerData = (tabId: number) => {
  const data = tabTrackers[tabId];
  if (!data) return;
  const stored: Record<string, object> = {};
  stored[`tab_${tabId}`] = data;
  chrome.storage.local.set({ [TRACKER_STORAGE_KEY]: { ...tabTrackers } });
};

const buildTrackerSummary = (tabId: number, tabUrl: string | undefined): object => {
  const entries = tabTrackers[tabId] || {};
  const trackers = Object.entries(entries).map(([domain, info]) => ({
    domain,
    category: info.category,
    requestCount: info.count,
    requestTypes: info.types,
  }));

  const summary = { total: 0, advertising: 0, analytics: 0, social: 0, cdn: 0, email: 0, unknown: 0 };
  trackers.forEach(t => {
    summary.total++;
    const cat = t.category.toLowerCase();
    if (cat === 'advertising') summary.advertising++;
    else if (cat === 'analytics') summary.analytics++;
    else if (cat === 'social') summary.social++;
    else if (cat === 'cdn') summary.cdn++;
    else if (cat === 'email') summary.email++;
    else summary.unknown++;
  });

  return { url: tabUrl || '', timestamp: new Date().toISOString(), trackers, summary };
};

// Restore persisted tracker data on SW startup
const restoreTrackerData = async () => {
  const result = await chrome.storage.local.get(TRACKER_STORAGE_KEY);
  const saved = result[TRACKER_STORAGE_KEY] as Record<number, Record<string, { category: string; count: number; types: string[] }>> | undefined;
  if (saved) {
    Object.assign(tabTrackers, saved);
    console.log('PrivaComply: Restored tracker data for', Object.keys(saved).length, 'tabs');
  }
};

// ============================================================================
// ACTIVE TAB TRACKING
// ============================================================================

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.startsWith('http')) {
      tabUrls[activeInfo.tabId] = new URL(tab.url).hostname;
    }
  } catch { /* ignore */ }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && changeInfo.url.startsWith('http')) {
    tabUrls[tabId] = new URL(changeInfo.url).hostname;
  }
  // Clear tracker data on new page load
  if (changeInfo.status === 'loading' && changeInfo.url) {
    delete tabTrackers[tabId];
    saveTrackerData(tabId);
  }
});

// Seed tabUrls for all open tabs on SW startup
chrome.tabs.query({}).then(tabs => {
  tabs.forEach(tab => {
    if (tab.id && tab.url && tab.url.startsWith('http')) {
      tabUrls[tab.id] = new URL(tab.url).hostname;
    }
  });
});

// webRequest listener — captures all third-party requests per tab
chrome.webRequest.onBeforeRequest.addListener(
  (details): undefined => {
    if (!details.tabId || details.tabId < 0) return undefined;

    // Load trackerMap lazily if it got wiped during SW restart
    if (Object.keys(trackerMap).length === 0) return undefined;

    const tabHostname = tabUrls[details.tabId];
    if (!tabHostname) return undefined;

    try {
      const requestHostname = new URL(details.url).hostname;
      const requestRoot = extractRootDomain(requestHostname);
      const tabRoot = extractRootDomain(tabHostname);

      // Skip first-party requests
      if (requestRoot === tabRoot) return undefined;

      const category = trackerMap[requestHostname] || trackerMap[requestRoot];
      if (!category) return undefined;

      if (!tabTrackers[details.tabId]) tabTrackers[details.tabId] = {};

      const existing = tabTrackers[details.tabId][requestRoot];
      if (existing) {
        existing.count++;
        if (!existing.types.includes(details.type)) existing.types.push(details.type);
      } else {
        tabTrackers[details.tabId][requestRoot] = { category, count: 1, types: [details.type] };
      }

      // Debounce storage writes — only persist every 5 new entries
      const total = Object.keys(tabTrackers[details.tabId]).length;
      if (total % 5 === 0) saveTrackerData(details.tabId);

      console.log(`PrivaComply Tracker: [${category}] ${requestRoot} on tab ${details.tabId}`);
    } catch { /* ignore invalid URLs */ }

    return undefined;
  },
  { urls: ['<all_urls>'] }
);

// Initialize
const init = async () => {
  console.log('PrivaComply: Initializing CookieBlock ML classifier...');

  try {
    await loadPreferences();
    await loadTrackerMap();
    await restoreTrackerData();
    await setupFeatureResources();
    await loadForests();

    isInitialized = true;
    console.log('PrivaComply: CookieBlock ML classifier ready!');

    // Start monitoring cookies for the current tab only
    chrome.cookies.onChanged.addListener((changeInfo) => {
      if (!changeInfo.removed) {
        const cookieDomain = changeInfo.cookie.domain.startsWith('.')
          ? changeInfo.cookie.domain.substring(1)
          : changeInfo.cookie.domain;

        // Check against any known tab URL
        const activeTabUrl = Object.values(tabUrls).find(url =>
          url.endsWith(cookieDomain) || cookieDomain.endsWith(url)
        );
        if (activeTabUrl) {
          handleCookie(changeInfo.cookie);
        }
      }
    });
  } catch (error) {
    console.error('PrivaComply: Failed to initialize CookieBlock:', error);
  }
};

init();

// ============================================================================
// COMPLIANCE CHECK (long-running — must live in background, not popup)
// ============================================================================

const RAG_API_URL = 'http://localhost:8000/analyze';

const performComplianceCheck = async (url: string, regulation: string): Promise<void> => {
  await chrome.storage.local.set({
    compliance_check: { status: 'scanning', url, regulation, timestamp: Date.now() },
  });

  try {
    const response = await fetch(RAG_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, regulation }),
    });

    if (!response.ok) {
      const err: { error?: string } = await response.json().catch(() => ({ error: 'Server error' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    const completedAt = Date.now();

    await chrome.storage.local.set({
      compliance_check: { status: 'complete', url, regulation, result, timestamp: completedAt },
    });

    // Append to scan history — use await so the service worker doesn't terminate early
    const historyData = await chrome.storage.local.get('compliance_history');
    const history = (historyData['compliance_history'] as Record<string, unknown>[]) || [];
    const historyEntry: Record<string, unknown> = { url, regulation, result, timestamp: completedAt };
    await chrome.storage.local.set({
      compliance_history: [historyEntry, ...history].slice(0, 50),
    });
  } catch (error) {
    await chrome.storage.local.set({
      compliance_check: {
        status: 'error',
        url,
        regulation,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      },
    });
  }
};

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id;

    switch (message.type) {
    case 'START_COMPLIANCE_CHECK':
      // Fire-and-forget — result lands in chrome.storage.local['compliance_check']
      performComplianceCheck(message.url, message.regulation);
      sendResponse({ success: true });
      break;

    case 'CLEAR_COMPLIANCE_RESULT':
      chrome.storage.local.remove('compliance_check');
      sendResponse({ success: true });
      break;

    case 'CLEAR_COMPLIANCE_HISTORY':
      chrome.storage.local.remove('compliance_history');
      sendResponse({ success: true });
      break;

    case 'GET_PREFERENCES':
      sendResponse({ success: true, preferences: userPreferences });
            break;

        case 'SAVE_PREFERENCES':
      userPreferences = message.preferences;
      chrome.storage.sync.set({ 'privacomply-preferences': userPreferences });
      // Notify all tabs
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach((tab) => {
                        if (tab.id) {
                            chrome.tabs.sendMessage(tab.id, {
                                type: 'PREFERENCES_CHANGED',
              data: { preferences: userPreferences }
            }).catch(() => {});
                        }
                    });
                });
                sendResponse({ success: true });
      break;

    case 'GET_COOKIE_STATS':
      sendResponse({ success: true, stats: cookieStats });
      break;

    case 'GET_TRACKER_DATA':
      chrome.tabs.query({ currentWindow: true }).then(async tabs => {
        // Prefer the active non-extension tab; fall back to any tab with tracker data
        const realTabs = tabs.filter(t => t.url && t.url.startsWith('http'));
        const activeReal = realTabs.find(t => t.active) || realTabs.find(t => t.id !== undefined && tabTrackers[t.id!]) || realTabs[0];
        const tab = activeReal;
        const tabId = tab?.id;
        const tabUrl = tab?.url;
        if (tabId === undefined) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        // If in-memory data is missing (SW restarted), load from storage
        if (!tabTrackers[tabId]) {
          const stored = await chrome.storage.local.get(TRACKER_STORAGE_KEY);
          const saved = stored[TRACKER_STORAGE_KEY] as typeof tabTrackers | undefined;
          if (saved?.[tabId]) tabTrackers[tabId] = saved[tabId];
        }
        const data = buildTrackerSummary(tabId, tabUrl);
        sendResponse({ success: true, data });
      });
      break;

    case 'CLASSIFY_COOKIE':
      if (message.cookie) {
        const label = classifyCookie(message.cookie);
        sendResponse({ success: true, label, category: classIndexToString(label) });
      } else {
        sendResponse({ success: false, error: 'No cookie provided' });
      }
      break;

    case 'CMP_SEARCHING':
    case 'CMP_HANDLED':
    case 'CMP_ERROR':
    case 'CMP_NOTHING':
      // Handle consent engine status
      if (tabId) {
        const badgeConfig: Record<string, { text: string; color: string }> = {
          'CMP_SEARCHING': { text: '...', color: '#667eea' },
          'CMP_HANDLED': { text: '✓', color: '#10b981' },
          'CMP_ERROR': { text: '!', color: '#ef4444' },
          'CMP_NOTHING': { text: '', color: '#667eea' }
        };
        const config = badgeConfig[message.type];
        chrome.action.setBadgeText({ text: config.text, tabId });
        chrome.action.setBadgeBackgroundColor({ color: config.color, tabId });
      }
      sendResponse({ success: true });
      break;

        default:
            sendResponse({ success: false, error: 'Unknown message type' });
    }

  return true; // Keep channel open for async responses
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
    chrome.storage.sync.set({ 'privacomply-preferences': userPreferences });
        chrome.runtime.openOptionsPage();
    }
});
