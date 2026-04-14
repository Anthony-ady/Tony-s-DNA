/**
 * Edit Deal Page Component
 * 
 * This page allows editing of deal configurations with a clean DSP-style design.
 * It provides a multi-section layout for managing deal settings including basic info,
 * targeting, content, and advanced configurations.
 * 
 * Features:
 * - Multi-section navigation sidebar
 * - Real-time form updates with PUT requests
 * - Clean slate-colored design matching DSP template
 * - Comprehensive deal configuration management
 * - Error handling and loading states
 * - Responsive design with proper form validation
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import ToggleSwitch from '@/components/ui/toggle-switch';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Loader2, Save, X, AlertCircle, Users, ClipboardCopy, Globe2, Clock3, AppWindow, Monitor, Video, ImageIcon, Layers, Film, Target as TargetIcon, FileText, DollarSign, Smartphone, Sparkles, Search, Trash2, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { authService } from '../../services/authService';
import { cn } from '@/lib/utils';
import { TAILWIND_CLASSES } from '@/config/theme';
import { API_ENDPOINTS, apiUrl } from '@/config/api';
import EntityEditorLayout from '@/components/layouts/EntityEditorLayout';

const DEVICE_OPTIONS = ['DESKTOP', 'MOBILE', 'TABLET'];
const BROWSER_OPTIONS = [
  'CHROME',
  'FIREFOX',
  'SAFARI',
  'EDGE',
  'OPERA',
  'IE11_MORE',
  'IE10',
  'IE9_LESS',
  'UNKNOWN',
];
const OS_OPTIONS = ['ANDROID', 'IOS', 'WINDOWS PHONE', 'WINDOWS', 'MACOS', 'LINUX', 'OTHER', 'UNKNOWN'];

/** Values sent in Targeting.OpenwebSources / ExcludedOpenwebSources (align with bo-api). */
const OPENWEB_SOURCE_OPTIONS = [
  { value: 'conversation_header', label: 'Conversation - Header' },
  { value: 'conversation_header_siderail', label: 'Conversation - Header (Side-rail)' },
  { value: 'conversation', label: 'Conversation - Below' },
  { value: 'in_comment', label: 'In-Comment' },
  { value: 'in_comment_add_on', label: 'In-Comment add-on' },
  { value: 'in_comment_above_below', label: 'In-Comment - Above/Below' },
  { value: 'forums_sticky', label: 'Forums - Sticky' },
  { value: 'forums_categories', label: 'Forums - Categories' },
  { value: 'forums_threads', label: 'Forums - Threads' },
  { value: 'forums_in_comment', label: 'Forums - In-Comment' },
  { value: 'forums_in_comment_above_below', label: 'Forums - In-Comment - Above/Below' },
  { value: 'forums_conversation_below', label: 'Forums - Conversation - Below' },
  { value: 'iau', label: 'IAU' },
  { value: 'iau_dynamic', label: 'IAU - Dynamic' },
  { value: 'iau_homepage', label: 'IAU - Homepage' },
  { value: 'iau_sdk', label: 'IAU - SDK' },
  { value: 'popular_in_the_community', label: 'Popular in the community' },
  { value: 'popular_in_the_community_double_decker', label: 'Popular in the community - Double decker' },
  { value: 'reactions', label: 'Reactions' },
  { value: 'reactions_siderail', label: 'Reactions (Side-rail)' },
  { value: 'side_rail', label: 'Side-rail' },
  { value: 'topic_tracker', label: 'Topic Tracker' },
  { value: 'topic_tracker_siderail', label: 'Topic Tracker (Side-rail)' },
];

const AD_UNIT_OPTIONS = ['INFEED', 'INAD', 'INTEXT'];

const MEASUREMENT_SOLUTIONS = [
  { key: 'GMP', label: 'Green media' },
  { key: 'HIGH_ATTENTION', label: 'High attention' },
];

const GEO_SEARCH_BODY = {
  feature_class: [],
  feature_code: ['PCLI', 'PCLIX', 'PCLD', 'PCLS', 'PCLF'],
  limit: 300,
};

/** Deal region — single choice (stored in `Region`). */
const REGION_OPTIONS = ['Internal', 'FR', 'UK', 'US', 'EMEA', 'APAC'];

const defaultTargeting = () => ({
  AdNetwork: null,
  AdUnits: [],
  Apps: null,
  Browser: [],
  BrokerPartners: [],
  Devices: [],
  ExcludedIABCategories: null,
  ExcludedPlacements: null,
  ExcludedPublishers: null,
  ExcludedSites: null,
  ExcludedOpenwebSources: null,
  Sites: null,
  OS: [],
  BrowserLanguages: { Exclusions: [], Inclusions: [] },
  Geolocation: { Inclusion: [], Exclusion: [] },
  OpenwebSources: [],
  IABCategories: null,
  Integrations: null,
  Placements: null,
  Publishers: null,
  Segments: null,
  Semantic: null,
});

const MULTI_AD_KIND_A = 'AD_RAW_VIDEO';
const MULTI_AD_KIND_B = 'AD_OUTSTREAM';

const AD_KIND_MULTI_RULE_MSG =
  'With several ad formats selected, only « Video in banner » (AD_RAW_VIDEO) and « Outstream » (AD_OUTSTREAM) are allowed together.';

function isValidAdKindsCombo(kinds) {
  if (!kinds || kinds.length <= 1) return true;
  if (kinds.length > 2) return false;
  const s = new Set(kinds);
  return s.has(MULTI_AD_KIND_A) && s.has(MULTI_AD_KIND_B);
}

/** Normalize ad kinds from API (canonical `AdKinds`, legacy `Adkinds`, array or single string). */
function adKindsAsArray(dealLike) {
  if (!dealLike || typeof dealLike !== 'object') return [];
  const raw = dealLike.AdKinds !== undefined ? dealLike.AdKinds : dealLike.Adkinds;
  if (Array.isArray(raw)) return [...raw];
  if (typeof raw === 'string' && raw !== '') return [raw];
  return [];
}

const VIDEO_PAIR_ORDER = [MULTI_AD_KIND_A, MULTI_AD_KIND_B];
const VIDEO_PAIR_SET = new Set(VIDEO_PAIR_ORDER);

/** API payload uses FIRST_LOOK / SECOND_LOOK; legacy deals may still have HIGHEST / MEDIUM. */
function isPriorityOptionSelected(dealPriority, optionValue) {
  const p = String(dealPriority || '');
  const o = String(optionValue || '');
  if (p === o) return true;
  if (o === 'SECOND_LOOK' && p === 'MEDIUM') return true;
  if (o === 'FIRST_LOOK' && p === 'HIGHEST') return true;
  return false;
}

function formatPriorityKindForUi(kind) {
  const k = String(kind || '');
  if (k === 'FIRST_LOOK' || k === 'HIGHEST') return 'Highest';
  if (k === 'SECOND_LOOK' || k === 'MEDIUM') return 'Medium';
  if (k === 'OPEN') return 'Normal';
  return k;
}

/** API stores MinMargin as a fraction (e.g. 0.02 = 2%). Slider/UI use 0–100 (%). */
function minMarginStoredToSliderPercent(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || raw === '' || raw == null) return 0;
  if (n === 0) return 0;
  if (n > 1) return Math.min(100, Math.round(n));
  return Math.round(n * 100);
}

function minMarginSliderPercentToStored(percent) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent))));
  if (p === 0) return '0';
  return String(p / 100);
}

function extractPartnerNameFromPayload(json) {
  const p = json?.Data ?? json;
  if (!p || typeof p !== 'object') return undefined;
  const n = p.name ?? p.Name ?? p.display_name ?? p.DisplayName;
  return typeof n === 'string' && n.trim() ? n.trim() : undefined;
}

/** GET /users/:id — sale manager display (same idea as EditUser). */
function formatUserRecordDisplayName(d) {
  if (!d || typeof d !== 'object') return null;
  const full = [d.FirstName, d.LastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (d.Email && String(d.Email).trim()) return String(d.Email).trim();
  const n = d.Name ?? d.name;
  return typeof n === 'string' && n.trim() ? n.trim() : null;
}

/** localStorage cache for identical POST search bodies (pickers, partners, seats). */
const DEAL_SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const DEAL_SEARCH_LS_PREFIX = 'edy_deal_search_v1_';

function dealSearchCacheKey(endpointLabel, bodyObj) {
  return `${DEAL_SEARCH_LS_PREFIX}${endpointLabel}_${JSON.stringify(bodyObj)}`;
}

function readDealSearchCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.ts !== 'number' ||
      Date.now() - parsed.ts > DEAL_SEARCH_CACHE_TTL_MS
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeDealSearchCache(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), payload }));
  } catch {
    /* quota */
  }
}

/** Display label for a user row from POST /users/search (matches UserManagement). */
function getUserListDisplayName(u) {
  if (!u || typeof u !== 'object') return '';
  const first = (u.FirstName || '').trim();
  const last = (u.LastName || '').trim();
  if (first || last) return `${first} ${last}`.trim();
  return (u.Email || u.Uid || '').toString();
}

async function fetchBoEntityDisplayName(url, navigate, kind) {
  const token = authService.getToken();
  if (!token) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-ayl-auth-token': token,
      },
    });
    if (res.status === 401) {
      authService.handleUnauthorized?.(navigate);
      return null;
    }
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.Data ?? json;
    if (!d || typeof d !== 'object') return null;
    if (kind === 'user') return formatUserRecordDisplayName(d);
    const n = d.Name ?? d.name;
    return typeof n === 'string' && n.trim() ? n.trim() : null;
  } catch {
    return null;
  }
}

const EditDeal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dealId, setDealId] = useState('');
  const [dealName, setDealName] = useState('');
  const [dealData, setDealData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const [availableAudiences, setAvailableAudiences] = useState([]);
  const [audiencesLoading, setAudiencesLoading] = useState(false);
  const [audiencesError, setAudiencesError] = useState('');
  const [selectedAudienceId, setSelectedAudienceId] = useState('');
  const [activeSection, setActiveSection] = useState('general');
  const [excludedDealSearchQuery, setExcludedDealSearchQuery] = useState('');
  const [excludedDealSearchOpen, setExcludedDealSearchOpen] = useState(false);
  const [excludedDealSearchResults, setExcludedDealSearchResults] = useState([]);
  const [excludedDealSearchLoading, setExcludedDealSearchLoading] = useState(false);
  const [excludedDealSearchError, setExcludedDealSearchError] = useState('');
  const [addingExcludedDealUid, setAddingExcludedDealUid] = useState(null);
  const [excludedDealNameByUid, setExcludedDealNameByUid] = useState(() => ({}));
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [partnerSearchOpen, setPartnerSearchOpen] = useState(false);
  const [partnerSearchResults, setPartnerSearchResults] = useState([]);
  const [partnerSearchLoading, setPartnerSearchLoading] = useState(false);
  const [partnerSearchError, setPartnerSearchError] = useState('');
  const [addingPartnerUid, setAddingPartnerUid] = useState(null);
  const [partnerNameByUid, setPartnerNameByUid] = useState(() => ({}));
  /** Seat uid → display name (from POST /seats/search). Deal still stores seat uids in PartnersWhitelist.*.Seats. */
  const [seatNameByUid, setSeatNameByUid] = useState(() => ({}));
  /** partnerUid → seat rows from POST /seats/search (cached for filter). */
  const [seatCatalogByPartner, setSeatCatalogByPartner] = useState(() => ({}));
  const [seatSearchQueryByPartner, setSeatSearchQueryByPartner] = useState(() => ({}));
  const [seatCatalogLoadingUid, setSeatCatalogLoadingUid] = useState(null);
  /** Which partner row has the seat search popover open (close on outside click / Escape). */
  const [openSeatSearchPartnerUid, setOpenSeatSearchPartnerUid] = useState(null);
  const partnerSeatSearchRootRefs = useRef({});
  /** Partner UIDs for which /seats/search completed successfully (skip refetch). */
  const seatCatalogReadyRef = useRef(new Set());
  const seatCatalogInFlightRef = useRef(new Set());
  const [brokerSearchQuery, setBrokerSearchQuery] = useState('');
  const [brokerSearchOpen, setBrokerSearchOpen] = useState(false);
  const [brokerSearchResults, setBrokerSearchResults] = useState([]);
  const [brokerSearchLoading, setBrokerSearchLoading] = useState(false);
  const [brokerSearchError, setBrokerSearchError] = useState('');
  const [addingBrokerUid, setAddingBrokerUid] = useState(null);
  const [brokerNameByUid, setBrokerNameByUid] = useState(() => ({}));
  const [geoSearchQuery, setGeoSearchQuery] = useState('');
  const [geoSearchResults, setGeoSearchResults] = useState([]);
  const [geoSearchLoading, setGeoSearchLoading] = useState(false);
  const [geoSearchError, setGeoSearchError] = useState('');
  const [geoLabelById, setGeoLabelById] = useState(() => ({}));
  const [languagesMap, setLanguagesMap] = useState(() => ({}));
  const [languagesLoading, setLanguagesLoading] = useState(false);
  const [languagesError, setLanguagesError] = useState('');
  const [langSearchQuery, setLangSearchQuery] = useState('');
  const [resolvedCompanyName, setResolvedCompanyName] = useState('');
  const [resolvedRealmName, setResolvedRealmName] = useState('');
  const [resolvedSaleName, setResolvedSaleName] = useState('');
  const [entityNamesLoading, setEntityNamesLoading] = useState(false);

  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companyPickerQuery, setCompanyPickerQuery] = useState('');
  const [companyPickerResults, setCompanyPickerResults] = useState([]);
  const [companyPickerLoading, setCompanyPickerLoading] = useState(false);
  const companyPickerRootRef = useRef(null);

  const [salePickerOpen, setSalePickerOpen] = useState(false);
  const [salePickerQuery, setSalePickerQuery] = useState('');
  const [salePickerResults, setSalePickerResults] = useState([]);
  const [salePickerLoading, setSalePickerLoading] = useState(false);
  const salePickerRootRef = useRef(null);

  // Load deal ID from URL params
  useEffect(() => {
    const id = searchParams.get('id');
    const name = searchParams.get('name');
    if (id) {
      setDealId(id);
      setDealName(name || 'Deal');
      fetchDealData(id);
    }
  }, [searchParams]);

  useEffect(() => {
    seatCatalogReadyRef.current = new Set();
    seatCatalogInFlightRef.current = new Set();
    setSeatCatalogByPartner({});
    setSeatSearchQueryByPartner({});
    setOpenSeatSearchPartnerUid(null);
    partnerSeatSearchRootRefs.current = {};
    setBrokerNameByUid({});
    setBrokerSearchQuery('');
    setBrokerSearchOpen(false);
    setBrokerSearchResults([]);
    setExcludedDealNameByUid({});
    setExcludedDealSearchQuery('');
    setExcludedDealSearchOpen(false);
    setExcludedDealSearchResults([]);
  }, [dealId]);

  useEffect(() => {
    if (openSeatSearchPartnerUid == null) return;
    const onMouseDown = (e) => {
      const root = partnerSeatSearchRootRefs.current[openSeatSearchPartnerUid];
      if (root && !root.contains(e.target)) {
        setOpenSeatSearchPartnerUid(null);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpenSeatSearchPartnerUid(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openSeatSearchPartnerUid]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const token = authService.getToken();
      if (!token) return;
      const cacheKey = 'bo_languages_cache';
      const cacheTsKey = 'bo_languages_cache_ts';
      const CACHE_MS = 1000 * 60 * 60 * 24;
      try {
        const raw = localStorage.getItem(cacheKey);
        const ts = localStorage.getItem(cacheTsKey);
        if (raw && ts && Date.now() - parseInt(ts, 10) < CACHE_MS) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !cancelled) {
            setLanguagesMap(parsed);
            return;
          }
        }
      } catch {
        /* ignore cache */
      }
      setLanguagesLoading(true);
      setLanguagesError('');
      try {
        const res = await fetch(API_ENDPOINTS.LANGUAGES, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': token,
          },
        });
        if (!res.ok) {
          if (res.status === 401) authService.handleUnauthorized?.(navigate);
          throw new Error(`languages failed (${res.status})`);
        }
        const data = await res.json();
        const map = data?.Data && typeof data.Data === 'object' ? data.Data : {};
        if (!cancelled) {
          setLanguagesMap(map);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(map));
            localStorage.setItem(cacheTsKey, String(Date.now()));
          } catch {
            /* ignore quota */
          }
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setLanguagesError(e.message || 'Unable to load languages');
      } finally {
        if (!cancelled) setLanguagesLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!dealData) {
      setResolvedCompanyName('');
      setResolvedRealmName('');
      setResolvedSaleName('');
      setEntityNamesLoading(false);
      return;
    }
    const company = String(dealData.Company || '').trim();
    const realm = String(dealData.Realm || '').trim();
    const sale = String(dealData.Sale || '').trim();

    const needFetch = !!(company || realm || sale);
    if (!needFetch) {
      setEntityNamesLoading(false);
      return;
    }
    setEntityNamesLoading(true);

    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        const token = authService.getToken();
        if (!token || cancelled) {
          if (!cancelled) setEntityNamesLoading(false);
          return;
        }
        try {
          const [c, r, s] = await Promise.all([
            company
              ? fetchBoEntityDisplayName(apiUrl.company(company), navigate, 'entity')
              : Promise.resolve(null),
            realm ? fetchBoEntityDisplayName(apiUrl.realm(realm), navigate, 'entity') : Promise.resolve(null),
            sale ? fetchBoEntityDisplayName(apiUrl.user(sale), navigate, 'user') : Promise.resolve(null),
          ]);
          if (cancelled) return;
          setResolvedCompanyName(c || '');
          setResolvedRealmName(r || '');
          setResolvedSaleName(s || '');
        } finally {
          if (!cancelled) setEntityNamesLoading(false);
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dealId, dealData?.Company, dealData?.Realm, dealData?.Sale, navigate]);

  const runCompanySearch = useCallback(
    async (q) => {
      const token = authService.getToken();
      if (!token) return [];
      const filters = [];
      const realmUid = String(dealData?.Realm || '').trim();
      if (realmUid) filters.push({ Field: 'Realm_uid', Operator: 'match', Value: realmUid });
      if (q.trim()) filters.push({ Field: 'Name', Operator: 'contains', Value: q.trim() });
      const bodySpec = {
        Filters: filters,
        From: 0,
        Order: [{ Field: 'Name', Operator: 'asc' }],
        Size: 200,
      };
      const ckey = dealSearchCacheKey('companies', bodySpec);
      const cached = readDealSearchCache(ckey);
      if (cached !== null) return cached;
      try {
        const res = await fetch(API_ENDPOINTS.COMPANIES_SEARCH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': token,
          },
          body: JSON.stringify(bodySpec),
        });
        if (res.status === 401) {
          authService.handleUnauthorized(navigate);
          return [];
        }
        if (!res.ok) return [];
        const data = await res.json();
        const rows = Array.isArray(data.Data) ? data.Data : [];
        const out = rows.filter((c) => c.Visibility !== -1);
        writeDealSearchCache(ckey, out);
        return out;
      } catch {
        return [];
      }
    },
    [navigate, dealData?.Realm],
  );

  const runSaleUserSearch = useCallback(
    async (q) => {
      const token = authService.getToken();
      if (!token) return [];
      const realmUid = String(dealData?.Realm || '').trim();
      if (!realmUid) return [];
      const fetchBody = {
        Filters: [{ Field: 'Realm_uid', Operator: 'match', Value: realmUid }],
        From: 0,
        Order: [{ Field: 'LastSignInAt', Operator: 'desc' }],
        Size: 500,
      };
      const ckey = dealSearchCacheKey('users_by_realm', fetchBody);
      let fullRows = readDealSearchCache(ckey);
      try {
        if (fullRows === null) {
          const res = await fetch(API_ENDPOINTS.USERS_SEARCH, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-ayl-auth-token': token,
            },
            body: JSON.stringify(fetchBody),
          });
          if (res.status === 401) {
            authService.handleUnauthorized(navigate);
            return [];
          }
          if (!res.ok) return [];
          const data = await res.json();
          fullRows = Array.isArray(data.Data) ? data.Data : [];
          writeDealSearchCache(ckey, fullRows);
        }
        let rows = fullRows;
        const qq = q.trim().toLowerCase();
        if (qq) {
          rows = rows.filter((u) => {
            const label = getUserListDisplayName(u).toLowerCase();
            const email = String(u.Email || '').toLowerCase();
            return (
              label.includes(qq) ||
              email.includes(qq) ||
              String(u.Uid || '')
                .toLowerCase()
                .includes(qq)
            );
          });
        }
        return rows.slice(0, 80);
      } catch {
        return [];
      }
    },
    [navigate, dealData?.Realm],
  );

  useEffect(() => {
    if (!companyPickerOpen) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setCompanyPickerLoading(true);
      try {
        const rows = await runCompanySearch(companyPickerQuery);
        if (!cancelled) setCompanyPickerResults(rows);
      } finally {
        if (!cancelled) setCompanyPickerLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [companyPickerOpen, companyPickerQuery, runCompanySearch]);

  useEffect(() => {
    if (!salePickerOpen) return;
    const realmUid = String(dealData?.Realm || '').trim();
    if (!realmUid) {
      setSalePickerResults([]);
      setSalePickerLoading(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSalePickerLoading(true);
      try {
        const rows = await runSaleUserSearch(salePickerQuery);
        if (!cancelled) setSalePickerResults(rows);
      } finally {
        if (!cancelled) setSalePickerLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [salePickerOpen, salePickerQuery, runSaleUserSearch, dealData?.Realm]);

  useEffect(() => {
    const anyOpen = companyPickerOpen || salePickerOpen;
    if (!anyOpen) return;
    const onMouseDown = (e) => {
      const roots = [companyPickerRootRef.current, salePickerRootRef.current];
      if (roots.some((el) => el && el.contains(e.target))) return;
      setCompanyPickerOpen(false);
      setSalePickerOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setCompanyPickerOpen(false);
        setSalePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [companyPickerOpen, salePickerOpen]);

  const fetchDealData = async (id) => {
    setLoading(true);
    setError('');

    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(apiUrl.deal(id), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Deal data fetched:', data);
      const loaded = data.Data;
      if (!loaded) {
        setDealData(null);
      } else {
        const audienceList = Array.isArray(loaded.Audiences) ? loaded.Audiences : [];
        setDealData({
          ...loaded,
          Curated: audienceList.length > 0,
        });
      }
      setDealName(prev => prev || data.Data?.Name || 'Deal');
    } catch (err) {
      console.error('Error fetching deal data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dealData) return;

    if (!isValidAdKindsCombo(adKindsAsArray(dealData))) {
      setError(AD_KIND_MULTI_RULE_MSG);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Remove null fields before sending
      const cleanedData = removeNullFields(dealData);

      const response = await fetch(apiUrl.deal(dealId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify({
          Data: cleanedData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setSuccess('Deal updated successfully!');
      setIsSuccessVisible(true);
      setTimeout(() => {
        setSuccess('');
        setIsSuccessVisible(false);
      }, 3000);
      
      if (cleanedData.Name) {
        setDealName(cleanedData.Name);
      }
      // Reload deal data to get updated LockVersion
      await fetchDealData(dealId);
    } catch (err) {
      console.error('Error saving deal:', err);
      setError(err.message);
    } finally {
      setSaving(false);
      setIsSuccessVisible(false);
    }
  };

  const dealAudiences = dealData?.Audiences;

  useEffect(() => {
    const fetchAudiences = async () => {
      if (!dealAudiences || dealAudiences.length === 0) return;
      if (availableAudiences.length > 0) return;

      const token = authService.getToken();
      if (!token) return;

      try {
        setAudiencesError('');
        setAudiencesLoading(true);

        const cachedAudiences = localStorage.getItem('deal_audiences_cache');
        const cacheTimestamp = localStorage.getItem('deal_audiences_cache_timestamp');
        const now = Date.now();
        const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

        if (cachedAudiences && cacheTimestamp && (now - parseInt(cacheTimestamp, 10)) < CACHE_DURATION) {
          try {
            const parsed = JSON.parse(cachedAudiences);
            setAvailableAudiences(Array.isArray(parsed) ? parsed : []);
            return;
          } catch {
            // Cache corrupted, fall through to refetch
          }
        }

        const response = await fetch(API_ENDPOINTS.DEALS_AUDIENCES, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': token,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            authService.handleUnauthorized?.(navigate);
          }
          throw new Error(`Failed to load audiences (${response.status})`);
        }

        const data = await response.json();
        const normalized = Array.isArray(data) ? data : [];
        setAvailableAudiences(normalized);
        localStorage.setItem('deal_audiences_cache', JSON.stringify(normalized));
        localStorage.setItem('deal_audiences_cache_timestamp', String(Date.now()));
      } catch (err) {
        console.error('Error fetching audiences:', err);
        setAudiencesError(err.message || 'Unable to load audiences');
      } finally {
        setAudiencesLoading(false);
      }
    };

    fetchAudiences();
  }, [dealAudiences, availableAudiences.length, navigate]);

  const removeNullFields = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(removeNullFields);
    if (typeof obj !== 'object') return obj;

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = removeNullFields(value);
      }
    }
    return cleaned;
  };

  const mergeTargeting = (updater) => {
    setDealData((prev) => {
      const t = { ...defaultTargeting(), ...(prev?.Targeting || {}) };
      const nextT = typeof updater === 'function' ? updater(t) : { ...t, ...updater };
      return { ...prev, Targeting: nextT };
    });
  };

  const toggleInTargetingArray = (field, item) => {
    mergeTargeting((t) => {
      const cur = Array.isArray(t[field]) ? t[field] : [];
      const has = cur.includes(item);
      return { ...t, [field]: has ? cur.filter((x) => x !== item) : [...cur, item] };
    });
  };

  const toggleDistributionChannel = (channel) => {
    setDealData((prev) => {
      const cur = Array.isArray(prev.DistributionChannelKinds) ? prev.DistributionChannelKinds : [];
      const has = cur.includes(channel);
      const next = has ? cur.filter((c) => c !== channel) : [...cur, channel];
      if (next.length === 0) return prev;
      return { ...prev, DistributionChannelKinds: next };
    });
  };

  const toggleMeasurementSolution = (key) => {
    setDealData((prev) => {
      const cur = Array.isArray(prev.MeasurementSolutions) ? prev.MeasurementSolutions : [];
      const has = cur.includes(key);
      return {
        ...prev,
        MeasurementSolutions: has ? cur.filter((k) => k !== key) : [...cur, key],
      };
    });
  };

  const toggleAdUnit = (unit) => {
    mergeTargeting((t) => {
      const cur = Array.isArray(t.AdUnits) ? t.AdUnits : [];
      const has = cur.includes(unit);
      return { ...t, AdUnits: has ? cur.filter((u) => u !== unit) : [...cur, unit] };
    });
  };

  const addSeatToWhitelist = (partnerUid, seatUid, seatName) => {
    const s = String(seatUid || '').trim();
    if (!s || !partnerUid) return;
    const label =
      seatName && String(seatName).trim() ? String(seatName).trim() : s;
    setSeatNameByUid((prev) => ({ ...prev, [s]: label }));
    setDealData((prev) => {
      const pw = { ...(prev?.PartnersWhitelist || {}) };
      const cur = pw[partnerUid] || { Seats: [] };
      const seats = [...(cur.Seats || [])];
      if (seats.includes(s)) return prev;
      seats.push(s);
      pw[partnerUid] = { Seats: seats };
      return { ...prev, PartnersWhitelist: pw };
    });
  };

  const removeSeatFromWhitelist = (partnerUid, seatUid) => {
    const s = String(seatUid);
    setDealData((prev) => {
      const pw = { ...(prev?.PartnersWhitelist || {}) };
      const cur = pw[partnerUid];
      if (!cur) return prev;
      const seats = (cur.Seats || []).filter((x) => String(x) !== s);
      pw[partnerUid] = { Seats: seats };
      return { ...prev, PartnersWhitelist: pw };
    });
  };

  const loadSeatCatalogForPartner = async (partnerUid) => {
    if (!partnerUid) return;
    if (seatCatalogReadyRef.current.has(partnerUid) || seatCatalogInFlightRef.current.has(partnerUid)) return;
    seatCatalogInFlightRef.current.add(partnerUid);
    setSeatCatalogLoadingUid(partnerUid);
    try {
      const { seatUids, nameBySeatUid } = await fetchSeatsForPartner(partnerUid);
      const rows = seatUids.map((sid) => ({ uid: sid, name: nameBySeatUid[sid] || sid }));
      setSeatCatalogByPartner((prev) => ({ ...prev, [partnerUid]: rows }));
      if (Object.keys(nameBySeatUid).length) {
        setSeatNameByUid((prev) => ({ ...prev, ...nameBySeatUid }));
      }
      seatCatalogReadyRef.current.add(partnerUid);
    } finally {
      seatCatalogInFlightRef.current.delete(partnerUid);
      setSeatCatalogLoadingUid(null);
    }
  };

  const fetchPartnerNameFromApi = useCallback(async (uid) => {
    const token = authService.getToken();
    if (!token || !uid) return undefined;
    try {
      const res = await fetch(apiUrl.partner(uid), {
        headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        if (res.status === 401) authService.handleUnauthorized?.(navigate);
        return undefined;
      }
      const json = await res.json();
      return extractPartnerNameFromPayload(json);
    } catch {
      return undefined;
    }
  }, [navigate]);

  const fetchBrokerNameFromApi = useCallback(async (uid) => {
    const token = authService.getToken();
    if (!token || !uid) return undefined;
    try {
      const res = await fetch(apiUrl.brokerPartner(uid), {
        headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        if (res.status === 401) authService.handleUnauthorized?.(navigate);
        return undefined;
      }
      const json = await res.json();
      return extractPartnerNameFromPayload(json);
    } catch {
      return undefined;
    }
  }, [navigate]);

  const fetchDealNameFromApi = useCallback(async (uid) => {
    const token = authService.getToken();
    if (!token || !uid) return undefined;
    try {
      const res = await fetch(apiUrl.deal(uid), {
        headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        if (res.status === 401) authService.handleUnauthorized?.(navigate);
        return undefined;
      }
      const json = await res.json();
      return extractPartnerNameFromPayload(json);
    } catch {
      return undefined;
    }
  }, [navigate]);

  const addExcludedDealFromSearch = async (uid, searchHitName) => {
    if (!uid) return;
    setAddingExcludedDealUid(uid);
    try {
      if (searchHitName) {
        setExcludedDealNameByUid((prev) => ({ ...prev, [uid]: searchHitName }));
      }
      const nameFromApi = await fetchDealNameFromApi(uid);
      if (nameFromApi) {
        setExcludedDealNameByUid((prev) => ({ ...prev, [uid]: nameFromApi }));
      }
      setDealData((prev) => {
        const cur = Array.isArray(prev.ExcludedDeals) ? prev.ExcludedDeals : [];
        if (cur.some((x) => String(x) === String(uid))) return prev;
        return { ...prev, ExcludedDeals: [...cur, uid] };
      });
      setExcludedDealSearchOpen(false);
      setExcludedDealSearchQuery('');
    } finally {
      setAddingExcludedDealUid(null);
    }
  };

  const removeExcludedDeal = (id) => {
    const s = String(id);
    setDealData((prev) => ({
      ...prev,
      ExcludedDeals: (Array.isArray(prev.ExcludedDeals) ? prev.ExcludedDeals : []).filter((x) => String(x) !== s),
    }));
    setExcludedDealNameByUid((prev) => {
      if (!Object.hasOwn(prev, s)) return prev;
      const next = { ...prev };
      delete next[s];
      return next;
    });
  };

  /** Seat uids + labels from POST /seats/search (empty Data is normal). */
  const fetchSeatsForPartner = useCallback(async (partnerUid) => {
    const token = authService.getToken();
    if (!token || !partnerUid) return { seatUids: [], nameBySeatUid: {} };
    const bodySpec = {
      Filters: [{ Field: 'PartnerUid', Operator: 'match', Value: partnerUid }],
      From: 0,
      Order: [{ Field: 'UpdatedAt', Operator: 'desc' }],
      Size: 250,
    };
    const ckey = dealSearchCacheKey('seats', bodySpec);
    const cached = readDealSearchCache(ckey);
    if (cached !== null) return cached;
    try {
      const res = await fetch(API_ENDPOINTS.SEATS_SEARCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
        body: JSON.stringify(bodySpec),
      });
      if (!res.ok) {
        if (res.status === 401) authService.handleUnauthorized?.(navigate);
        return { seatUids: [], nameBySeatUid: {} };
      }
      const json = await res.json();
      const rows = Array.isArray(json?.Data) ? json.Data : [];
      const nameBySeatUid = {};
      const seatUids = [];
      rows.forEach((row) => {
        const sid = row?.uid ?? row?.Uid;
        if (sid == null || String(sid).trim() === '') return;
        const id = String(sid).trim();
        seatUids.push(id);
        const nm = row?.name ?? row?.Name;
        if (nm != null && String(nm).trim()) {
          nameBySeatUid[id] = String(nm).trim();
        }
      });
      const out = { seatUids, nameBySeatUid };
      writeDealSearchCache(ckey, out);
      return out;
    } catch {
      return { seatUids: [], nameBySeatUid: {} };
    }
  }, [navigate]);

  const fetchSeatNameFromApi = useCallback(async (seatUid) => {
    const id = String(seatUid || '').trim();
    if (!id) return undefined;
    const token = authService.getToken();
    if (!token) return undefined;
    try {
      const res = await fetch(apiUrl.seat(id), {
        headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        if (res.status === 401) authService.handleUnauthorized?.(navigate);
        return undefined;
      }
      const json = await res.json();
      return extractPartnerNameFromPayload(json);
    } catch {
      return undefined;
    }
  }, [navigate]);

  /** When a seat is not in the first page of /seats/search for the partner, resolve by PartnerUid + Uid. */
  const fetchSeatNameForPartnerUid = useCallback(async (partnerUid, seatUid) => {
    const id = String(seatUid || '').trim();
    if (!partnerUid || !id) return undefined;
    const token = authService.getToken();
    if (!token) return undefined;
    const bodySpec = {
      Filters: [
        { Field: 'PartnerUid', Operator: 'match', Value: partnerUid },
        { Field: 'Uid', Operator: 'match', Value: id },
      ],
      From: 0,
      Order: [{ Field: 'UpdatedAt', Operator: 'desc' }],
      Size: 10,
    };
    const ckey = dealSearchCacheKey('seat_by_uid', bodySpec);
    const cached = readDealSearchCache(ckey);
    if (cached !== null) return cached;

    try {
      const res = await fetch(API_ENDPOINTS.SEATS_SEARCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
        body: JSON.stringify(bodySpec),
      });
      if (!res.ok) {
        if (res.status === 401) authService.handleUnauthorized?.(navigate);
        return undefined;
      }
      const json = await res.json();
      const rows = Array.isArray(json?.Data) ? json.Data : [];
      const row = rows[0];
      if (!row) return undefined;
      const nm = row?.name ?? row?.Name;
      if (nm == null || !String(nm).trim()) return undefined;
      const out = String(nm).trim();
      writeDealSearchCache(ckey, out);
      return out;
    } catch {
      return undefined;
    }
  }, [navigate]);

  useEffect(() => {
    if (!partnerSearchOpen) return;
    const timer = setTimeout(async () => {
      const token = authService.getToken();
      if (!token) return;
      const q = partnerSearchQuery.trim();
      const filters = [{ Field: 'Status', Operator: 'in', Value: ['PRODUCTION', 'DISABLED'] }];
      if (q) {
        const isUid = /^[a-f0-9]{32}$/i.test(q);
        filters.push({ Field: isUid ? 'Uid' : '_all', Operator: 'match', Value: q });
      }
      const partnerBody = {
        Filters: filters,
        From: 0,
        Order: [{ Field: 'Name', Operator: 'asc' }],
        Size: 50,
      };
      const pckey = dealSearchCacheKey('partners', partnerBody);
      const partnerCached = readDealSearchCache(pckey);
      if (partnerCached !== null) {
        setPartnerSearchResults(partnerCached);
        setPartnerNameByUid((prev) => {
          const next = { ...prev };
          partnerCached.forEach((row) => {
            if (row.uid) next[row.uid] = row.name;
          });
          return next;
        });
        setPartnerSearchLoading(false);
        return;
      }
      setPartnerSearchLoading(true);
      setPartnerSearchError('');
      try {
        const response = await fetch(API_ENDPOINTS.PARTNERS_SEARCH, {
          method: 'POST',
          headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
          body: JSON.stringify(partnerBody),
        });
        if (!response.ok) {
          if (response.status === 401) authService.handleUnauthorized?.(navigate);
          throw new Error(`Partner search failed (${response.status})`);
        }
        const data = await response.json();
        const list = Array.isArray(data?.Data) ? data.Data : [];
        const mapped = list.map((p) => ({
          uid: p.uid,
          name: (p.name && String(p.name).trim()) || p.uid,
        }));
        writeDealSearchCache(pckey, mapped);
        setPartnerSearchResults(mapped);
        setPartnerNameByUid((prev) => {
          const next = { ...prev };
          mapped.forEach((row) => {
            if (row.uid) next[row.uid] = row.name;
          });
          return next;
        });
      } catch (e) {
        setPartnerSearchError(e.message || 'Partner search failed');
        setPartnerSearchResults([]);
      } finally {
        setPartnerSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [partnerSearchQuery, partnerSearchOpen, navigate]);

  useEffect(() => {
    if (!brokerSearchOpen) return;
    const timer = setTimeout(async () => {
      const token = authService.getToken();
      if (!token) return;
      const q = brokerSearchQuery.trim();
      const filters = [];
      if (q) {
        const isLikelyId = /^[a-f0-9]{32}$/i.test(q);
        filters.push(
          isLikelyId
            ? { Field: 'Uid', Operator: 'match', Value: q }
            : { Field: '_all', Operator: 'match', Value: q },
        );
      }
      filters.push({ Field: 'Visibility', Operator: 'in', Value: [0] });
      const brokerBody = {
        Filters: filters,
        From: 0,
        Order: [{ Field: 'Name', Operator: 'asc' }],
        Size: 50,
      };
      const bckey = dealSearchCacheKey('broker_partners', brokerBody);
      const brokerCached = readDealSearchCache(bckey);
      if (brokerCached !== null) {
        setBrokerSearchResults(brokerCached);
        setBrokerNameByUid((prev) => {
          const next = { ...prev };
          brokerCached.forEach((row) => {
            if (row.uid) next[row.uid] = row.name;
          });
          return next;
        });
        setBrokerSearchLoading(false);
        return;
      }
      setBrokerSearchLoading(true);
      setBrokerSearchError('');
      try {
        const response = await fetch(API_ENDPOINTS.BROKER_PARTNERS_SEARCH, {
          method: 'POST',
          headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
          body: JSON.stringify(brokerBody),
        });
        if (!response.ok) {
          if (response.status === 401) authService.handleUnauthorized?.(navigate);
          throw new Error(`Broker search failed (${response.status})`);
        }
        const data = await response.json();
        const list = Array.isArray(data?.Data) ? data.Data : [];
        const mapped = list
          .map((b) => ({
            uid: String(b.uid ?? b.Uid ?? '').trim(),
            name: (b.name && String(b.name).trim()) || String(b.uid ?? b.Uid ?? ''),
          }))
          .filter((row) => row.uid);
        writeDealSearchCache(bckey, mapped);
        setBrokerSearchResults(mapped);
        setBrokerNameByUid((prev) => {
          const next = { ...prev };
          mapped.forEach((row) => {
            if (row.uid) next[row.uid] = row.name;
          });
          return next;
        });
      } catch (e) {
        setBrokerSearchError(e.message || 'Broker search failed');
        setBrokerSearchResults([]);
      } finally {
        setBrokerSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [brokerSearchQuery, brokerSearchOpen, navigate]);

  useEffect(() => {
    if (!excludedDealSearchOpen) return;
    const timer = setTimeout(async () => {
      const token = authService.getToken();
      if (!token) return;
      const q = excludedDealSearchQuery.trim();
      const filters = [];
      if (q) {
        const isLikelyId = /^[a-f0-9]{32}$/i.test(q);
        filters.push(
          isLikelyId
            ? { Field: 'Uid', Operator: 'match', Value: q }
            : { Field: '_all', Operator: 'match', Value: q },
        );
      }
      const dealsBody = {
        Filters: filters,
        From: 0,
        Order: [{ Field: 'UpdatedAt', Operator: 'desc' }],
        Size: 50,
      };
      const dckey = dealSearchCacheKey('deals_search_excluded', dealsBody);
      const dealsCached = readDealSearchCache(dckey);
      if (dealsCached !== null) {
        setExcludedDealSearchResults(dealsCached);
        setExcludedDealNameByUid((prev) => {
          const next = { ...prev };
          dealsCached.forEach((row) => {
            if (row.uid) next[row.uid] = row.name;
          });
          return next;
        });
        setExcludedDealSearchLoading(false);
        return;
      }
      setExcludedDealSearchLoading(true);
      setExcludedDealSearchError('');
      try {
        const response = await fetch(API_ENDPOINTS.DEALS_SEARCH, {
          method: 'POST',
          headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
          body: JSON.stringify(dealsBody),
        });
        if (!response.ok) {
          if (response.status === 401) authService.handleUnauthorized?.(navigate);
          throw new Error(`Deal search failed (${response.status})`);
        }
        const data = await response.json();
        const list = Array.isArray(data?.Data) ? data.Data : [];
        const selfId = String(dealId || '');
        const mapped = list
          .map((d) => ({
            uid: String(d.uid ?? d.Uid ?? '').trim(),
            name:
              (d.name && String(d.name).trim()) ||
              (d.Name && String(d.Name).trim()) ||
              String(d.uid ?? d.Uid ?? ''),
          }))
          .filter((row) => row.uid && row.uid !== selfId);
        writeDealSearchCache(dckey, mapped);
        setExcludedDealSearchResults(mapped);
        setExcludedDealNameByUid((prev) => {
          const next = { ...prev };
          mapped.forEach((row) => {
            if (row.uid) next[row.uid] = row.name;
          });
          return next;
        });
      } catch (e) {
        setExcludedDealSearchError(e.message || 'Deal search failed');
        setExcludedDealSearchResults([]);
      } finally {
        setExcludedDealSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [excludedDealSearchQuery, excludedDealSearchOpen, navigate, dealId]);

  const addPartnerFromSearch = async (uid, searchHitName) => {
    if (!uid) return;
    setAddingPartnerUid(uid);
    try {
      if (searchHitName) {
        setPartnerNameByUid((prev) => ({ ...prev, [uid]: searchHitName }));
      }
      const nameFromApi = await fetchPartnerNameFromApi(uid);
      if (nameFromApi) {
        setPartnerNameByUid((prev) => ({ ...prev, [uid]: nameFromApi }));
      }
      setDealData((prev) => {
        const pw = { ...(prev?.PartnersWhitelist || {}) };
        if (pw[uid]) return prev;
        pw[uid] = { Seats: [] };
        return { ...prev, PartnersWhitelist: pw };
      });
      seatCatalogReadyRef.current.delete(uid);
      setSeatCatalogByPartner((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
      setPartnerSearchOpen(false);
      setPartnerSearchQuery('');
    } finally {
      setAddingPartnerUid(null);
    }
  };

  const removePartnerFromWhitelist = (partnerUid) => {
    if (!partnerUid) return;
    setDealData((prev) => {
      const pw = { ...(prev?.PartnersWhitelist || {}) };
      if (!pw[partnerUid]) return prev;
      const { [partnerUid]: _removed, ...rest } = pw;
      return { ...prev, PartnersWhitelist: rest };
    });
    setOpenSeatSearchPartnerUid((open) => (open === partnerUid ? null : open));
    delete partnerSeatSearchRootRefs.current[partnerUid];
    seatCatalogReadyRef.current.delete(partnerUid);
    seatCatalogInFlightRef.current.delete(partnerUid);
    setSeatCatalogByPartner((prev) => {
      if (!Object.hasOwn(prev, partnerUid)) return prev;
      const next = { ...prev };
      delete next[partnerUid];
      return next;
    });
    setSeatSearchQueryByPartner((prev) => {
      if (!Object.hasOwn(prev, partnerUid)) return prev;
      const next = { ...prev };
      delete next[partnerUid];
      return next;
    });
    setPartnerNameByUid((prev) => {
      if (!Object.hasOwn(prev, partnerUid)) return prev;
      const next = { ...prev };
      delete next[partnerUid];
      return next;
    });
  };

  const whitelistUidListKey = dealData?.PartnersWhitelist
    ? Object.keys(dealData.PartnersWhitelist).sort().join(',')
    : '';

  const partnersWhitelistSeatsKey = useMemo(() => {
    const pw = dealData?.PartnersWhitelist;
    if (!pw || typeof pw !== 'object') return '';
    return Object.keys(pw)
      .sort()
      .map((k) => {
        const seats = pw[k]?.Seats;
        return `${k}:${Array.isArray(seats) ? [...seats].map(String).sort().join(',') : ''}`;
      })
      .join('|');
  }, [dealData?.PartnersWhitelist]);

  useEffect(() => {
    if (!whitelistUidListKey) return;
    const uids = whitelistUidListKey.split(',').filter(Boolean);
    let cancelled = false;
    (async () => {
      for (const uid of uids) {
        if (cancelled) break;
        const name = await fetchPartnerNameFromApi(uid);
        if (cancelled || !name) continue;
        setPartnerNameByUid((prev) => (prev[uid] ? prev : { ...prev, [uid]: name }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId, whitelistUidListKey, fetchPartnerNameFromApi]);

  useEffect(() => {
    if (!partnersWhitelistSeatsKey) return;
    const pw = dealData?.PartnersWhitelist;
    if (!pw || typeof pw !== 'object') return;
    const partnerUids = Object.keys(pw).sort();
    let cancelled = false;
    (async () => {
      const results = await Promise.all(partnerUids.map((pUid) => fetchSeatsForPartner(pUid)));
      if (cancelled) return;
      const merged = {};
      results.forEach((r) => {
        Object.assign(merged, r.nameBySeatUid);
      });
      setSeatNameByUid((prev) => ({ ...prev, ...merged }));

      for (const pUid of partnerUids) {
        const seats = pw[pUid]?.Seats || [];
        for (const sid of seats) {
          if (cancelled) break;
          const id = String(sid).trim();
          if (!id) continue;
          const bulk = merged[id];
          if (bulk && bulk !== id) continue;

          let nm = await fetchSeatNameFromApi(id);
          if (!nm) nm = await fetchSeatNameForPartnerUid(pUid, id);
          if (cancelled || !nm) continue;
          setSeatNameByUid((prev) => {
            const cur = prev[id];
            if (cur && cur !== id) return prev;
            return { ...prev, [id]: nm };
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId, partnersWhitelistSeatsKey, fetchSeatsForPartner, fetchSeatNameFromApi, fetchSeatNameForPartnerUid]);

  const brokerPartnersListKey = Array.isArray(dealData?.Targeting?.BrokerPartners)
    ? [...dealData.Targeting.BrokerPartners].map(String).sort().join(',')
    : '';

  useEffect(() => {
    if (!brokerPartnersListKey) return;
    const uids = brokerPartnersListKey.split(',').filter(Boolean);
    let cancelled = false;
    (async () => {
      for (const uid of uids) {
        if (cancelled) break;
        const name = await fetchBrokerNameFromApi(uid);
        if (cancelled || !name) continue;
        setBrokerNameByUid((prev) => (prev[uid] ? prev : { ...prev, [uid]: name }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId, brokerPartnersListKey, fetchBrokerNameFromApi]);

  const excludedDealsListKey = Array.isArray(dealData?.ExcludedDeals)
    ? [...dealData.ExcludedDeals].map(String).sort().join(',')
    : '';

  useEffect(() => {
    if (!excludedDealsListKey) return;
    const uids = excludedDealsListKey.split(',').filter(Boolean);
    let cancelled = false;
    (async () => {
      for (const uid of uids) {
        if (cancelled) break;
        const name = await fetchDealNameFromApi(uid);
        if (cancelled || !name) continue;
        setExcludedDealNameByUid((prev) => (prev[uid] ? prev : { ...prev, [uid]: name }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId, excludedDealsListKey, fetchDealNameFromApi]);

  const addBrokerFromSearch = async (uid, searchHitName) => {
    if (!uid) return;
    setAddingBrokerUid(uid);
    try {
      if (searchHitName) {
        setBrokerNameByUid((prev) => ({ ...prev, [uid]: searchHitName }));
      }
      const nameFromApi = await fetchBrokerNameFromApi(uid);
      if (nameFromApi) {
        setBrokerNameByUid((prev) => ({ ...prev, [uid]: nameFromApi }));
      }
      mergeTargeting((t) => {
        const cur = Array.isArray(t.BrokerPartners) ? t.BrokerPartners : [];
        if (cur.some((x) => String(x) === String(uid))) return t;
        return { ...t, BrokerPartners: [...cur, uid] };
      });
      setBrokerSearchOpen(false);
      setBrokerSearchQuery('');
    } finally {
      setAddingBrokerUid(null);
    }
  };

  const removeBrokerPartner = (id) => {
    const s = String(id);
    mergeTargeting((t) => ({
      ...t,
      BrokerPartners: (Array.isArray(t.BrokerPartners) ? t.BrokerPartners : []).filter((x) => String(x) !== s),
    }));
    setBrokerNameByUid((prev) => {
      if (!Object.hasOwn(prev, s)) return prev;
      const next = { ...prev };
      delete next[s];
      return next;
    });
  };

  const mergeGeoLabelsFromResults = useCallback((results) => {
    if (!Array.isArray(results) || results.length === 0) return;
    setGeoLabelById((prev) => {
      const next = { ...prev };
      for (const r of results) {
        const id = String(r.geonameId ?? r.countryGeonameId ?? '');
        if (!id) continue;
        next[id] = r.name || r.countryName || id;
      }
      return next;
    });
  }, []);

  const runGeoSearch = useCallback(
    async (name) => {
      const token = authService.getToken();
      if (!token) return;
      setGeoSearchLoading(true);
      setGeoSearchError('');
      try {
        const res = await fetch(API_ENDPOINTS.GEO_SEARCH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': token,
          },
          body: JSON.stringify({ ...GEO_SEARCH_BODY, name: name ?? '' }),
        });
        if (!res.ok) {
          if (res.status === 401) authService.handleUnauthorized?.(navigate);
          throw new Error(`geo/search failed (${res.status})`);
        }
        const data = await res.json();
        const results = Array.isArray(data.results) ? data.results : [];
        setGeoSearchResults(results);
        mergeGeoLabelsFromResults(results);
      } catch (e) {
        console.error(e);
        setGeoSearchError(e.message || 'Geo search failed');
        setGeoSearchResults([]);
      } finally {
        setGeoSearchLoading(false);
      }
    },
    [mergeGeoLabelsFromResults, navigate]
  );

  useEffect(() => {
    const id = setTimeout(() => {
      runGeoSearch(geoSearchQuery);
    }, 300);
    return () => clearTimeout(id);
  }, [geoSearchQuery, runGeoSearch]);

  const addGeoToInclusion = (geonameId, label) => {
    const sid = String(geonameId);
    mergeTargeting((t) => {
      const inc = [...(t.Geolocation?.Inclusion || [])];
      if (inc.includes(sid)) return t;
      inc.push(sid);
      return {
        ...t,
        Geolocation: {
          ...(t.Geolocation || {}),
          Inclusion: inc,
          Exclusion: [...(t.Geolocation?.Exclusion || [])],
        },
      };
    });
    if (label) setGeoLabelById((m) => ({ ...m, [sid]: label }));
  };

  const addGeoToExclusion = (geonameId, label) => {
    const sid = String(geonameId);
    mergeTargeting((t) => {
      const exc = [...(t.Geolocation?.Exclusion || [])];
      if (exc.includes(sid)) return t;
      exc.push(sid);
      return {
        ...t,
        Geolocation: {
          ...(t.Geolocation || {}),
          Inclusion: [...(t.Geolocation?.Inclusion || [])],
          Exclusion: exc,
        },
      };
    });
    if (label) setGeoLabelById((m) => ({ ...m, [sid]: label }));
  };

  const removeGeoInclusion = (geonameId) => {
    const sid = String(geonameId);
    mergeTargeting((t) => ({
      ...t,
      Geolocation: {
        ...(t.Geolocation || {}),
        Inclusion: (t.Geolocation?.Inclusion || []).filter((x) => String(x) !== sid),
        Exclusion: [...(t.Geolocation?.Exclusion || [])],
      },
    }));
  };

  const removeGeoExclusion = (geonameId) => {
    const sid = String(geonameId);
    mergeTargeting((t) => ({
      ...t,
      Geolocation: {
        ...(t.Geolocation || {}),
        Inclusion: [...(t.Geolocation?.Inclusion || [])],
        Exclusion: (t.Geolocation?.Exclusion || []).filter((x) => String(x) !== sid),
      },
    }));
  };

  const addLangInclusion = (code) => {
    const c = String(code).trim();
    if (!c) return;
    mergeTargeting((t) => {
      const inc = [...(t.BrowserLanguages?.Inclusions || [])];
      if (inc.includes(c)) return t;
      inc.push(c);
      return {
        ...t,
        BrowserLanguages: {
          Inclusions: inc,
          Exclusions: [...(t.BrowserLanguages?.Exclusions || [])],
        },
      };
    });
  };

  const addLangExclusion = (code) => {
    const c = String(code).trim();
    if (!c) return;
    mergeTargeting((t) => {
      const exc = [...(t.BrowserLanguages?.Exclusions || [])];
      if (exc.includes(c)) return t;
      exc.push(c);
      return {
        ...t,
        BrowserLanguages: {
          Inclusions: [...(t.BrowserLanguages?.Inclusions || [])],
          Exclusions: exc,
        },
      };
    });
  };

  const removeLangInclusion = (code) => {
    const c = String(code);
    mergeTargeting((t) => ({
      ...t,
      BrowserLanguages: {
        Inclusions: (t.BrowserLanguages?.Inclusions || []).filter((x) => String(x) !== c),
        Exclusions: [...(t.BrowserLanguages?.Exclusions || [])],
      },
    }));
  };

  const removeLangExclusion = (code) => {
    const c = String(code);
    mergeTargeting((t) => ({
      ...t,
      BrowserLanguages: {
        Inclusions: [...(t.BrowserLanguages?.Inclusions || [])],
        Exclusions: (t.BrowserLanguages?.Exclusions || []).filter((x) => String(x) !== c),
      },
    }));
  };

  const domainsToText = (arr) => (Array.isArray(arr) ? arr.join('\n') : '');
  const textToDomains = (text) => text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

  const linesToNullableArray = (text) => {
    const arr = text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    return arr.length ? arr : null;
  };

  const arrayToLines = (arr) => {
    if (arr == null) return '';
    if (Array.isArray(arr)) return arr.length ? arr.join('\n') : '';
    return String(arr);
  };

  const patchTargetingNullableList = (field, text) => {
    mergeTargeting((t) => ({ ...t, [field]: linesToNullableArray(text) }));
  };

  const updateBlacklistSiteDomains = (text) => {
    const list = textToDomains(text);
    setDealData((prev) => ({
      ...prev,
      BlacklistSiteDomains: list.length ? list : null,
      BlacklistSiteDomainsMap: list.length ? Object.fromEntries(list.map((d) => [d, null])) : null,
    }));
  };

  const updateWhitelistSiteDomains = (text) => {
    const list = textToDomains(text);
    setDealData((prev) => ({
      ...prev,
      WhitelistSiteDomains: list.length ? list : null,
      WhitelistSiteDomainsMap: list.length ? Object.fromEntries(list.map((d) => [d, null])) : null,
    }));
  };

  const updateDealData = (field, value) => {
    setDealData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateNestedData = (parentField, field, value) => {
    setDealData(prev => ({
      ...prev,
      [parentField]: {
        ...(prev?.[parentField] || {}),
        [field]: value
      }
    }));
  };

  const addAudience = () => {
    if (!selectedAudienceId) return;
    const audienceId = selectedAudienceId;
    setDealData(prev => {
      const current = Array.isArray(prev?.Audiences) ? prev.Audiences : [];
      if (current.includes(audienceId)) {
        return prev;
      }
      return {
        ...prev,
        Audiences: [...current, audienceId],
        Curated: true,
      };
    });
    setSelectedAudienceId('');
  };

  const removeAudience = (audienceId) => {
    setDealData(prev => {
      const current = Array.isArray(prev?.Audiences) ? prev.Audiences : [];
      const next = current.filter((id) => id !== audienceId);
      return {
        ...prev,
        Audiences: next,
        Curated: next.length > 0,
      };
    });
  };

  const handleCopyDealId = async () => {
    if (!dealId) return;
    try {
      await navigator.clipboard.writeText(dealId);
      setSuccess('Deal ID copied to clipboard.');
      setIsSuccessVisible(true);
      setTimeout(() => {
        setSuccess('');
        setIsSuccessVisible(false);
      }, 2000);
    } catch (clipboardError) {
      console.error('Unable to copy Deal ID:', clipboardError);
    }
  };

  const formatDateTimeInput = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
  };

  const parseDateTimeInput = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getTime();
  };

  const formatDealMillis = (ts) => {
    if (ts == null || ts === '') return '—';
    const d = new Date(Number(ts));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  };

  const adKindsList = adKindsAsArray(dealData);
  const accessOn = (dealData?.Access ?? 'DISABLED') !== 'DISABLED';
  const isAdFormatActive = (value) => adKindsList.includes(value);

  /**
   * Non-video kinds: exclusive (one at a time). Same active kind → no-op.
   * AD_RAW_VIDEO + AD_OUTSTREAM: can be combined; toggles each on/off; order fixed.
   * Switching from any other kind to a video kind replaces selection with that video kind.
   */
  const toggleAdFormat = (value) => {
    setDealData((prev) => {
      const current = adKindsAsArray(prev);

      if (!VIDEO_PAIR_SET.has(value)) {
        if (current.length === 1 && current[0] === value) {
          return prev;
        }
        return {
          ...prev,
          AdKinds: [value],
          AdKind: value,
        };
      }

      const onlyVideoOrEmpty = current.length === 0 || current.every((k) => VIDEO_PAIR_SET.has(k));
      if (!onlyVideoOrEmpty) {
        return {
          ...prev,
          AdKinds: [value],
          AdKind: value,
        };
      }

      const has = current.includes(value);
      const next = has ? current.filter((k) => k !== value) : [...current, value];
      const ordered = VIDEO_PAIR_ORDER.filter((k) => next.includes(k));

      return {
        ...prev,
        AdKinds: ordered,
        AdKind: ordered.length ? ordered[0] : undefined,
      };
    });
  };

  const isOpenerActive = (value) => Array.isArray(dealData?.Content?.Openers) && dealData.Content.Openers.includes(value);

  const toggleOpener = (value) => {
    const current = Array.isArray(dealData?.Content?.Openers) ? dealData.Content.Openers : [];
    const isActive = current.includes(value);
    const updated = isActive ? current.filter(item => item !== value) : [...current, value];
    updateNestedData('Content', 'Openers', updated);
  };

  const minMarginSliderPercent = minMarginStoredToSliderPercent(dealData?.MinMargin);
  const sliderValue = [minMarginSliderPercent];
  const minMarginIsNone = dealData?.MinMargin === '0' || dealData?.MinMargin === 0 || dealData?.MinMargin === '' || dealData?.MinMargin == null;

  const displayDealName = dealData?.Name || dealName || 'Deal';
  const companyReadable = dealData?.CompanyName || resolvedCompanyName || '';
  const realmReadable = dealData?.RealmName || resolvedRealmName || '';
  const saleReadable = resolvedSaleName || '';
  const displayCompany = companyReadable
    ? companyReadable
    : dealData?.Company
      ? entityNamesLoading
        ? 'Loading…'
        : '—'
      : 'N/A';
  const displayRealm = realmReadable
    ? realmReadable
    : dealData?.Realm
      ? entityNamesLoading
        ? 'Loading…'
        : '—'
      : 'N/A';
  
  // Truncate deal name to 15 characters with ellipsis
  const truncatedDealName = displayDealName.length > 15 
    ? `${displayDealName.substring(0, 15)}...` 
    : displayDealName;

  const renderToggleButton = (isActive) => cn(
    'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
    isActive
      ? 'bg-[rgb(75,99,226)] text-white border-transparent shadow-sm'
      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
  );

  const sections = [
    { id: 'general', label: 'General info', icon: <Building2 className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <TargetIcon className="w-4 h-4" /> },
    { id: 'openweb-community', label: 'OpenWeb community', icon: <Users className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <FileText className="w-4 h-4" /> },
  ];

  const timezoneOptions = useMemo(() => [
    'Europe/Paris',
    'Europe/London',
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Singapore'
  ], []);

  const dealTypes = useMemo(() => ([
    { value: 'CLASSIC', label: 'Classic' },
    { value: 'DIRECT', label: 'Direct' },
    { value: 'PUBLISHER', label: 'Publisher' }
  ]), []);

  const adFormatOptions = useMemo(() => ([
    { value: 'AD_BANNER', label: 'Banner', icon: <ImageIcon className="w-4 h-4" /> },
    { value: 'AD_STORY', label: 'Story', icon: <Monitor className="w-4 h-4" /> },
    { value: 'AD_VIDEO', label: 'Native Video', icon: <Video className="w-4 h-4" /> },
    { value: 'AD_INSTREAM', label: 'Instream', icon: <AppWindow className="w-4 h-4" /> },
    { value: 'AD_RAW_VIDEO', label: 'Video in banner', icon: <Film className="w-4 h-4" /> },
    { value: 'AD_OUTSTREAM', label: 'Outstream', icon: <Layers className="w-4 h-4" /> },
  ]), []);

  const openerOptions = [
    { value: 'REDIRECT', label: 'REDIRECT' },
    { value: 'POPIN', label: 'POPIN' },
    { value: 'INVIEW', label: 'INVIEW' },
  ];

  const auctionTypeOptions = [
    { value: 1, label: 'First Price' },
    { value: 2, label: 'Fixed Price' }
  ];

  const priorityOptions = [
    { value: 'OPEN', label: 'Normal' },
    { value: 'SECOND_LOOK', label: 'Medium' },
    { value: 'FIRST_LOOK', label: 'Highest' },
  ];

  const filteredLanguageEntries = useMemo(() => {
    const entries = Object.entries(languagesMap);
    const q = langSearchQuery.trim().toLowerCase();
    let list = entries;
    if (q) {
      list = entries.filter(([code, name]) => {
        const n = String(name ?? '');
        return code.toLowerCase().includes(q) || n.toLowerCase().includes(q);
      });
    }
    return list.sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' })).slice(0, 500);
  }, [languagesMap, langSearchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading deal data...</p>
        </div>
      </div>
    );
  }

  if (error && !dealData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error Loading Deal</h2>
          <p className="text-slate-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (!dealData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Deal data unavailable</h2>
          <p className="text-slate-600 mb-4">We could not load this deal. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <EntityEditorLayout
      sections={sections}
      selectedSection={activeSection}
      onSectionSelect={setActiveSection}
      sectionCardTitle="General Parameters"
      sidebarFooter={(
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-2">
              <Button
                onClick={handleSave}
                disabled={saving}
              className={cn(TAILWIND_CLASSES.editPrimaryButton)}
              >
                {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                <Save className="w-4 h-4 mr-2" />
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/Deal')}
              className={cn(TAILWIND_CLASSES.editCancelButton)}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}
      header={(
        <div className="mb-6">
          <div className="bg-gradient-to-r from-white via-[rgb(244,246,255)] to-white border border-[rgb(220,227,255)] shadow-sm rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center', TAILWIND_CLASSES.editIconBox)}>
                  <Building2 className="w-7 h-7" />
            </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold text-slate-900 leading-tight" title={displayDealName}>{truncatedDealName}</h1>
                  <p className="text-sm text-slate-500">Edit deal configuration</p>
          </div>
        </div>
              <div className="flex flex-wrap items-center gap-3">
                <ToggleSwitch
                  checked={accessOn}
                  onCheckedChange={(checked) =>
                    updateDealData('Access', checked ? 'ALL' : 'DISABLED')
                  }
                />
                {dealData?.ModeKind && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] border border-[rgb(59,76,164)]/20">
                    Mode: {dealData.ModeKind}
                  </span>
                )}
                {dealData?.PriorityKind && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Priority: {formatPriorityKindForUi(dealData.PriorityKind)}
                  </span>
                )}
                        </div>
          </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Deal UID</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-700 text-xs md:text-sm break-all">{dealData.Uid}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyDealId}>
                    <ClipboardCopy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Company</p>
                <p className="font-medium text-slate-700">{displayCompany}</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Realm</p>
                <p className="font-medium text-slate-700">{displayRealm}</p>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-400">Created</span>{' '}
                {formatDealMillis(dealData.CreatedAt)}
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:mt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-400">Updated</span>{' '}
                  {formatDealMillis(dealData.UpdatedAt)}
                </div>
                <div className="flex items-start gap-2 sm:border-l sm:border-slate-200 sm:pl-6">
                  <ToggleSwitch
                    checked={!!dealData.CrossRealm}
                    onCheckedChange={(checked) => updateDealData('CrossRealm', checked)}
                  />
                  <div className="min-w-0 pt-0.5">
                    <div className="text-sm font-medium text-slate-800">Cross realm</div>
                    <p className="text-[11px] leading-snug text-slate-500">
                      Toggle if the deal spans multiple realms.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      alerts={[
        error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-red-800 font-medium">
              {error}
            </AlertDescription>
          </Alert>
        ),
        success && (
          <Alert className={`border-green-200 bg-green-50 transition-opacity duration-700 ${isSuccessVisible ? 'opacity-100' : 'opacity-0'}`}>
            <AlertDescription className="text-green-800 font-medium">
              {success}
            </AlertDescription>
          </Alert>
        )
      ]}
    >
      <>
        {activeSection === 'general' && (
          <div className="space-y-6">
                  <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Building2 className="w-5 h-5" />
                  General info
                      </CardTitle>
                    </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <div className="space-y-2">
                    <Label>Name*</Label>
                          <Input
                            value={dealData.Name || ''}
                            onChange={(e) => updateDealData('Name', e.target.value)}
                      placeholder="Enter deal name"
                          />
                        </div>
                        <div className="space-y-2">
                    <Label>Company*</Label>
                          <div className="relative" ref={companyPickerRootRef}>
                            <button
                              type="button"
                              className={cn(
                                'flex w-full min-h-[2.75rem] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm shadow-sm hover:border-slate-300',
                                companyPickerOpen && 'ring-2 ring-[rgb(59,76,164)]/30',
                              )}
                              onClick={() => {
                                setSalePickerOpen(false);
                                setCompanyPickerOpen((prev) => {
                                  const next = !prev;
                                  if (next) setCompanyPickerQuery('');
                                  return next;
                                });
                              }}
                            >
                              <span
                                className={cn(
                                  'min-w-0 flex-1 truncate font-medium leading-snug',
                                  companyReadable ? 'text-slate-900' : 'text-slate-400',
                                )}
                              >
                                {companyReadable
                                  ? companyReadable
                                  : dealData?.Company
                                    ? entityNamesLoading
                                      ? 'Loading…'
                                      : '—'
                                    : 'Select company'}
                              </span>
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                                  companyPickerOpen && 'rotate-180',
                                )}
                              />
                            </button>
                            {companyPickerOpen && (
                              <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-md border border-slate-200 bg-white shadow-lg">
                                <div className="border-b border-slate-100 p-2">
                                  <Input
                                    className="h-9 text-xs"
                                    placeholder="Search company…"
                                    value={companyPickerQuery}
                                    onChange={(e) => setCompanyPickerQuery(e.target.value)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  />
                                </div>
                                {companyPickerLoading ? (
                                  <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading…
                                  </div>
                                ) : companyPickerResults.length === 0 ? (
                                  <p className="px-3 py-3 text-xs text-slate-500">No company found</p>
                                ) : (
                                  <ul className="max-h-52 overflow-y-auto py-1">
                                    {companyPickerResults.map((row) => (
                                      <li key={row.Uid}>
                                        <button
                                          type="button"
                                          className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
                                          onClick={() => {
                                            setDealData((prev) => ({
                                              ...prev,
                                              Company: row.Uid,
                                              CompanyName: row.Name || row.Uid,
                                            }));
                                            setResolvedCompanyName(row.Name || '');
                                            setCompanyPickerOpen(false);
                                            setCompanyPickerQuery('');
                                          }}
                                        >
                                          <span className="font-medium text-slate-900">{row.Name}</span>
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                    <Label>Realm*</Label>
                          <div
                            className="flex min-h-[2.75rem] cursor-not-allowed items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600 shadow-inner"
                            title="Le realm ne peut pas être modifié sur ce deal"
                          >
                              <span
                                className={cn(
                                  'min-w-0 flex-1 truncate font-medium leading-snug',
                                  realmReadable ? 'text-slate-700' : 'text-slate-500',
                                )}
                              >
                                {realmReadable
                                  ? realmReadable
                                  : dealData?.Realm
                                    ? entityNamesLoading
                                      ? 'Loading…'
                                      : '—'
                                    : '—'}
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                          </div>
                        </div>
                        <div className="space-y-2">
                    <Label>Sale manager</Label>
                          <div className="relative" ref={salePickerRootRef}>
                            <button
                              type="button"
                              className={cn(
                                'flex w-full min-h-[2.75rem] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm shadow-sm hover:border-slate-300',
                                salePickerOpen && 'ring-2 ring-[rgb(59,76,164)]/30',
                              )}
                              onClick={() => {
                                setCompanyPickerOpen(false);
                                setSalePickerOpen((prev) => {
                                  const next = !prev;
                                  if (next) setSalePickerQuery('');
                                  return next;
                                });
                              }}
                            >
                              <span
                                className={cn(
                                  'min-w-0 flex-1 truncate font-medium leading-snug',
                                  saleReadable ? 'text-slate-900' : 'text-slate-400',
                                )}
                              >
                                {saleReadable
                                  ? saleReadable
                                  : dealData?.Sale
                                    ? entityNamesLoading
                                      ? 'Loading…'
                                      : '—'
                                    : 'Select sale manager'}
                              </span>
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                                  salePickerOpen && 'rotate-180',
                                )}
                              />
                            </button>
                            {salePickerOpen && (
                              <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-md border border-slate-200 bg-white shadow-lg">
                                {!String(dealData?.Realm || '').trim() ? (
                                  <p className="px-3 py-3 text-xs text-amber-800">
                                    Select a realm first — sale managers are listed per realm.
                                  </p>
                                ) : (
                                  <>
                                    <div className="border-b border-slate-100 p-2">
                                      <Input
                                        className="h-9 text-xs"
                                        placeholder="Filter by name or email…"
                                        value={salePickerQuery}
                                        onChange={(e) => setSalePickerQuery(e.target.value)}
                                        onMouseDown={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    {salePickerLoading ? (
                                      <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading…
                                      </div>
                                    ) : salePickerResults.length === 0 ? (
                                      <p className="px-3 py-3 text-xs text-slate-500">No user found</p>
                                    ) : (
                                      <ul className="max-h-52 overflow-y-auto py-1">
                                        {salePickerResults.map((u) => {
                                          const uname = getUserListDisplayName(u);
                                          return (
                                            <li key={u.Uid}>
                                              <button
                                                type="button"
                                                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs hover:bg-slate-50"
                                                onClick={() => {
                                                  setDealData((prev) => ({ ...prev, Sale: u.Uid }));
                                                  setResolvedSaleName(uname);
                                                  setSalePickerOpen(false);
                                                  setSalePickerQuery('');
                                                }}
                                              >
                                                <span className="font-medium text-slate-900">{uname}</span>
                                                {u.Email ? (
                                                  <span className="text-[11px] text-slate-500">{u.Email}</span>
                                                ) : null}
                                              </button>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                    <Label>Region*</Label>
                          <div
                            className="flex flex-wrap gap-2"
                            role="radiogroup"
                            aria-label="Region"
                          >
                            {REGION_OPTIONS.map((region) => {
                              const current = String(dealData.Region || '').trim();
                              const isSelected = current === region;
                              return (
                                <div
                                  key={region}
                                  role="radio"
                                  aria-checked={isSelected}
                                  tabIndex={0}
                                  className={cn(
                                    'cursor-pointer select-none rounded-md border px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[rgb(59,76,164)]/40',
                                    isSelected
                                      ? 'selected border-[rgb(59,76,164)] bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)]'
                                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                                  )}
                                  onClick={() => updateDealData('Region', region)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      updateDealData('Region', region);
                                    }
                                  }}
                                >
                                  {region}
                                </div>
                              );
                            })}
                          </div>
                          {dealData.Region &&
                          String(dealData.Region).trim() &&
                          !REGION_OPTIONS.includes(String(dealData.Region).trim()) ? (
                            <p className="text-xs text-amber-700">
                              Stored region &quot;{dealData.Region}&quot; is not in the list — select an option above to replace it.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Separator />
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Deal type</Label>
                  <div className="flex flex-wrap gap-2">
                    {dealTypes.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={renderToggleButton(dealData.ModeKind === option.value)}
                        onClick={() => updateDealData('ModeKind', option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">DSP partner whitelist</Label>
                  <div className="space-y-2 max-w-2xl">
                    <Label className="text-xs text-slate-600">Search partner</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-9"
                        placeholder="Filter by name or 32-char UID"
                        value={partnerSearchQuery}
                        onChange={(e) => {
                          setPartnerSearchQuery(e.target.value);
                          setPartnerSearchOpen(true);
                        }}
                        onFocus={() => setPartnerSearchOpen(true)}
                      />
                    </div>
                    {partnerSearchLoading && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading partners…
                      </div>
                    )}
                    {partnerSearchError && <p className="text-xs text-red-600">{partnerSearchError}</p>}
                    {partnerSearchOpen && partnerSearchResults.length > 0 && (
                      <ul className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                        {partnerSearchResults.map((p) => (
                          <li
                            key={p.uid}
                            className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-0 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="min-w-0 text-slate-700" title={`UID: ${p.uid}`}>
                              <span className="font-medium">{p.name}</span>
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={!!dealData?.PartnersWhitelist?.[p.uid] || addingPartnerUid === p.uid}
                              className="h-8 shrink-0 text-[11px]"
                              onClick={() => addPartnerFromSearch(p.uid, p.name)}
                            >
                              {addingPartnerUid === p.uid ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : dealData?.PartnersWhitelist?.[p.uid] ? (
                                'Added'
                              ) : (
                                'Add'
                              )}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-100/60 p-3">
                    {dealData.PartnersWhitelist && Object.keys(dealData.PartnersWhitelist).length > 0 ? (
                      Object.entries(dealData.PartnersWhitelist).map(([uid, cfg]) => {
                        const catalogLoaded = Object.hasOwn(seatCatalogByPartner, uid);
                        const catalog = catalogLoaded ? seatCatalogByPartner[uid] : [];
                        const qSeat = (seatSearchQueryByPartner[uid] || '').trim().toLowerCase();
                        const filteredSeats = !qSeat
                          ? catalog
                          : catalog.filter(
                              (r) =>
                                r.name.toLowerCase().includes(qSeat) ||
                                String(r.uid).toLowerCase().includes(qSeat)
                            );
                        const selectedSeatUids = new Set((cfg?.Seats || []).map(String));
                        const seatPanelOpen = openSeatSearchPartnerUid === uid;
                        return (
                        <div
                          key={uid}
                          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0 flex flex-col gap-1">
                              <span className="text-sm font-semibold leading-tight text-slate-900" title={`Partner UID: ${uid}`}>
                                {partnerNameByUid[uid] || 'DSP partner'}
                              </span>
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto justify-start p-0 text-[11px] font-normal text-slate-500"
                                onClick={() => {
                                  void navigator.clipboard.writeText(uid);
                                }}
                              >
                                Copy partner ID
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 shrink-0 gap-1.5 border-red-200 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                              onClick={() => removePartnerFromWhitelist(uid)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove partner
                            </Button>
                          </div>

                          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
                          <div className="min-w-0 flex-1 space-y-2">
                            <Label className="text-xs text-slate-600">Search seat</Label>
                            <div
                              ref={(el) => {
                                if (el) partnerSeatSearchRootRefs.current[uid] = el;
                                else delete partnerSeatSearchRootRefs.current[uid];
                              }}
                              className="relative"
                            >
                              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                              <Input
                                className="h-9 pl-8 pr-9 text-xs"
                                placeholder="Filter by seat name or uid (focus loads list)"
                                value={seatSearchQueryByPartner[uid] || ''}
                                onChange={(e) =>
                                  setSeatSearchQueryByPartner((prev) => ({
                                    ...prev,
                                    [uid]: e.target.value,
                                  }))
                                }
                                onFocus={() => {
                                  setOpenSeatSearchPartnerUid(uid);
                                  loadSeatCatalogForPartner(uid);
                                }}
                              />
                              {seatCatalogLoadingUid === uid ? (
                                <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-slate-400" />
                              ) : null}
                              {seatPanelOpen &&
                              catalogLoaded &&
                              catalog.length === 0 &&
                              seatCatalogLoadingUid !== uid ? (
                                <p className="mt-1 text-[11px] text-slate-500">No seats returned for this partner.</p>
                              ) : null}
                              {seatPanelOpen && filteredSeats.length > 0 && seatCatalogLoadingUid !== uid ? (
                                <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md">
                                  {filteredSeats.map((row) => (
                                    <li
                                      key={row.uid}
                                      className="flex items-center justify-between gap-2 border-b border-slate-50 px-2 py-1.5 text-xs last:border-0"
                                    >
                                      <span className="min-w-0" title={`UID: ${row.uid}`}>
                                        <span className="font-medium text-slate-800">{row.name}</span>
                                      </span>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 shrink-0 text-[11px]"
                                        disabled={selectedSeatUids.has(String(row.uid))}
                                        onClick={() => addSeatToWhitelist(uid, row.uid, row.name)}
                                      >
                                        {selectedSeatUids.has(String(row.uid)) ? 'Added' : 'Add'}
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              {seatPanelOpen &&
                              catalogLoaded &&
                              catalog.length > 0 &&
                              filteredSeats.length === 0 &&
                              qSeat ? (
                                <p className="mt-1 text-[11px] text-amber-700">No seat matches this filter.</p>
                              ) : null}
                            </div>
                            <Input
                              key={`seat-manual-${dealId}-${uid}`}
                              className="font-mono text-xs"
                              placeholder="Optional: seat UID, Enter to add"
                              defaultValue=""
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter') return;
                                const v = e.currentTarget.value.trim();
                                if (v) {
                                  addSeatToWhitelist(uid, v);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            <Label className="text-xs text-slate-500">Selected seats</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {(cfg?.Seats || []).length === 0 ? (
                                <span className="text-xs text-slate-400">None — search or add a seat UID under Search seat.</span>
                              ) : (
                                (cfg?.Seats || []).map((sid) => {
                                  const seatId = String(sid).trim();
                                  const resolved = seatNameByUid[seatId];
                                  const displayLabel =
                                    resolved && resolved !== seatId ? resolved : seatId;
                                  return (
                                  <span
                                    key={seatId}
                                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-1 text-xs"
                                    title={`Seat uid: ${seatId}`}
                                  >
                                    <span
                                      className={cn(
                                        'min-w-0 truncate font-medium text-slate-800',
                                        displayLabel === seatId && 'font-mono text-[11px]',
                                      )}
                                    >
                                      {displayLabel}
                                    </span>
                                    <button
                                      type="button"
                                      className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                                      onClick={() => removeSeatFromWhitelist(uid, seatId)}
                                      aria-label="Remove seat"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                  );
                                })
                              )}
                            </div>
                          </div>
                          </div>
                        </div>
                        );
                      })
                    ) : (
                      <p className="px-1 text-xs text-slate-500">No partner in the whitelist yet — use search above to add one.</p>
                    )}
                  </div>
                </div>
                      <Separator />
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-wrap">
                  {isAdFormatActive('AD_BANNER') && (
                    <div className="flex items-center gap-3">
                      <Switch
                        id="banner-story"
                        checked={!!dealData.BannerStoryDisplay}
                        onCheckedChange={(checked) => updateDealData('BannerStoryDisplay', checked)}
                      />
                      <div>
                        <Label htmlFor="banner-story" className="font-medium">Banner story display</Label>
                        <p className="text-xs text-slate-500">Story placement for banner inventory.</p>
                      </div>
                    </div>
                  )}
                  {(isAdFormatActive('AD_STORY') || isAdFormatActive('AD_TRAFFIC')) && (
                    <div className="flex items-center gap-3">
                      <Switch
                        id="native-story"
                        checked={!!dealData.StoryDisplay}
                        onCheckedChange={(checked) => updateDealData('StoryDisplay', checked)}
                      />
                      <div>
                        <Label htmlFor="native-story" className="font-medium">Native story display</Label>
                        <p className="text-xs text-slate-500">Applies to story / native display formats.</p>
                      </div>
                    </div>
                  )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm mb-4">
                    <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                      <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Clock3 className="w-5 h-5" />
                  Schedules
                      </CardTitle>
                    </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-2">
                    <Label>Time zone</Label>
                    <Select
                      value={dealData.TimeZone || ''}
                      onValueChange={(value) => updateDealData('TimeZone', value)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select a time zone" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {timezoneOptions.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                        <div className="space-y-2">
                    <Label>From</Label>
                          <Input
                      type="datetime-local"
                      value={formatDateTimeInput(dealData.StartedAt)}
                      onChange={(e) => updateDealData('StartedAt', parseDateTimeInput(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                    <Label>To</Label>
                          <Input
                      type="datetime-local"
                      value={formatDateTimeInput(dealData.FinishedAt)}
                      onChange={(e) => updateDealData('FinishedAt', parseDateTimeInput(e.target.value))}
                          />
                        </div>
                      </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm mb-4">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <AppWindow className="w-5 h-5" />
                  Ad format
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                  <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                      {adFormatOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={renderToggleButton(isAdFormatActive(option.value))}
                          onClick={() => toggleAdFormat(option.value)}
                        >
                          {option.icon}
                          {option.label}
                        </button>
                            ))}
                          </div>
                    {adKindsList.length > 0 && !isValidAdKindsCombo(adKindsList) && (
                      <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                        <AlertCircle className="h-4 w-4 text-amber-700" />
                        <AlertDescription>{AD_KIND_MULTI_RULE_MSG}</AlertDescription>
                      </Alert>
                    )}
                        </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm mb-4">
                    <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                      <CardTitle className="flex items-center gap-2 text-white text-base">
                  <DollarSign className="w-5 h-5" />
                  Pricing & priority
                      </CardTitle>
                    </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2">
                      <Label className="font-medium block">Floor price</Label>
                      <Label className="block text-xs text-slate-500">USD CPM</Label>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="max-w-xs"
                      value={dealData.Floor != null ? Number((dealData.Floor / 100).toFixed(2)) : ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          updateDealData('Floor', 0);
                          return;
                        }
                        const usd = parseFloat(raw);
                        if (Number.isNaN(usd)) return;
                        updateDealData('Floor', Math.max(0, Math.round(usd * 100)));
                      }}
                      placeholder="e.g. 1.30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Min margin</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <button
                        type="button"
                        className={renderToggleButton(minMarginIsNone)}
                        onClick={() => updateDealData('MinMargin', '0')}
                      >
                        None
                      </button>
                      <button
                        type="button"
                        className={renderToggleButton(!minMarginIsNone)}
                        onClick={() =>
                          updateDealData('MinMargin', minMarginIsNone ? '0.02' : dealData.MinMargin)
                        }
                      >
                        Custom
                      </button>
                    </div>
                    {!minMarginIsNone && (
                      <div className="flex items-center gap-4">
                        <Slider
                          value={sliderValue}
                          max={100}
                          step={1}
                          onValueChange={(values) =>
                            updateDealData('MinMargin', minMarginSliderPercentToStored(values[0]))
                          }
                          className="flex-1"
                        />
                        <div className="w-12 text-sm font-semibold text-right">{sliderValue[0]}%</div>
                      </div>
                    )}
                    <p className="text-xs text-slate-500">Once a custom margin is set, it overrides the DSP remuneration policy and strategy.</p>
                        </div>
                      </div>

                      <Separator />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">Bid price</Label>
                        <div className="flex flex-wrap gap-2">
                      {auctionTypeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={renderToggleButton(dealData.AuctionType === option.value)}
                          onClick={() => updateDealData('AuctionType', option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">Bid priority</Label>
                        <div className="flex flex-wrap gap-2">
                      {priorityOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={renderToggleButton(
                            isPriorityOptionSelected(dealData.PriorityKind, option.value),
                          )}
                          onClick={() => updateDealData('PriorityKind', option.value)}
                        >
                          {option.label}
                        </button>
                          ))}
                    </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                      </div>
        )}

        {activeSection === 'inventory' && (
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Smartphone className="w-5 h-5" />
                  Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Distribution channel</Label>
                  <div className="flex flex-wrap gap-2">
                    {['APP', 'SITE'].map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        className={renderToggleButton(
                          Array.isArray(dealData.DistributionChannelKinds) && dealData.DistributionChannelKinds.includes(ch)
                        )}
                        onClick={() => toggleDistributionChannel(ch)}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <TargetIcon className="w-5 h-5" />
                  Broker &amp; inventory targeting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="space-y-4 max-w-2xl">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Broker partners</Label>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">Search broker</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-9"
                        placeholder="Filter by name or UID"
                        value={brokerSearchQuery}
                        onChange={(e) => {
                          setBrokerSearchQuery(e.target.value);
                          setBrokerSearchOpen(true);
                        }}
                        onFocus={() => setBrokerSearchOpen(true)}
                      />
                    </div>
                    {brokerSearchLoading && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading brokers…
                      </div>
                    )}
                    {brokerSearchError && <p className="text-xs text-red-600">{brokerSearchError}</p>}
                    {brokerSearchOpen && brokerSearchResults.length > 0 && (
                      <ul className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                        {brokerSearchResults.map((b) => {
                          const already = (dealData.Targeting?.BrokerPartners || []).some(
                            (x) => String(x) === String(b.uid),
                          );
                          return (
                            <li
                              key={b.uid}
                              className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-0 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="min-w-0 text-slate-700" title={`UID: ${b.uid}`}>
                                <span className="font-medium">{b.name}</span>
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={already || addingBrokerUid === b.uid}
                                className="h-8 shrink-0 text-[11px]"
                                onClick={() => addBrokerFromSearch(b.uid, b.name)}
                              >
                                {addingBrokerUid === b.uid ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : already ? (
                                  'Added'
                                ) : (
                                  'Add'
                                )}
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Selected brokers</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(!(dealData.Targeting?.BrokerPartners || []).length) ? (
                        <span className="text-xs text-slate-400">None — use search above.</span>
                      ) : (
                        (dealData.Targeting?.BrokerPartners || []).map((id) => (
                          <span
                            key={id}
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-1 text-xs"
                            title={`Broker uid: ${id}`}
                          >
                            <span className="font-medium text-slate-800">
                              {brokerNameByUid[id] && brokerNameByUid[id] !== String(id)
                                ? brokerNameByUid[id]
                                : 'Broker'}
                            </span>
                            <button
                              type="button"
                              className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                              onClick={() => removeBrokerPartner(id)}
                              aria-label="Remove broker"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Device</Label>
                  <div className="flex flex-wrap gap-2">
                    {DEVICE_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={renderToggleButton(
                          Array.isArray(dealData.Targeting?.Devices) && dealData.Targeting.Devices.includes(d)
                        )}
                        onClick={() => toggleInTargetingArray('Devices', d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Browser</Label>
                  <div className="flex flex-wrap gap-2">
                    {BROWSER_OPTIONS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={renderToggleButton(
                          Array.isArray(dealData.Targeting?.Browser) && dealData.Targeting.Browser.includes(b)
                        )}
                        onClick={() => toggleInTargetingArray('Browser', b)}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">OS</Label>
                  <div className="flex flex-wrap gap-2">
                    {OS_OPTIONS.map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={renderToggleButton(
                          Array.isArray(dealData.Targeting?.OS) && dealData.Targeting.OS.includes(o)
                        )}
                        onClick={() => toggleInTargetingArray('OS', o)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Globe2 className="w-5 h-5" />
                  Country, language &amp; domains
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Search countries</Label>
                  <div className="relative max-w-xl">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-9"
                      placeholder="Filter by country name (empty = first 300 countries)"
                      value={geoSearchQuery}
                      onChange={(e) => setGeoSearchQuery(e.target.value)}
                    />
                  </div>
                  {geoSearchLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading…
                    </div>
                  )}
                  {geoSearchError && <p className="text-xs text-red-600">{geoSearchError}</p>}
                  {geoSearchResults.length > 0 && (
                    <ul className="max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white">
                      {geoSearchResults.map((r) => {
                        const gid = String(r.geonameId ?? r.countryGeonameId ?? '');
                        const label = r.name || r.countryName || gid;
                        return (
                          <li
                            key={gid}
                            className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-0 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="text-slate-700">
                              {label}{' '}
                              <span className="text-slate-400">
                                ({r.countryCode}) · <span className="font-mono">{gid}</span>
                              </span>
                            </span>
                            <span className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 hover:text-emerald-950"
                                onClick={() => addGeoToInclusion(gid, label)}
                              >
                                Include
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100 hover:text-rose-950"
                                onClick={() => addGeoToExclusion(gid, label)}
                              >
                                Exclude
                              </Button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Included locations</Label>
                    <div className="flex min-h-[2rem] flex-wrap gap-2">
                      {(dealData.Targeting?.Geolocation?.Inclusion || []).length === 0 ? (
                        <span className="text-xs text-slate-400">None</span>
                      ) : (
                        (dealData.Targeting?.Geolocation?.Inclusion || []).map((id) => (
                          <Badge
                            key={`geo-inc-${id}`}
                            variant="outline"
                            className="cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                            onClick={() => removeGeoInclusion(id)}
                            title="Remove"
                          >
                            {geoLabelById[String(id)] || `ID ${id}`} ×
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Excluded locations</Label>
                    <div className="flex min-h-[2rem] flex-wrap gap-2">
                      {(dealData.Targeting?.Geolocation?.Exclusion || []).length === 0 ? (
                        <span className="text-xs text-slate-400">None</span>
                      ) : (
                        (dealData.Targeting?.Geolocation?.Exclusion || []).map((id) => (
                          <Badge
                            key={`geo-exc-${id}`}
                            variant="outline"
                            className="cursor-pointer border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
                            onClick={() => removeGeoExclusion(id)}
                            title="Remove"
                          >
                            {geoLabelById[String(id)] || `ID ${id}`} ×
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <Separator />
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Browser languages</Label>
                  <div className="relative max-w-xl">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-9"
                      placeholder="Filter by code or language name"
                      value={langSearchQuery}
                      onChange={(e) => setLangSearchQuery(e.target.value)}
                    />
                  </div>
                  {languagesLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading language list…
                    </div>
                  )}
                  {languagesError && <p className="text-xs text-red-600">{languagesError}</p>}
                  {filteredLanguageEntries.length > 0 && (
                    <ul className="max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white">
                      {filteredLanguageEntries.map(([code, name]) => (
                        <li
                          key={code}
                          className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-slate-700">
                            <span className="font-medium">{name}</span>{' '}
                            <span className="font-mono text-slate-400">({code})</span>
                          </span>
                          <span className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 hover:text-emerald-950"
                              onClick={() => addLangInclusion(code)}
                            >
                              Include
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100 hover:text-rose-950"
                              onClick={() => addLangExclusion(code)}
                            >
                              Exclude
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Included language codes</Label>
                    <div className="flex min-h-[2rem] flex-wrap gap-2">
                      {(dealData.Targeting?.BrowserLanguages?.Inclusions || []).length === 0 ? (
                        <span className="text-xs text-slate-400">None</span>
                      ) : (
                        (dealData.Targeting?.BrowserLanguages?.Inclusions || []).map((code) => (
                          <Badge
                            key={`lang-inc-${code}`}
                            variant="outline"
                            className="cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                            onClick={() => removeLangInclusion(code)}
                            title="Remove"
                          >
                            {languagesMap[code] ? `${languagesMap[code]} (${code})` : code} ×
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Excluded language codes</Label>
                    <div className="flex min-h-[2rem] flex-wrap gap-2">
                      {(dealData.Targeting?.BrowserLanguages?.Exclusions || []).length === 0 ? (
                        <span className="text-xs text-slate-400">None</span>
                      ) : (
                        (dealData.Targeting?.BrowserLanguages?.Exclusions || []).map((code) => (
                          <Badge
                            key={`lang-exc-${code}`}
                            variant="outline"
                            className="cursor-pointer border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
                            onClick={() => removeLangExclusion(code)}
                            title="Remove"
                          >
                            {languagesMap[code] ? `${languagesMap[code]} (${code})` : code} ×
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <Separator />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Whitelist site domains (one per line)</Label>
                    <p className="text-xs text-slate-500">Syncs <span className="font-mono">WhitelistSiteDomainsMap</span> (values null).</p>
                    <Textarea
                      rows={5}
                      value={domainsToText(dealData.WhitelistSiteDomains)}
                      onChange={(e) => updateWhitelistSiteDomains(e.target.value)}
                      placeholder="example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Blocked / blacklisted domains (one per line)</Label>
                    <p className="text-xs text-slate-500">Syncs <span className="font-mono">BlacklistSiteDomainsMap</span>.</p>
                    <Textarea
                      rows={5}
                      value={domainsToText(dealData.BlacklistSiteDomains)}
                      onChange={(e) => updateBlacklistSiteDomains(e.target.value)}
                      placeholder="Add blocked domains"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Layers className="w-5 h-5" />
                  Targeting — publishers, sites &amp; IAB
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-600">
                <p className="text-xs text-slate-500">
                  One UID or code per line (or comma-separated). Empty clears the field (stored as{' '}
                  <span className="font-mono">null</span> when supported by the API).
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Sites</Label>
                    <Textarea
                      rows={3}
                      value={arrayToLines(dealData.Targeting?.Sites)}
                      onChange={(e) => patchTargetingNullableList('Sites', e.target.value)}
                      placeholder="Site UIDs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Excluded sites</Label>
                    <Textarea
                      rows={3}
                      value={arrayToLines(dealData.Targeting?.ExcludedSites)}
                      onChange={(e) => patchTargetingNullableList('ExcludedSites', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Publishers</Label>
                    <Textarea
                      rows={3}
                      value={arrayToLines(dealData.Targeting?.Publishers)}
                      onChange={(e) => patchTargetingNullableList('Publishers', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Excluded publishers</Label>
                    <Textarea
                      rows={3}
                      value={arrayToLines(dealData.Targeting?.ExcludedPublishers)}
                      onChange={(e) => patchTargetingNullableList('ExcludedPublishers', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Placements</Label>
                    <Textarea
                      rows={3}
                      value={arrayToLines(dealData.Targeting?.Placements)}
                      onChange={(e) => patchTargetingNullableList('Placements', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Excluded placements</Label>
                    <Textarea
                      rows={3}
                      value={arrayToLines(dealData.Targeting?.ExcludedPlacements)}
                      onChange={(e) => patchTargetingNullableList('ExcludedPlacements', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apps (bundle IDs)</Label>
                    <Textarea
                      rows={3}
                      value={arrayToLines(dealData.Targeting?.Apps)}
                      onChange={(e) => patchTargetingNullableList('Apps', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ad network</Label>
                    <Input
                      className="font-mono text-xs"
                      value={dealData.Targeting?.AdNetwork != null ? String(dealData.Targeting.AdNetwork) : ''}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        mergeTargeting((t) => ({
                          ...t,
                          AdNetwork: v === '' ? null : v,
                        }));
                      }}
                      placeholder="null or ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>IAB categories</Label>
                    <Textarea
                      rows={2}
                      value={arrayToLines(dealData.Targeting?.IABCategories)}
                      onChange={(e) => patchTargetingNullableList('IABCategories', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Excluded IAB categories</Label>
                    <Textarea
                      rows={2}
                      value={arrayToLines(dealData.Targeting?.ExcludedIABCategories)}
                      onChange={(e) => patchTargetingNullableList('ExcludedIABCategories', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === 'openweb-community' && (
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Users className="w-5 h-5" />
                  Audiences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                {audiencesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading audiences…
                  </div>
                ) : (
                  <>
                    {audiencesError && (
                      <Alert variant="destructive">
                        <AlertDescription>{audiencesError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold text-slate-700">Selected audiences</h4>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(dealData.Audiences) && dealData.Audiences.length > 0 ? (
                          dealData.Audiences.map((audienceId) => {
                            const match = availableAudiences.find(
                              (aud) => String(aud.id) === String(audienceId) || String(aud.Uid) === String(audienceId),
                            );
                            const audienceLabel = match?.name || match?.Name || `Unknown (${audienceId})`;
                            return (
                              <Badge
                                key={audienceId}
                                variant="outline"
                                onClick={() => removeAudience(audienceId)}
                                className="bg-blue-50 text-blue-800 border-blue-300 cursor-pointer hover:bg-blue-100"
                                title="Click to remove"
                              >
                                {audienceLabel}
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-sm text-slate-500">No audiences selected</span>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold text-slate-700">Add audience</h4>
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <Select
                          value={selectedAudienceId}
                          onValueChange={setSelectedAudienceId}
                          disabled={availableAudiences.length === 0}
                        >
                          <SelectTrigger className="md:w-72">
                            <SelectValue placeholder="Select an audience" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {availableAudiences.map((audience) => (
                              <SelectItem key={audience.id || audience.Uid} value={String(audience.id || audience.Uid)}>
                                {audience.name || audience.Name || audience.id || audience.Uid}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" onClick={addAudience} disabled={!selectedAudienceId}>
                          Add audience
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">Select an audience from the list to associate it with this deal.</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Layers className="w-5 h-5" />
                  OpenWeb sources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">OpenWeb category (sources)</Label>
                  <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
                    {OPENWEB_SOURCE_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className={renderToggleButton(
                          Array.isArray(dealData.Targeting?.OpenwebSources) && dealData.Targeting.OpenwebSources.includes(o.value),
                        )}
                        onClick={() => toggleInTargetingArray('OpenwebSources', o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Excluded OpenWeb sources</Label>
                  <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
                    {OPENWEB_SOURCE_OPTIONS.map((o) => (
                      <button
                        key={`ex-${o.value}`}
                        type="button"
                        className={renderToggleButton(
                          Array.isArray(dealData.Targeting?.ExcludedOpenwebSources) &&
                            dealData.Targeting.ExcludedOpenwebSources.includes(o.value),
                        )}
                        onClick={() => toggleInTargetingArray('ExcludedOpenwebSources', o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === 'advanced' && (
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm mb-4">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Sparkles className="w-5 h-5" />
                  Openers &amp; delivery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Openers</Label>
                  <div className="flex flex-wrap gap-6">
                    {openerOptions.map((opener) => (
                      <label key={opener.value} className="flex items-center gap-2 text-sm text-slate-600">
                        <Checkbox
                          checked={isOpenerActive(opener.value)}
                          onCheckedChange={() => toggleOpener(opener.value)}
                        />
                        {opener.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="pause-video"
                    checked={!!dealData.Content?.PauseVideoWhenNotVisible}
                    onCheckedChange={(checked) => updateNestedData('Content', 'PauseVideoWhenNotVisible', checked)}
                  />
                  <div>
                    <Label htmlFor="pause-video" className="font-medium">Pause video when not visible</Label>
                    <p className="text-xs text-slate-500">Content.PauseVideoWhenNotVisible</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="allow-js-adv"
                    checked={dealData.AllowJavascript || false}
                    onCheckedChange={(checked) => updateDealData('AllowJavascript', checked)}
                  />
                  <div>
                    <Label htmlFor="allow-js-adv" className="font-medium">Allow JavaScript</Label>
                    <p className="text-xs text-slate-500">Enable JavaScript creatives for this deal.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm mb-4">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Layers className="w-5 h-5" />
                  Measurements &amp; exclusions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Measurement solutions</Label>
                  <div className="flex flex-wrap gap-6">
                    {MEASUREMENT_SOLUTIONS.map((m) => (
                      <div key={m.key} className="flex items-center gap-2">
                        <Switch
                          id={`ms-${m.key}`}
                          checked={Array.isArray(dealData.MeasurementSolutions) && dealData.MeasurementSolutions.includes(m.key)}
                          onCheckedChange={() => toggleMeasurementSolution(m.key)}
                        />
                        <Label htmlFor={`ms-${m.key}`} className="font-normal">{m.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-4 max-w-2xl">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Excluded deals</Label>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">Search deal</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-9 text-slate-900 placeholder:text-slate-400"
                        placeholder="Filter by name or UID"
                        value={excludedDealSearchQuery}
                        onChange={(e) => {
                          setExcludedDealSearchQuery(e.target.value);
                          setExcludedDealSearchOpen(true);
                        }}
                        onFocus={() => setExcludedDealSearchOpen(true)}
                      />
                    </div>
                    {excludedDealSearchLoading && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading deals…
                      </div>
                    )}
                    {excludedDealSearchError && <p className="text-xs text-red-600">{excludedDealSearchError}</p>}
                    {excludedDealSearchOpen && excludedDealSearchResults.length > 0 && (
                      <ul className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                        {excludedDealSearchResults.map((d) => {
                          const already = (dealData.ExcludedDeals || []).some(
                            (x) => String(x) === String(d.uid),
                          );
                          return (
                            <li
                              key={d.uid}
                              className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-0 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="min-w-0 text-slate-700" title={`UID: ${d.uid}`}>
                                <span className="font-medium">{d.name}</span>
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={already || addingExcludedDealUid === d.uid}
                                className="h-8 shrink-0 text-[11px] border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100 hover:text-rose-950 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                                onClick={() => addExcludedDealFromSearch(d.uid, d.name)}
                              >
                                {addingExcludedDealUid === d.uid ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : already ? (
                                  'Excluded'
                                ) : (
                                  'Add'
                                )}
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Excluded</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(!(dealData.ExcludedDeals || []).length) ? (
                        <span className="text-xs text-slate-400">None — use search above.</span>
                      ) : (
                        (dealData.ExcludedDeals || []).map((id) => (
                          <span
                            key={id}
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-rose-200 bg-rose-50 py-0.5 pl-2 pr-1 text-xs"
                            title={`Deal uid: ${id}`}
                          >
                            <span className="min-w-0 truncate font-medium text-rose-900">
                              {excludedDealNameByUid[id] && excludedDealNameByUid[id] !== String(id)
                                ? excludedDealNameByUid[id]
                                : 'Deal'}
                            </span>
                            <button
                              type="button"
                              className="rounded p-0.5 text-rose-800 hover:bg-rose-100 hover:text-rose-950"
                              onClick={() => removeExcludedDeal(id)}
                              aria-label="Remove excluded deal"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Ad units</Label>
                  <div className="flex flex-wrap gap-2">
                    {AD_UNIT_OPTIONS.map((u) => (
                      <label key={u} className="flex items-center gap-2 text-sm text-slate-600">
                        <Checkbox
                          checked={Array.isArray(dealData.Targeting?.AdUnits) && dealData.Targeting.AdUnits.includes(u)}
                          onCheckedChange={() => toggleAdUnit(u)}
                        />
                        {u}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm mb-4">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Globe2 className="w-5 h-5" />
                  App bundles &amp; JavaScript
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="space-y-2">
                  <Label>Allowed JavaScript domains</Label>
                  <p className="text-xs text-slate-500">One domain per line. Empty clears (null).</p>
                  <Textarea
                    rows={3}
                    value={arrayToLines(dealData.AllowedJavascriptDomains)}
                    onChange={(e) =>
                      setDealData((prev) => ({
                        ...prev,
                        AllowedJavascriptDomains: linesToNullableArray(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Blacklist app bundles</Label>
                    <Textarea
                      rows={3}
                      value={arrayToLines(dealData.BlacklistAppBundles)}
                      onChange={(e) =>
                        setDealData((prev) => ({
                          ...prev,
                          BlacklistAppBundles: linesToNullableArray(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Whitelist app bundles</Label>
                    <Textarea
                      rows={3}
                      value={arrayToLines(dealData.WhitelistAppBundles)}
                      onChange={(e) =>
                        setDealData((prev) => ({
                          ...prev,
                          WhitelistAppBundles: linesToNullableArray(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === 'notes' && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <FileText className="w-5 h-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <h4 className="text-base font-semibold text-slate-700">Internal notes</h4>
              <Textarea
                id="deal-notes"
                value={dealData.Comments || ''}
                onChange={(e) => updateDealData('Comments', e.target.value)}
                placeholder="Add internal context or comments about this deal"
                rows={8}
              />
                    </CardContent>
                  </Card>
                )}
              </>
    </EntityEditorLayout>
  );
};

export default EditDeal;