import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl } from "@/config/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle, Loader2, Hash, Type, Settings, Edit3, Check, X, Plus, Trash2, Save
} from "lucide-react";

// ─── Reusable editable field ───────────────────────────────────────────────────
const EditableField = ({ label, value, onSave, type = "text", icon, hint }) => {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => { setCurrent(value ?? ''); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => { if (String(current) !== String(value)) onSave(current); setEditing(false); };
  const cancel = () => { setCurrent(value ?? ''); setEditing(false); };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
      <div className="flex items-center gap-3">
        {icon && React.cloneElement(icon, { className: "w-5 h-5 text-slate-500" })}
        <div>
          <span className="font-semibold text-slate-700 text-xs">{label}</span>
          {editing && hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
        </div>
      </div>
      {editing ? (
        <div className="mt-2 sm:mt-0 flex items-center gap-2">
          <Input ref={inputRef} value={current} onChange={e => setCurrent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            type={type} className="text-sm w-48" />
          <Button size="icon" variant="ghost" onClick={cancel} className="h-8 w-8"><X className="w-4 h-4" /></Button>
        </div>
      ) : (
        <div className="mt-2 sm:mt-0 flex items-center gap-2">
          <span className="text-sm text-slate-700">{value !== undefined && value !== null ? String(value) : '(not set)'}</span>
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)} className="h-8 w-8 text-slate-500 hover:text-slate-700">
            <Edit3 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── Toggle row ────────────────────────────────────────────────────────────────
const ToggleField = ({ label, value, onChange, icon, hint }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
    <div className="flex items-center gap-3">
      {icon && React.cloneElement(icon, { className: "w-5 h-5 text-slate-500" })}
      <div className="flex flex-col">
        <span className="font-semibold text-slate-700 text-xs">{label}</span>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
    </div>
    <div className="mt-2 sm:mt-0 flex items-center gap-3">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${value ? 'bg-green-100' : 'bg-red-100'}`}>
        <Switch
          checked={!!value}
          onCheckedChange={onChange}
          className={value ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}
        />
        <span className={`text-xs font-semibold ${value ? 'text-green-800' : 'text-red-800'}`}>
          {value ? 'ON' : 'OFF'}
        </span>
      </div>
    </div>
  </div>
);

// ─── Select field ──────────────────────────────────────────────────────────────
const SelectField = ({ label, value, options, onChange, icon }) => (
  <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
    <div className="flex items-center gap-3">
      {icon && React.cloneElement(icon, { className: "w-5 h-5 text-slate-500" })}
      <span className="font-semibold text-slate-700 text-xs">{label}</span>
    </div>
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

// ─── Core panel (reusable in page and modal) ───────────────────────────────────
export function UserSyncPanel({ uid, nameFromUrl }) {
  const { getToken } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const token = getToken();
    if (!token) { setError('No authentication token'); return; }
    setLoading(true); setError(null);
    fetch(apiUrl.cookieSync(uid), {
      headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' }
    })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => {
        const raw = json?.Data ?? json;
        setData({
          ...raw,
          enable_gdpr:  raw.enable_gdpr  ?? false,
          enable_gpp:   raw.enable_gpp   ?? false,
          enable_usp:   raw.enable_usp   ?? false,
          enable_coppa: raw.enable_coppa ?? false,
          only_win:     raw.only_win     ?? false,
        });
        setHasPending(false);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const applyChange = (updater) => {
    setData(prev => { const next = structuredClone(prev); updater(next); return next; });
    setHasPending(true);
  };

  const handleSave = async () => {
    if (!data) return;
    const token = getToken();
    if (!token) { setError('No authentication token'); return; }
    setSaving(true); setError(null); setSuccess(false);
    try {
      const cleanEndpoint = (ep) => {
        const e = { ...ep };
        if (e.uid === null || e.uid === undefined) delete e.uid;
        if (e.partner_uid === null || e.partner_uid === undefined) delete e.partner_uid;
        return e;
      };
      const payload = {
        ...data,
        lock_version: (data.lock_version ?? 0) + 1,
        enable_gdpr:  data.enable_gdpr  ?? false,
        enable_gpp:   data.enable_gpp   ?? false,
        enable_usp:   data.enable_usp   ?? false,
        enable_coppa: data.enable_coppa ?? false,
        only_win:     data.only_win     ?? false,
        endpoints:    (data.endpoints ?? []).map(cleanEndpoint),
      };
      const res = await fetch(apiUrl.cookieSync(uid), {
        method: 'PUT',
        headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status}: ${t}`); }
      const json = await res.json();
      setData(json?.Data ?? json);
      setHasPending(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const updateEndpointUrl = (idx, url) => applyChange(d => { d.endpoints[idx].url = url; });
  const removeEndpoint = (idx) => applyChange(d => { d.endpoints.splice(idx, 1); });
  const addEndpoint = () => applyChange(d => {
    d.endpoints = [...(d.endpoints ?? []), { code: 'EUR', url: 'https://', type: 'cookie_sync', uid: null, partner_uid: null }];
  });

  const updateParamValue = (key, val) => applyChange(d => { d.parameters[key] = val; });
  const removeParam = (key) => applyChange(d => { delete d.parameters[key]; });
  const addParam = () => applyChange(d => { d.parameters = { ...(d.parameters ?? {}), 'VISITOR_ID': '' }; });

  if (!uid) return <div className="p-8 text-slate-500">No ID provided.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">{data?.name ?? nameFromUrl ?? 'User Sync'}</h2>
        <Button
          onClick={handleSave}
          disabled={saving || !hasPending}
          className="bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)] text-white h-8 text-xs"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50 py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800 text-xs">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50 py-2">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 text-xs">Saved successfully.</AlertDescription>
        </Alert>
      )}

      {loading && !data && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-[rgb(75,99,226)]" />
        </div>
      )}

      {data && (
        <>
          {/* Basic Info */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-3 pt-4">
              <span className="font-semibold tracking-tight text-sm text-slate-800">Basic Info</span>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <Hash className="w-5 h-5 text-slate-500" />
                  <span className="font-semibold text-slate-700 text-xs">UID</span>
                </div>
                <code className="text-xs font-mono bg-indigo-50 text-indigo-800 px-2 py-1 rounded-md">{data.uid}</code>
              </div>

              <EditableField label="Name" value={data.name} onSave={v => applyChange(d => { d.name = v; })} icon={<Type />} />
              <SelectField label="Insert Mode" value={data.insert_mode} options={['PIXEL', 'IFRAME']} onChange={v => applyChange(d => { d.insert_mode = v; })} icon={<Settings />} />
              <SelectField label="Sync Resolver" value={data.sync_resolver} options={['INTERNAL', 'EXTERNAL']} onChange={v => applyChange(d => { d.sync_resolver = v; })} icon={<Settings />} />
              <EditableField label="Priority" value={data.priority} type="number" onSave={v => applyChange(d => { d.priority = Number(v); })} icon={<Settings />} hint="Higher value = called first" />
              <EditableField label="TTL (hours)" value={data.ttl} type="number" onSave={v => applyChange(d => { d.ttl = Number(v); })} icon={<Settings />} />
              <ToggleField label="Only Win" value={data.only_win} onChange={v => applyChange(d => { d.only_win = v; })} icon={<Settings />} hint="We strongly recommend keeping this off" />
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-3 pt-4">
              <span className="font-semibold tracking-tight text-sm text-slate-800">Privacy</span>
              <ToggleField label="Enable GDPR"  value={data.enable_gdpr}  onChange={v => applyChange(d => { d.enable_gdpr = v; })}  icon={<Settings />} />
              <ToggleField label="Enable GPP"   value={data.enable_gpp}   onChange={v => applyChange(d => { d.enable_gpp = v; })}   icon={<Settings />} />
              <ToggleField label="Enable USP"   value={data.enable_usp}   onChange={v => applyChange(d => { d.enable_usp = v; })}   icon={<Settings />} />
              <ToggleField label="Enable COPPA" value={data.enable_coppa} onChange={v => applyChange(d => { d.enable_coppa = v; })} icon={<Settings />} />
            </CardContent>
          </Card>

          {/* Endpoints */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold tracking-tight text-sm text-slate-800">Endpoints</span>
                <Button size="sm" variant="outline" onClick={addEndpoint} className="h-7 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
              {(!data.endpoints || data.endpoints.length === 0) ? (
                <p className="text-xs text-slate-500 px-1">No endpoints configured</p>
              ) : (
                data.endpoints.map((ep, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs font-mono">{ep.code || 'EUR'}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => removeEndpoint(idx)} className="h-7 w-7 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">URL</Label>
                      <Input
                        value={ep.url ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          updateEndpointUrl(idx, val.startsWith('https://') ? val : 'https://' + val.replace(/^https?:\/\//, ''));
                        }}
                        className="h-8 text-xs font-mono"
                        placeholder="https://…"
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Parameters */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold tracking-tight text-sm text-slate-800">Parameters</span>
                <Button size="sm" variant="outline" onClick={addParam} className="h-7 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
              {(!data.parameters || Object.keys(data.parameters).length === 0) ? (
                <p className="text-xs text-slate-500 px-1">No parameters configured</p>
              ) : (
                Object.entries(data.parameters).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/70">
                    <span className="text-xs font-mono font-semibold text-slate-600 shrink-0 w-32">{key}</span>
                    <span className="text-xs text-slate-400 shrink-0">=</span>
                    <Input value={val ?? ''} onChange={e => updateParamValue(key, e.target.value)} className="h-8 text-xs font-mono flex-1" placeholder="Value" />
                    <Button size="icon" variant="ghost" onClick={() => removeParam(key)} className="h-8 w-8 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Page wrapper ──────────────────────────────────────────────────────────────
export default function UserSync() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('id');
  const nameFromUrl = searchParams.get('name');

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto p-6 lg:p-8">
        <UserSyncPanel uid={uid} nameFromUrl={nameFromUrl} />
      </div>
    </div>
  );
}
