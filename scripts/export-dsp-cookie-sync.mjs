/**
 * Export DSP id/name + linked cookie sync configs to CSV (stdout).
 * Only rows with Sync Resolver = INTERNAL (skips EXTERNAL).
 * Usage: AYL_TOKEN=your_token node scripts/export-dsp-cookie-sync.mjs > out.csv
 */

const BASE = 'https://back.platform.gcp.omnitagjs.com/bo-api';
const TOKEN = process.env.AYL_TOKEN;

if (!TOKEN) {
  console.error('Usage: AYL_TOKEN=<token> node scripts/export-dsp-cookie-sync.mjs > dsp_cookie_sync.csv');
  process.exit(1);
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'x-ayl-auth-token': TOKEN,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} → ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}`);
  }
}

function csvEscape(s) {
  if (s == null || s === undefined) return '';
  const str = String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function syncResolverOf(c) {
  const v = c?.sync_resolver ?? c?.SyncResolver ?? '';
  return String(v).trim().toUpperCase();
}

/** Only macro values from parameters (e.g. {partnerId}), not JSON keys. */
function macrosFromParameters(params) {
  if (!params || typeof params !== 'object') return '';
  return Object.values(params)
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim())
    .join(' | ');
}

/**
 * Official insert mode on cookie sync (User Sync UI: Insert Mode = IFRAME | PIXEL).
 */
function insertModeLabel(c) {
  const raw = c?.insert_mode ?? c?.InsertMode ?? '';
  const u = String(raw).trim().toUpperCase();
  if (u === 'IFRAME') return 'iframe';
  if (u === 'PIXEL') return 'pixel';
  return '';
}

/** Fallback per endpoint when insert_mode is missing (URL / legacy fields). */
function classifyEndpointFallback(ep) {
  const url = (ep && ep.url) || '';
  const explicit =
    ep?.format ||
    ep?.sync_type ||
    ep?.media_type ||
    ep?.endpoint_type ||
    ep?.kind ||
    '';
  if (explicit) {
    const e = String(explicit).toLowerCase();
    if (e.includes('iframe')) return 'iframe';
    if (e.includes('pixel')) return 'pixel';
    return e;
  }
  const u = url.toLowerCase();
  if (/iframe|useriframe|sync-iframe/.test(u)) return 'iframe';
  if (/\.(gif|jpg|jpeg|png|webp)(\?|$)/i.test(url)) return 'pixel';
  return 'other';
}

/** Pipe-separated URLs only. */
function endpointUrlsJoined(endpoints) {
  if (!Array.isArray(endpoints) || endpoints.length === 0) return '';
  const urls = [];
  for (const ep of endpoints) {
    const url = ep?.url != null ? String(ep.url).trim() : '';
    if (url) urls.push(url);
  }
  return urls.join(' | ');
}

/**
 * One cell: prefer cookie_sync.insert_mode (IFRAME/PIXEL); else one fallback per URL, pipe-separated.
 */
function iframeOrPixelColumn(c) {
  const fromApi = insertModeLabel(c);
  if (fromApi) return fromApi;

  const endpoints = Array.isArray(c.endpoints) ? c.endpoints : [];
  const parts = [];
  for (const ep of endpoints) {
    const url = ep?.url != null ? String(ep.url).trim() : '';
    if (!url) continue;
    parts.push(classifyEndpointFallback(ep));
  }
  return parts.join(' | ');
}

async function fetchAllPartners() {
  const pageSize = 500;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const body = {
      Filters: [],
      From: from,
      Order: [{ Field: 'UpdatedAt', Operator: 'desc' }],
      Size: pageSize,
    };
    const res = await fetchJson(`${BASE}/partners/search`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const chunk = Array.isArray(res.Data) ? res.Data : [];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return all;
}

async function main() {
  const partners = await fetchAllPartners();

  const header = [
    'dsp_uid',
    'dsp_name',
    'cookie_sync_uid',
    'cookie_sync_name',
    'endpoints_count',
    'enable_gdpr',
    'enable_gpp',
    'enable_usp',
    'enable_coppa',
    'only_win',
    'macro',
    'endpoint_url',
    'iframe_or_pixel',
  ];

  const out = [header.map(csvEscape).join(',')];

  for (const p of partners) {
    const dspUid = p.uid;
    let detail;
    try {
      detail = await fetchJson(`${BASE}/partners/${dspUid}`);
    } catch (e) {
      out.push(
        [dspUid, p.name || '', '', `GET_PARTNER_ERROR: ${e.message}`, '', '', '', '', '', '', '', '', ''].map(csvEscape).join(',')
      );
      continue;
    }

    const data = detail.Data ?? detail;
    const dspName = data.name || p.name || '';
    const syncIds = Array.isArray(data.cookie_sync_ids) ? data.cookie_sync_ids : [];

    if (syncIds.length === 0) {
      out.push(
        [dspUid, dspName, '', '', '0', '', '', '', '', '', '', '', ''].map(csvEscape).join(',')
      );
      continue;
    }

    for (const csUid of syncIds) {
      let csRes;
      try {
        csRes = await fetchJson(`${BASE}/cookie_sync/${csUid}`);
      } catch (e) {
        out.push(
          [dspUid, dspName, csUid, `GET_COOKIE_SYNC_ERROR: ${e.message}`, '', '', '', '', '', '', '', '', ''].map(csvEscape).join(',')
        );
        continue;
      }

      const c = csRes.Data ?? csRes;
      if (syncResolverOf(c) !== 'INTERNAL') {
        continue;
      }

      const endpoints = Array.isArray(c.endpoints) ? c.endpoints : [];
      const params = c.parameters && typeof c.parameters === 'object' ? c.parameters : {};

      out.push(
        [
          dspUid,
          dspName,
          csUid,
          c.name ?? '',
          String(endpoints.length),
          c.enable_gdpr ?? '',
          c.enable_gpp ?? '',
          c.enable_usp ?? '',
          c.enable_coppa ?? '',
          c.only_win ?? '',
          macrosFromParameters(params),
          endpointUrlsJoined(endpoints),
          iframeOrPixelColumn(c),
        ]
          .map(csvEscape)
          .join(',')
      );
    }
  }

  console.log(out.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
