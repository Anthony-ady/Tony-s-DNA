/**
 * Edit User page: GET user by id, display form, save with PUT.
 * Layout and display follow EditSite / EditPlacement template.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { User, Loader2, Save, X, AlertCircle, ClipboardCopy, Clock } from "lucide-react";
import { authService } from "@/services/authService";
import { apiUrl } from "@/config/api";
import EntityEditorLayout from "@/components/layouts/EntityEditorLayout";
import { useEntityFetch } from "@/hooks/useEntityFetch";
import { apiPut } from "@/services/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";

const RANK_OPTIONS = [
  { value: "USER", label: "User" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPERADMIN", label: "Super Administrator" },
  { value: "DISABLED", label: "Disabled" },
];

function removeNullFields(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(removeNullFields);
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) cleaned[key] = removeNullFields(value);
  }
  return cleaned;
}

function formatTs(ts) {
  if (ts == null) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function EditUser() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = searchParams.get("id");
  const userNameParam = searchParams.get("name") || "";

  const resolveUserUrl = useCallback((id) => apiUrl.user(id), []);
  const extractUserData = useCallback((d) => d?.Data ?? d, []);
  const handleUnauthorized = useCallback(() => authService.handleUnauthorized(navigate), [navigate]);

  const { data: fetchedData, loading, error: fetchError, refetch } = useEntityFetch({
    entityId: userId,
    url: resolveUserUrl,
    dataExtractor: extractUserData,
    onUnauthorized: handleUnauthorized,
  });

  const [userData, setUserData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isPowerUser, setIsPowerUser] = useState(false);
  const [selectedSection, setSelectedSection] = useState("basic");

  useEffect(() => {
    let cancelled = false;
    authService.getSessionData().then((sessionData) => {
      if (cancelled) return;
      setIsPowerUser(sessionData?.CurrentUser?.PowerUser === true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!fetchedData) {
      setUserData(null);
      return;
    }
    const d = { ...fetchedData };
    if (d.Company && typeof d.Company === "object" && d.Company.Uid) {
      d.CompanyUid = d.Company.Uid;
      d.CompanyName = d.Company.Name || d.Company.Uid;
    } else if (typeof d.Company === "string") {
      d.CompanyUid = d.Company;
      d.CompanyName = d.Company;
    }
    if (!d.Preferences || typeof d.Preferences !== "object") d.Preferences = { DateFormat: "%m/%d/%y", Dashboard: {} };
    if (!d.Preferences.Dashboard) d.Preferences.Dashboard = {};
    if (d.Title === "MR") d.Title = "Mr.";
    if (d.Title === "MRS") d.Title = "Mrs.";
    setUserData(d);
  }, [fetchedData]);

  const displayName = userData
    ? [userData.FirstName, userData.LastName].filter(Boolean).join(" ") || userData.Email || "User"
    : userNameParam || "User";
  const truncatedName = displayName.length > 15 ? `${displayName.substring(0, 15)}...` : displayName;

  const sections = [
    { id: "basic", label: "Basic Info", icon: <User className="w-4 h-4" /> },
    { id: "details", label: "Details", icon: <Clock className="w-4 h-4" /> },
  ];

  const handleCopyUserId = async () => {
    if (userData?.Uid) {
      try {
        await navigator.clipboard.writeText(userData.Uid);
        toast.success("Copied", { description: "User UID copied to clipboard." });
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  const handleSave = async () => {
    if (!userData || !userId || saving) return;
    try {
      setSaving(true);
      setError(null);
      const token = authService.getToken();
      if (!token) {
        authService.handleUnauthorized(navigate);
        return;
      }
      const name = [userData.FirstName, userData.LastName].filter(Boolean).join(" ").trim() || userData.Email || "";
      const companyValue = userData.CompanyUid ?? (userData.Company?.Uid ?? userData.Company);
      const payload = {
        Data: removeNullFields({
          Uid: userData.Uid,
          LockVersion: userData.LockVersion,
          Email: userData.Email,
          FirstName: userData.FirstName,
          LastName: userData.LastName,
          Name: name,
          Title: userData.Title ?? null,
          Rank: userData.Rank,
          Realm: userData.Realm,
          Company: companyValue || null,
          Blocked: userData.Blocked ?? false,
          Visibility: userData.Visibility ?? 0,
          Preferences: userData.Preferences ?? { DateFormat: "%m/%d/%y", Dashboard: {} },
          Picture: userData.Picture ?? null,
          Tags: Array.isArray(userData.Tags) ? userData.Tags : [],
          Password: "",
          PasswordConfirmation: "",
        }),
        Id: userId,
        Kind: "User",
        Version: 1000,
      };
      const response = await apiPut(apiUrl.user(userId), payload, { token });
      if (!response.ok) {
        if (response.status === 401) {
          authService.handleUnauthorized(navigate);
          return;
        }
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.Message || errBody.error || `HTTP ${response.status}`);
      }
      toast.success("User saved", {
        description: "Your changes were applied successfully.",
      });
      refetch();
    } catch (err) {
      toast.error("Save failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const update = (key, value) => setUserData((prev) => (prev ? { ...prev, [key]: value } : prev));

  if (!userId) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-slate-600">Missing user id.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !userData) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Loading user data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Alert variant="destructive" className="mb-4 border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-red-800 font-medium">{fetchError}</AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-slate-600">No user data found</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EntityEditorLayout
      sections={sections}
      selectedSection={selectedSection}
      onSectionSelect={setSelectedSection}
      sectionCardTitle="User"
      sidebarFooter={
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className={cn(TAILWIND_CLASSES.editPrimaryButton)}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/UserManagement")}
              className={cn(TAILWIND_CLASSES.editCancelButton)}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </CardContent>
        </Card>
      }
      header={
        <div className="mb-6">
          <div className="bg-gradient-to-r from-white via-[rgb(244,246,255)] to-white border border-[rgb(220,227,255)] shadow-sm rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", TAILWIND_CLASSES.editIconBox)}>
                  <User className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold text-slate-900 leading-tight" title={displayName}>
                    {truncatedName}
                  </h1>
                  <p className="text-sm text-slate-500">Edit user configuration</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {userData.Rank && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] border border-[rgb(59,76,164)]/20">
                    Rank: {userData.Rank}
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border",
                    userData.Blocked ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-600 border-green-200"
                  )}
                >
                  Blocked: {userData.Blocked ? "Yes" : "No"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border",
                    userData.Visibility === -1 ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-green-50 text-green-600 border-green-200"
                  )}
                >
                  {userData.Visibility === -1 ? "Archived" : "Active"}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">User UID</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-700 text-xs md:text-sm break-all">{userData.Uid || userId}</span>
                  {userData.Uid && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyUserId}>
                      <ClipboardCopy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Company</p>
                <p className="font-medium text-slate-700">{userData.CompanyName || userData.CompanyUid || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Realm</p>
                <p className="font-medium text-slate-700 font-mono text-xs">{userData.Realm || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      }
      alerts={[
        error && (
          <Alert key="save" variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-red-800 font-medium">{error}</AlertDescription>
          </Alert>
        ),
      ]}
    >
      {selectedSection === "basic" && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <User className="w-5 h-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={userData.FirstName ?? ""}
                  onChange={(e) => update("FirstName", e.target.value)}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={userData.LastName ?? ""}
                  onChange={(e) => update("LastName", e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userData.Email ?? ""}
                onChange={(e) => update("Email", e.target.value)}
                className="bg-white"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Title</Label>
                <Select value={userData.Title ?? ""} onValueChange={(v) => update("Title", v)}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr.">Mr.</SelectItem>
                    <SelectItem value="Mrs.">Mrs.</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role (Rank)</Label>
                <Select value={userData.Rank ?? "USER"} onValueChange={(v) => update("Rank", v)}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANK_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={userData.CompanyName ?? userData.CompanyUid ?? "—"} readOnly className="bg-slate-50 text-slate-600" />
              <p className="text-xs text-slate-500">Company is read-only from the user record.</p>
            </div>
            <div className="space-y-2">
              <Label>Realm</Label>
              <Input value={userData.Realm ?? "—"} readOnly className="bg-slate-50 text-slate-600 font-mono text-sm" />
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              {isPowerUser ? (
                <>
                  <Switch id="blocked" checked={!!userData.Blocked} onCheckedChange={(v) => update("Blocked", v)} />
                  <Label htmlFor="blocked">Blocked</Label>
                </>
              ) : (
                <>
                  <Label className="text-slate-600">Blocked</Label>
                  <span className="text-sm text-slate-500">{userData.Blocked ? "Yes" : "No"}</span>
                  <span className="text-xs text-slate-400">(only Power Users can change this)</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="archived"
                checked={userData.Visibility === -1}
                onCheckedChange={(v) => update("Visibility", v ? -1 : 0)}
              />
              <Label htmlFor="archived">Archived</Label>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSection === "details" && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Clock className="w-5 h-5" />
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                <span className="text-slate-500">Created at</span>
                <span className="text-slate-900 font-medium">{formatTs(userData.CreatedAt)}</span>
              </div>
              <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                <span className="text-slate-500">Last sign in</span>
                <span className="text-slate-900 font-medium">{formatTs(userData.LastSignInAt)}</span>
              </div>
              <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                <span className="text-slate-500">Updated at</span>
                <span className="text-slate-900 font-medium">{formatTs(userData.UpdatedAt)}</span>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <span className="text-slate-500">Power User</span>
                <span className="text-slate-900 font-medium">{userData.PowerUser === true ? "Yes" : "No"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </EntityEditorLayout>
  );
}
