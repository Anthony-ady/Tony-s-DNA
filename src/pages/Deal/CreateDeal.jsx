/**
 * Create Deal — simple form (Manager Deal → New).
 * Design aligned with EditDeal; fields limited to essentials for POST /deals.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  Loader2,
  Plus,
  X,
  AlertCircle,
  ChevronDown,
  Smartphone,
  Video,
  AppWindow,
  Film,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { API_ENDPOINTS, apiUrl } from "@/config/api";
import EntityEditorLayout from "@/components/layouts/EntityEditorLayout";
import { toggleChipClassName } from "@/lib/toggleChip";
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";

const REGION_OPTIONS = ["Internal", "FR", "UK", "US", "EMEA", "APAC"];

const AD_FORMAT_OPTIONS = [
  { value: "AD_TRAFFIC", label: "Native display", icon: Smartphone },
  { value: "AD_VIDEO", label: "Native Video", icon: Video },
  { value: "AD_INSTREAM", label: "Instream", icon: AppWindow },
  { value: "AD_RAW_VIDEO", label: "Video in banner", icon: Film },
  { value: "AD_OUTSTREAM", label: "Outstream", icon: Layers },
];

const AUCTION_OPTIONS = [
  { value: 1, label: "First Price" },
  { value: 2, label: "Fixed Price" },
];

const PRIORITY_OPTIONS = [
  { value: "OPEN", label: "Normal" },
  { value: "SECOND_LOOK", label: "Medium" },
  { value: "FIRST_LOOK", label: "Highest" },
];

function defaultDates() {
  const start = new Date();
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 14);
  end.setUTCHours(23, 59, 59, 0);
  return { startedAt: start.getTime(), finishedAt: end.getTime() };
}

function formatDateTimeInput(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function parseDateTimeInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function floorUsdToApi(usd) {
  if (usd === "" || usd == null || Number.isNaN(Number(usd))) return 0;
  return Math.max(0, Math.round(Number(usd) * 1000));
}

export default function CreateDeal() {
  const navigate = useNavigate();
  const { startedAt: defaultStart, finishedAt: defaultEnd } = useMemo(() => defaultDates(), []);

  const [name, setName] = useState("");
  const [realmUid, setRealmUid] = useState(() => localStorage.getItem("selected-realm-id") || "");
  const [realmName, setRealmName] = useState("");
  const [companyUid, setCompanyUid] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [region, setRegion] = useState("FR");
  const [floorUsd, setFloorUsd] = useState("0.11");
  const [auctionType, setAuctionType] = useState(1);
  const [priorityKind, setPriorityKind] = useState("OPEN");
  const [adKind, setAdKind] = useState("AD_TRAFFIC");
  const [startedAt, setStartedAt] = useState(defaultStart);
  const [finishedAt, setFinishedAt] = useState(defaultEnd);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [realmNameLoading, setRealmNameLoading] = useState(false);

  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companyPickerQuery, setCompanyPickerQuery] = useState("");
  const [companyPickerResults, setCompanyPickerResults] = useState([]);
  const [companyPickerLoading, setCompanyPickerLoading] = useState(false);
  const companyPickerRootRef = useRef(null);

  const [realmPickerOpen, setRealmPickerOpen] = useState(false);
  const [realmPickerQuery, setRealmPickerQuery] = useState("");
  const [realmPickerResults, setRealmPickerResults] = useState([]);
  const [realmPickerLoading, setRealmPickerLoading] = useState(false);
  const realmPickerRootRef = useRef(null);

  // Layout only stores selected-realm-id — resolve display name via GET /realms/:id
  useEffect(() => {
    if (!realmUid) {
      setRealmName("");
      return;
    }
    if (realmName) return;

    let cancelled = false;
    setRealmNameLoading(true);
    (async () => {
      const token = authService.getToken();
      if (!token) {
        if (!cancelled) setRealmNameLoading(false);
        return;
      }
      try {
        const res = await fetch(apiUrl.realm(realmUid), {
          headers: {
            "Content-Type": "application/json",
            "x-ayl-auth-token": token,
          },
        });
        if (res.status === 401) {
          authService.handleUnauthorized?.(navigate);
          return;
        }
        if (!res.ok) return;
        const json = await res.json();
        const d = json?.Data ?? json;
        const n = d?.Name ?? d?.name;
        if (!cancelled && typeof n === "string" && n.trim()) {
          setRealmName(n.trim());
        }
      } catch {
        /* keep uid fallback briefly */
      } finally {
        if (!cancelled) setRealmNameLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [realmUid, realmName, navigate]);

  const runCompanySearch = useCallback(
    async (q) => {
      const token = authService.getToken();
      if (!token) return [];
      const filters = [];
      if (realmUid) filters.push({ Field: "Realm_uid", Operator: "match", Value: realmUid });
      if (q.trim()) filters.push({ Field: "Name", Operator: "contains", Value: q.trim() });
      try {
        const res = await fetch(API_ENDPOINTS.COMPANIES_SEARCH, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ayl-auth-token": token,
          },
          body: JSON.stringify({
            Filters: filters,
            From: 0,
            Order: [{ Field: "Name", Operator: "asc" }],
            Size: 200,
          }),
        });
        if (res.status === 401) {
          authService.handleUnauthorized?.(navigate);
          return [];
        }
        if (!res.ok) return [];
        const data = await res.json();
        const rows = Array.isArray(data.Data) ? data.Data : [];
        return rows.filter((c) => c.Visibility !== -1);
      } catch {
        return [];
      }
    },
    [navigate, realmUid],
  );

  const runRealmSearch = useCallback(
    async (q) => {
      const token = authService.getToken();
      if (!token) return [];
      const filters = [];
      if (q.trim()) filters.push({ Field: "Name", Operator: "contains", Value: q.trim() });
      try {
        const res = await fetch(API_ENDPOINTS.REALMS_SEARCH, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ayl-auth-token": token,
          },
          body: JSON.stringify({
            Filters: filters,
            From: 0,
            Order: [{ Field: "Name", Operator: "asc" }],
            Size: 200,
          }),
        });
        if (res.status === 401) {
          authService.handleUnauthorized?.(navigate);
          return [];
        }
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.Data) ? data.Data : [];
      } catch {
        return [];
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (!companyPickerOpen) return;
    let cancelled = false;
    setCompanyPickerLoading(true);
    const t = setTimeout(async () => {
      const rows = await runCompanySearch(companyPickerQuery);
      if (!cancelled) {
        setCompanyPickerResults(rows);
        setCompanyPickerLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [companyPickerOpen, companyPickerQuery, runCompanySearch]);

  useEffect(() => {
    if (!realmPickerOpen) return;
    let cancelled = false;
    setRealmPickerLoading(true);
    const t = setTimeout(async () => {
      const rows = await runRealmSearch(realmPickerQuery);
      if (!cancelled) {
        setRealmPickerResults(rows);
        setRealmPickerLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [realmPickerOpen, realmPickerQuery, runRealmSearch]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (companyPickerRootRef.current && !companyPickerRootRef.current.contains(e.target)) {
        setCompanyPickerOpen(false);
      }
      if (realmPickerRootRef.current && !realmPickerRootRef.current.contains(e.target)) {
        setRealmPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const validate = () => {
    if (!name.trim()) return "Name is required";
    if (!realmUid) return "Realm is required";
    if (!companyUid) return "Company is required";
    if (!region) return "Region is required";
    if (!startedAt || !finishedAt) return "Start and end dates are required";
    if (finishedAt <= startedAt) return "End date must be after start date";
    if (!adKind) return "Ad format is required";
    return null;
  };

  const buildPayload = () => ({
    Data: {
      AdKind: adKind,
      AdKinds: [adKind],
      DistributionChannelKinds: ["SITE", "APP"],
      Access: "DISABLED",
      AllowJavascript: true,
      AuctionType: auctionType,
      BannerStoryDisplay: false,
      BlacklistSiteDomains: [],
      WhitelistSiteDomains: [],
      BlacklistOriginTypes: [],
      WhitelistOriginTypes: [],
      Comments: "",
      Company: companyUid,
      FinishedAt: finishedAt,
      Floor: floorUsdToApi(floorUsd),
      LockVersion: 0,
      MinMargin: "0",
      ModeKind: "CLASSIC",
      Name: name.trim(),
      PriorityKind: priorityKind,
      Realm: realmUid,
      Region: region,
      Sale: "",
      StartedAt: startedAt,
      StoryDisplay: false,
      TimeZone: "",
      Uid: "",
      CrossRealm: false,
      PartnersWhitelist: {},
      Content: {
        Openers: ["REDIRECT"],
        PauseVideoWhenNotVisible: false,
      },
      SmartDeals: {},
      Targeting: {
        AdNetwork: [],
        AdUnits: [],
        Browser: [],
        BrokerPartners: [],
        Devices: ["DESKTOP", "MOBILE", "TABLET"],
        ExcludedIABCategories: [],
        ExcludedPlacements: [],
        Sites: [],
        OS: [],
        BrowserLanguages: { Exclusions: [], Inclusions: [] },
        OpenwebSources: [],
        ExcludedOpenwebSources: [],
      },
      MeasurementSolutions: [],
      Audiences: [],
      ExcludedDeals: [],
    },
    Kind: "deal",
  });

  const handleCreate = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    const token = authService.getToken();
    if (!token) {
      setError("Authentication required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch(API_ENDPOINTS.DEALS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token,
        },
        body: JSON.stringify(buildPayload()),
      });

      if (res.status === 401) {
        authService.handleUnauthorized?.(navigate);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 300) || `HTTP ${res.status}`);
      }

      const json = await res.json();
      const created = json?.Data ?? json;
      const uid = created?.Uid || json?.Id;
      const createdName = created?.Name || name.trim();

      if (!uid) {
        throw new Error("Deal created but no Uid returned");
      }

      toast.success("Deal created");
      navigate(`/EditDeal?id=${uid}&name=${encodeURIComponent(createdName)}`);
    } catch (e) {
      const msg = e?.message || "Failed to create deal";
      setError(msg);
      toast.error("Create failed", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityEditorLayout
      sectionCardTitle="Create"
      sections={[{ id: "general", label: "General info", icon: <Building2 className="w-4 h-4" /> }]}
      selectedSection="general"
      onSectionSelect={() => {}}
      sidebarFooter={(
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <Button
              onClick={handleCreate}
              disabled={saving}
              className={cn(TAILWIND_CLASSES.editPrimaryButton)}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {saving ? "Creating…" : "Create Deal"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/Deal")}
              className={cn(TAILWIND_CLASSES.editCancelButton)}
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}
      header={(
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[rgb(75,99,226)] flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">New Deal</h1>
          </div>
        </div>
      )}
      alerts={[
        error ? (
          <Alert key="err" variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-red-800 font-medium">{error}</AlertDescription>
          </Alert>
        ) : null,
      ]}
    >
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Building2 className="w-5 h-5" />
            General info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-slate-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 md:col-span-2">
              <Label>Name*</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter deal name"
              />
            </div>

            <div className="space-y-2">
              <Label>Realm*</Label>
              <div className="relative" ref={realmPickerRootRef}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full min-h-[2.75rem] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm shadow-sm hover:border-slate-300",
                    realmPickerOpen && "ring-2 ring-[rgb(59,76,164)]/30",
                  )}
                  onClick={() => {
                    setCompanyPickerOpen(false);
                    setRealmPickerOpen((prev) => {
                      const next = !prev;
                      if (next) setRealmPickerQuery("");
                      return next;
                    });
                  }}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate font-medium",
                      realmName || realmUid ? "text-slate-900" : "text-slate-400",
                    )}
                  >
                    {realmNameLoading
                      ? "Loading…"
                      : realmName || (realmUid ? "—" : "Select realm")}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400", realmPickerOpen && "rotate-180")} />
                </button>
                {realmPickerOpen && (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-md border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 p-2">
                      <Input
                        className="h-9 text-xs"
                        placeholder="Search realm…"
                        value={realmPickerQuery}
                        onChange={(e) => setRealmPickerQuery(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    {realmPickerLoading ? (
                      <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                      </div>
                    ) : realmPickerResults.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-slate-500">No realm found</p>
                    ) : (
                      <ul className="max-h-52 overflow-y-auto py-1">
                        {realmPickerResults.map((row) => (
                          <li key={row.Uid}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
                              onClick={() => {
                                setRealmUid(row.Uid);
                                setRealmName(row.Name || row.Uid);
                                setCompanyUid("");
                                setCompanyName("");
                                setRealmPickerOpen(false);
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
              <Label>Company*</Label>
              <div className="relative" ref={companyPickerRootRef}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full min-h-[2.75rem] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm shadow-sm hover:border-slate-300",
                    companyPickerOpen && "ring-2 ring-[rgb(59,76,164)]/30",
                    !realmUid && "opacity-60",
                  )}
                  disabled={!realmUid}
                  onClick={() => {
                    if (!realmUid) return;
                    setRealmPickerOpen(false);
                    setCompanyPickerOpen((prev) => {
                      const next = !prev;
                      if (next) setCompanyPickerQuery("");
                      return next;
                    });
                  }}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate font-medium",
                      companyUid ? "text-slate-900" : "text-slate-400",
                    )}
                  >
                    {!realmUid
                      ? "Select realm first"
                      : companyName || (companyUid ? companyUid : "Select company")}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400", companyPickerOpen && "rotate-180")} />
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
                                setCompanyUid(row.Uid);
                                setCompanyName(row.Name || row.Uid);
                                setCompanyPickerOpen(false);
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

            <div className="space-y-2 md:col-span-2">
              <Label>Region*</Label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Region">
                {REGION_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={toggleChipClassName(region === r)}
                    onClick={() => setRegion(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Floor price (USD/CPM)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={floorUsd}
                onChange={(e) => setFloorUsd(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                Stored as {floorUsdToApi(floorUsd)} (same unit as Edit Deal)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Auction type</Label>
              <div className="flex flex-wrap gap-2">
                {AUCTION_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={toggleChipClassName(auctionType === o.value)}
                    onClick={() => setAuctionType(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Bid priority</Label>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={toggleChipClassName(priorityKind === o.value)}
                    onClick={() => setPriorityKind(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Start*</Label>
              <Input
                type="datetime-local"
                value={formatDateTimeInput(startedAt)}
                onChange={(e) => setStartedAt(parseDateTimeInput(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>End*</Label>
              <Input
                type="datetime-local"
                value={formatDateTimeInput(finishedAt)}
                onChange={(e) => setFinishedAt(parseDateTimeInput(e.target.value))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Ad format*</Label>
              <div className="flex flex-wrap gap-2">
                {AD_FORMAT_OPTIONS.map((o) => {
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={cn(toggleChipClassName(adKind === o.value), "inline-flex items-center gap-1.5")}
                      onClick={() => setAdKind(o.value)}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </EntityEditorLayout>
  );
}
