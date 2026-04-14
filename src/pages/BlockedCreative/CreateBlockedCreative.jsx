/**
 * Create Blocked Creative Page
 * Same layout and colors as CreateUser/CreateBroker: EntityEditorLayout, header banner, sidebar, blue card headers.
 * Form: DSP (optional), Creative ID (required), Publisher ID (optional), Realm ID (optional).
 * On success redirect to BlockedCreativeManagement.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldBan, Plus, Loader2, AlertCircle, CheckCircle, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS } from "@/config/api";
import EntityEditorLayout from "@/components/layouts/EntityEditorLayout";
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";

export default function CreateBlockedCreative() {
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [partnerId, setPartnerId] = useState("");
  const [creativeId, setCreativeId] = useState("");
  const [publisherId, setPublisherId] = useState("");
  const [realmId, setRealmId] = useState("");

  const [dspList, setDspList] = useState([]);
  const [loadingDspList, setLoadingDspList] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedSection, setSelectedSection] = useState("block");

  const fetchPartners = async () => {
    setLoadingDspList(true);
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(API_ENDPOINTS.PARTNERS_SEARCH, {
        method: "POST",
        headers: { "x-ayl-auth-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({
          Filters: [{ Field: "Status", Operator: "in", Value: ["PRODUCTION", "DISABLED"] }],
          From: 0,
          Order: [{ Field: "UpdatedAt", Operator: "desc" }],
          Size: 250,
        }),
      });
      if (!response.ok) return;
      const data = await response.json();
      const list = Array.isArray(data?.Data) ? data.Data : [];
      setDspList(list.map((p) => ({ uid: p.uid, name: p.name || p.uid })));
    } catch {
      setDspList([]);
    } finally {
      setLoadingDspList(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleBlockClick = () => {
    if (!creativeId.trim()) {
      setError("Creative ID is required.");
      return;
    }
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const token = getToken();
        if (!token) throw new Error("Not authenticated");
        const response = await fetch(API_ENDPOINTS.BLOCKED_CREATIVE_MANUAL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ayl-auth-token": token },
          body: JSON.stringify({
            creative_id: creativeId.trim(),
            partner_id: partnerId.trim() || null,
            publisher_id: publisherId.trim() || null,
            realm_id: realmId.trim() || null,
          }),
        });
        const text = await response.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
        }
        setSuccess(true);
        setTimeout(() => navigate("/BlockedCreativeManagement"), 2000);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  };

  const canSubmit = Boolean(creativeId.trim());

  const sections = [
    { id: "block", label: "Block Creative", icon: <ShieldBan className="w-4 h-4" /> },
  ];

  return (
    <EntityEditorLayout
      sections={sections}
      selectedSection={selectedSection}
      onSectionSelect={setSelectedSection}
      sectionCardTitle="Blocked Creative"
      sidebarFooter={
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <Button
              onClick={handleBlockClick}
              disabled={loading || !canSubmit}
              className={cn(TAILWIND_CLASSES.editPrimaryButton)}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldBan className="w-4 h-4 mr-2" />}
              {loading ? "Blocking…" : "Block Creative"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/BlockedCreativeManagement")}
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
                  <ShieldBan className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold text-slate-900 leading-tight">Block a creative</h1>
                  <p className="text-sm text-slate-500">
                    Manually block a creative. DSP is optional; you can scope with publisher / realm.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
      alerts={[
        error && (
          <Alert key="error" variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-red-800 font-medium">{error}</AlertDescription>
          </Alert>
        ),
        success && (
          <Alert key="success" className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 font-medium">
              Creative blocked successfully. Redirecting to Blocked Creatives…
            </AlertDescription>
          </Alert>
        ),
      ]}
    >
      {selectedSection === "block" && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <ShieldBan className="w-5 h-5" />
              Block Creative
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="create-dsp">
                DSP (Partner) <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Select
                value={partnerId || "__none__"}
                onValueChange={(v) => setPartnerId(v === "__none__" ? "" : v)}
                disabled={loading || loadingDspList}
              >
                <SelectTrigger id="create-dsp" className="w-full bg-white font-mono text-sm">
                  <SelectValue placeholder={loadingDspList ? "Loading DSPs…" : "No DSP (global block)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No DSP (global block)</SelectItem>
                  {dspList.map((dsp) => (
                    <SelectItem key={dsp.uid} value={dsp.uid}>
                      {dsp.name} ({dsp.uid})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-creative-id">Creative ID <span className="text-red-500">*</span></Label>
              <Input
                id="create-creative-id"
                placeholder="e.g. cr-u7tz5k6pufse08slosj"
                value={creativeId}
                onChange={(e) => setCreativeId(e.target.value)}
                disabled={loading}
                className="bg-white font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-publisher-id">Publisher ID <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input
                id="create-publisher-id"
                placeholder="company_uid"
                value={publisherId}
                onChange={(e) => setPublisherId(e.target.value)}
                disabled={loading}
                className="bg-white font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-realm-id">Realm ID <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input
                id="create-realm-id"
                placeholder="realm_uid"
                value={realmId}
                onChange={(e) => setRealmId(e.target.value)}
                disabled={loading}
                className="bg-white font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </EntityEditorLayout>
  );
}
