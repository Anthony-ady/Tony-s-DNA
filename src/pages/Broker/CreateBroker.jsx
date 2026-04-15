/**
 * Create Broker Page
 * Same layout and colors as CreateUser/EditUser: EntityEditorLayout, header banner, sidebar, blue card headers.
 * Sections: Broker Configuration, Contents. Create/Cancel in sidebar; redirect to BrokerManagement on success.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Building2, Layers, Plus, Loader2, AlertCircle, CheckCircle, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS } from "@/config/api";
import EntityEditorLayout from "@/components/layouts/EntityEditorLayout";
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";

export default function CreateBroker() {
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    visibility: 0,
    connector_kind: "OPEN_RTB_2_5",
    endpoint_id: "",
    tag_id_override: "",
    url: "",
    comments: "",
    contents: {
      AD_BANNER: false,
      AD_INSTREAM: false,
      AD_OUTSTREAM: false,
      AD_TRAFFIC: false,
      AD_VIDEO: false,
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedSection, setSelectedSection] = useState("config");

  const handleInputChange = (field, value) => {
    if (field === "endpoint_id") {
      value = value.toLowerCase().replace(/[_-]/g, "");
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleContentsChange = (contentType, checked) => {
    setFormData((prev) => ({
      ...prev,
      contents: { ...prev.contents, [contentType]: checked },
    }));
  };

  const buildPayload = () => {
    const contentsObj = {};
    if (formData.contents.AD_BANNER) contentsObj.AD_BANNER = ["AD_BANNER"];
    if (formData.contents.AD_INSTREAM) contentsObj.AD_INSTREAM = ["AD_INSTREAM"];
    if (formData.contents.AD_OUTSTREAM) contentsObj.AD_OUTSTREAM = ["AD_OUTSTREAM"];
    if (formData.contents.AD_TRAFFIC) contentsObj.AD_TRAFFIC = ["AD_TRAFFIC"];
    if (formData.contents.AD_VIDEO) contentsObj.AD_VIDEO = ["AD_VIDEO"];

    const now = new Date().toISOString().replace("T", " ").substring(0, 23);
    const integrationOpeners = [];
    const integrationUid = "";

    if (formData.contents.AD_BANNER) {
      integrationOpeners.push({
        ad_kind: "AD_BANNER",
        components: [],
        deletable: null,
        disallow_popin: null,
        disallow_reduce: false,
        integration_uid: integrationUid,
        inview_expand: null,
        muted: false,
        opener_kind: "REDIRECT",
        path: "AD_BANNER.000",
        redirection_target: "TAB",
        trigger: "CLICK",
        uid: "",
      });
    }
    if (formData.contents.AD_TRAFFIC) {
      integrationOpeners.push({
        ad_kind: "AD_TRAFFIC",
        components: [],
        deletable: null,
        disallow_popin: null,
        disallow_reduce: false,
        integration_uid: integrationUid,
        inview_expand: null,
        muted: false,
        opener_kind: "REDIRECT",
        path: "AD_TRAFFIC.000",
        redirection_target: "TAB",
        trigger: "CLICK",
        uid: "",
      });
    }
    if (formData.contents.AD_INSTREAM) {
      integrationOpeners.push({
        ad_kind: "AD_INSTREAM",
        components: ["PLAYLIST", "SHARES", "VIEW_BUTTONS"],
        deletable: true,
        disallow_popin: null,
        disallow_reduce: true,
        integration_uid: integrationUid,
        inview_expand: null,
        muted: true,
        opener_kind: "ADREADER",
        path: "AD_INSTREAM.000",
        redirection_target: "TAB",
        trigger: "LOAD",
        uid: "",
      });
      integrationOpeners.push({
        ad_kind: "AD_INSTREAM",
        components: ["PLAYLIST", "SHARES", "VIEW_BUTTONS"],
        deletable: false,
        disallow_popin: null,
        disallow_reduce: true,
        integration_uid: integrationUid,
        inview_expand: null,
        muted: true,
        opener_kind: "INPREVIEW",
        path: "AD_INSTREAM.001",
        redirection_target: "TAB",
        trigger: "LOAD",
        uid: "",
      });
    }
    if (formData.contents.AD_OUTSTREAM) {
      integrationOpeners.push({
        ad_kind: "AD_OUTSTREAM",
        components: ["PLAYLIST", "SHARES", "VIEW_BUTTONS"],
        deletable: false,
        disallow_popin: null,
        disallow_reduce: true,
        integration_uid: integrationUid,
        inview_expand: null,
        muted: true,
        opener_kind: "INPREVIEW",
        path: "AD_OUTSTREAM.000",
        redirection_target: "TAB",
        trigger: "LOAD",
        uid: "",
      });
    }
    if (formData.contents.AD_VIDEO) {
      integrationOpeners.push({
        ad_kind: "AD_VIDEO",
        components: ["PLAYLIST", "SHARES", "VIEW_BUTTONS"],
        deletable: true,
        disallow_popin: null,
        disallow_reduce: true,
        integration_uid: integrationUid,
        inview_expand: null,
        muted: true,
        opener_kind: "ADREADER",
        path: "AD_VIDEO.000",
        redirection_target: "TAB",
        trigger: "LOAD",
        uid: "",
      });
      integrationOpeners.push({
        ad_kind: "AD_VIDEO",
        components: ["PLAYLIST", "SHARES", "VIEW_BUTTONS"],
        deletable: false,
        disallow_popin: null,
        disallow_reduce: true,
        integration_uid: integrationUid,
        inview_expand: null,
        muted: true,
        opener_kind: "INPREVIEW",
        path: "AD_VIDEO.001",
        redirection_target: "TAB",
        trigger: "LOAD",
        uid: "",
      });
    }
    if (formData.contents.AD_OUTSTREAM || formData.contents.AD_VIDEO) {
      integrationOpeners.push({
        ad_kind: "AD_RAW_VIDEO",
        components: ["PLAYLIST", "SHARES", "VIEW_BUTTONS"],
        deletable: true,
        disallow_popin: null,
        disallow_reduce: true,
        integration_uid: integrationUid,
        inview_expand: null,
        muted: true,
        opener_kind: "ADREADER",
        path: "AD_RAW_VIDEO.000",
        redirection_target: "TAB",
        trigger: "LOAD",
        uid: "",
      });
      integrationOpeners.push({
        ad_kind: "AD_RAW_VIDEO",
        components: ["PLAYLIST", "SHARES", "VIEW_BUTTONS"],
        deletable: false,
        disallow_popin: null,
        disallow_reduce: true,
        integration_uid: integrationUid,
        inview_expand: null,
        muted: true,
        opener_kind: "INPREVIEW",
        path: "AD_RAW_VIDEO.001",
        redirection_target: "TAB",
        trigger: "LOAD",
        uid: "",
      });
    }

    return {
      accept_privacy: false,
      allow_bid_response_overwrite: null,
      bid_response_overwrite: null,
      bill_notice_browser: true,
      connector_kind: formData.connector_kind || "OPEN_RTB_2_5",
      contents: contentsObj,
      cookie_sync: {
        created_at: now,
        enable_coppa: null,
        enable_gdpr: false,
        enable_gpp: null,
        enable_usp: null,
        endpoints: [],
        fallback: null,
        insert_mode: "PIXEL",
        lock_version: 0,
        name: `${formData.name.trim()}_cookie_sync`,
        only_win: false,
        parameters: {
          GDPR: "GDPR",
          GDPR_CONSENT_STRING: "GDPR_CONSENT",
          VISITOR_ID: "PARTNER_USER_ID",
        },
        priority: 2,
        refresh_at: 672,
        sync_resolver: "INTERNAL",
        targeting: null,
        ttl: 720,
        uid: "",
        updated_at: now,
        visibility: 0,
      },
      cookie_sync_url: null,
      cookie_sync_with_all_partners: true,
      creative_mimes_by_ad_kind: null,
      custom_assets_ids: null,
      daily_quota: 0,
      data_centers: {
        "gcp-europe-west9": { Enabled: true },
        "gcp-us-east4": { Default: true, Enabled: true },
        "gcp-us-west1": { Enabled: true },
      },
      debug: { LogLevel: "DISABLED", MaxLogPerSecond: 1 },
      default_creative_mimes: { Dailymotion: false, Youtube: false },
      encoder_kind: "BROKER_OPENRTB_2_5",
      endpoint_id: formData.endpoint_id,
      endpoint_type: "STANDARD",
      integration: {
        banner: null,
        base_container_selector: null,
        config: {
          ClickFormat: true,
          Creative20: true,
          Insertion: "APPEND",
          Placeholders: {
            Body: {
              Align: "margin: auto;",
              BackgroundColor: { A: 100, B: 255, G: 255, R: 255 },
              BoxShadow: true,
              Color: { A: 100, B: 35, G: 35, R: 35 },
              FontFamily: "Arial",
            },
            CallToAction: { Color: { A: 100, B: 212, G: 157, R: 26 } },
            Description: { Length: 130 },
            Image: { Height: 600, Width: 600 },
            Size_: { Height: "350px", Width: "500px" },
            Sponsor: { Color: { A: 100, B: 35, G: 35, R: 35 }, Label: true },
            Title: { Color: { A: 100, B: 48, G: 48, R: 48 } },
          },
          WidgetKind: "CREATIVE_TEMPLATE_4",
        },
        creative_config: {
          PrimaryColor: { A: 100, B: 48, G: 48, R: 48 },
          SecondaryColor: { A: 100, B: 255, G: 255, R: 255 },
        },
        extra_stylesheet: null,
        integration_opener: integrationOpeners,
        kind: "WIDGET",
        native_type: "ATOMIC_CONTENT",
        trigger: "LOAD",
        uid: "",
        video_start_delay: 0,
        video_type: "OUTSTREAM_IN_ARTICLE",
      },
      inventory_directness: "RESELLER",
      is_confidential: false,
      lang: "EN",
      limit_request: "10",
      lock_version: 0,
      name: formData.name.trim(),
      placement_kind: "EXTERNAL",
      provisioning_status: "PROVISIONED",
      revenue: null,
      seller_id: "",
      serve_vpaid: false,
      sources: ["SSP", "ADSERVER"],
      ssp_config: {
        advertisers_exclusion: null,
        allowed_seats: null,
        auction_timeout: null,
        blocked_seats: null,
        categories_exclusion: [],
        cookie_sync_exclusion: null,
        cookie_sync_only_win: null,
        creative_scan_policy: null,
        creative_scan_ratio: null,
        disable_creative_scan: true,
        disable_dynamic_margin: true,
        disable_intent_iq: true,
        disable_on_fraudulent: null,
        disable_open_auction: null,
        disable_partner_selection: false,
        disabled: false,
        enable_encoded_tracking: false,
        enable_enrich_tracking_metrics: false,
        is_legacy_native_tracking: false,
        margin: 0.7,
        min_t_max: null,
        openweb_managed: false,
        partners_exclusion: null,
        prevent_native2banner: false,
        prevent_video2banner: true,
        prevent_video2native: true,
        revenues: [],
        skip_bot_enrichment: false,
        skip_ua_detection: false,
        strategy: "SHARE",
        t_max_flag: null,
        video_assets_cover: null,
        video_assets_locales: null,
        wrapping_type: null,
      },
      tag_id_override: formData.tag_id_override,
      targeting: null,
      updated_at: now,
      url: formData.url || "",
      visibility: formData.visibility,
      visitor_kind: "AYL",
    };
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      if (!formData.name?.trim()) throw new Error("Broker name is required");
      if (!formData.endpoint_id?.trim()) throw new Error("Endpoint ID is required");
      if (!formData.tag_id_override?.trim()) throw new Error("Tag ID Override is required");
      if (!formData.url?.trim()) throw new Error("URL is required");

      const token = getToken();
      if (!token) throw new Error("Please login first");

      const brokerData = buildPayload();
      const response = await fetch(API_ENDPOINTS.BROKER_PARTNERS, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ayl-auth-token": token },
        body: JSON.stringify(brokerData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `HTTP error! status: ${response.status}` };
        }
        throw new Error(errorData.message || errorData.error || errorText || `HTTP error! status: ${response.status}`);
      }

      setSuccess(true);
      setTimeout(() => navigate("/BrokerManagement"), 2000);
    } catch (err) {
      setError(`Error creating Broker: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    formData.name?.trim() &&
    formData.endpoint_id?.trim() &&
    formData.tag_id_override?.trim() &&
    formData.url?.trim();

  const sections = [
    { id: "config", label: "Broker Configuration", icon: <Building2 className="w-4 h-4" /> },
    { id: "contents", label: "Contents", icon: <Layers className="w-4 h-4" /> },
  ];

  const visibilityLabel = formData.visibility === 0 ? "PRODUCTION" : "DISABLED";

  return (
    <EntityEditorLayout
      sections={sections}
      selectedSection={selectedSection}
      onSectionSelect={setSelectedSection}
      sectionCardTitle="Broker"
      sidebarFooter={
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <Button
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
              className={cn(TAILWIND_CLASSES.editPrimaryButton)}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {loading ? "Creating..." : "Create Broker"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/BrokerManagement")}
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
                  <Building2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold text-slate-900 leading-tight">Create New Broker</h1>
                  <p className="text-sm text-slate-500">Add a new Broker partner to your network</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] border border-[rgb(59,76,164)]/20">
                  Visibility: {visibilityLabel}
                </span>
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
              Broker created successfully! Redirecting to Broker Management...
            </AlertDescription>
          </Alert>
        ),
      ]}
    >
      {selectedSection === "config" && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Building2 className="w-5 h-5" />
              Broker Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Broker Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter broker name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  disabled={loading}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.visibility.toString()}
                  onValueChange={(value) => handleInputChange("visibility", parseInt(value, 10))}
                  disabled={loading}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">PRODUCTION</SelectItem>
                    <SelectItem value="-1">DISABLED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="connector_kind">Connector Kind <span className="text-red-500">*</span></Label>
                <Input
                  id="connector_kind"
                  type="text"
                  placeholder="e.g., OPEN_RTB_2_5"
                  value={formData.connector_kind}
                  onChange={(e) => handleInputChange("connector_kind", e.target.value)}
                  disabled={loading}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endpoint_id">Endpoint ID <span className="text-red-500">*</span></Label>
                <Input
                  id="endpoint_id"
                  type="text"
                  placeholder="Lowercase, no underscores or dashes"
                  value={formData.endpoint_id}
                  onChange={(e) => handleInputChange("endpoint_id", e.target.value)}
                  disabled={loading}
                  className="bg-white"
                />
                <p className="text-xs text-slate-500">Converted to lowercase; underscores/dashes removed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag_id_override">Tag ID Override <span className="text-red-500">*</span></Label>
                <Input
                  id="tag_id_override"
                  type="text"
                  placeholder="Enter tag ID override"
                  value={formData.tag_id_override}
                  onChange={(e) => handleInputChange("tag_id_override", e.target.value)}
                  disabled={loading}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL <span className="text-red-500">*</span></Label>
                <Input
                  id="url"
                  type="text"
                  placeholder="Enter URL"
                  value={formData.url}
                  onChange={(e) => handleInputChange("url", e.target.value)}
                  disabled={loading}
                  className="bg-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                placeholder="Additional notes about this broker..."
                value={formData.comments}
                onChange={(e) => handleInputChange("comments", e.target.value)}
                disabled={loading}
                rows={3}
                className="bg-white"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSection === "contents" && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Layers className="w-5 h-5" />
              Contents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">Select the ad formats supported by this broker</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "AD_BANNER", label: "Banner" },
                { key: "AD_INSTREAM", label: "Instream" },
                { key: "AD_OUTSTREAM", label: "Outstream" },
                { key: "AD_TRAFFIC", label: "Traffic (Native)" },
                { key: "AD_VIDEO", label: "Video (Native)" },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200"
                >
                  <Label htmlFor={key}>
                    {label}
                  </Label>
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${
                      formData.contents[key] ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    <Switch
                      id={key}
                      checked={formData.contents[key]}
                      onCheckedChange={(checked) => handleContentsChange(key, checked)}
                      disabled={loading}
                      className={
                        formData.contents[key]
                          ? "data-[state=checked]:bg-green-600"
                          : "data-[state=unchecked]:bg-red-500"
                      }
                    />
                    <span
                      className={`text-xs font-semibold ${
                        formData.contents[key] ? "text-green-800" : "text-red-800"
                      }`}
                    >
                      {formData.contents[key] ? "ON" : "OFF"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </EntityEditorLayout>
  );
}
