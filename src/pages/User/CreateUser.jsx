/**
 * Create User Page
 * Same layout and colors as EditUser: EntityEditorLayout, header banner, sidebar, blue card headers.
 * Mandatory: Title, First name, Last name, Email, Rank, Realm, Company. DateFormat defaults to %m/%d/%y.
 * Confirmation dialog before create; redirect to UserManagement on success.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Plus, Loader2, AlertCircle, CheckCircle, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS } from "@/config/api";
import EntityEditorLayout from "@/components/layouts/EntityEditorLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const RANK_OPTIONS = [
  { value: "USER", label: "User" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPERADMIN", label: "Super Admin" },
  { value: "DISABLED", label: "Disabled" },
];

const TITLE_OPTIONS = [
  { value: "Mr.", api: "MR" },
  { value: "Mrs.", api: "MRS" },
  { value: "OTHER", api: "OTHER" },
];

export default function CreateUser() {
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [title, setTitle] = useState("Mr.");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [rank, setRank] = useState("USER");
  const [realm, setRealm] = useState("");
  const [company, setCompany] = useState("");

  const [realmList, setRealmList] = useState([]);
  const [companyList, setCompanyList] = useState([]);
  const [loadingRealms, setLoadingRealms] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedSection, setSelectedSection] = useState("basic");

  const fetchRealms = async () => {
    setLoadingRealms(true);
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(API_ENDPOINTS.REALMS_SEARCH, {
        method: "POST",
        headers: { "x-ayl-auth-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({
          From: 0,
          Size: 500,
          Order: [{ Field: "UpdatedAt", Operator: "desc" }],
        }),
      });
      if (!response.ok) return;
      const data = await response.json();
      const raw = Array.isArray(data?.Data) ? data.Data : [];
      setRealmList(raw.map((r) => ({ uid: r.uid ?? r.Uid, name: r.name ?? r.Name ?? r.uid ?? r.Uid })));
    } catch {
      setRealmList([]);
    } finally {
      setLoadingRealms(false);
    }
  };

  const fetchCompanies = async (realmUid) => {
    setLoadingCompanies(true);
    try {
      const token = getToken();
      if (!token) return;
      const body = {
        From: 0,
        Size: 500,
        Order: [{ Field: "Name", Operator: "asc" }],
      };
      if (realmUid && realmUid.trim()) {
        body.Filters = [{ Field: "Realm_uid", Operator: "match", Value: realmUid.trim() }];
      }
      const response = await fetch(API_ENDPOINTS.COMPANIES_SEARCH, {
        method: "POST",
        headers: { "x-ayl-auth-token": token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) return;
      const data = await response.json();
      const raw = Array.isArray(data?.Data) ? data.Data : [];
      setCompanyList(raw.map((c) => ({ uid: c.uid ?? c.Uid, name: c.name ?? c.Name ?? c.uid ?? c.Uid })));
    } catch {
      setCompanyList([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    fetchRealms();
  }, []);

  useEffect(() => {
    fetchCompanies(realm);
  }, [realm]);

  const titleToApi = (t) => {
    const opt = TITLE_OPTIONS.find((o) => o.value === t);
    return opt ? opt.api : "MR";
  };

  const handleCreateClick = () => {
    const first = (firstName || "").trim();
    const last = (lastName || "").trim();
    const em = (email || "").trim();
    if (!first || !last || !em || !realm || !company) {
      setError("Title, First name, Last name, Email, Realm and Company are required.");
      return;
    }
    setError(null);
    setShowConfirm(true);
  };

  const handleConfirmCreate = async () => {
    const first = (firstName || "").trim();
    const last = (lastName || "").trim();
    const em = (email || "").trim();
    const name = `${first} ${last}`.trim();

    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");

      const payload = {
        Data: {
          Company: company,
          Email: em,
          FirstName: first,
          LastName: last,
          Name: name,
          Picture: null,
          Preferences: { DateFormat: "%m/%d/%y", Dashboard: {} },
          Rank: rank,
          Realm: realm,
          Tags: [],
          Title: titleToApi(title),
          Visibility: 0,
          Password: "",
          PasswordConfirmation: "",
        },
        Version: 10,
      };

      const response = await fetch(API_ENDPOINTS.USERS, {
        method: "POST",
        headers: { "x-ayl-auth-token": token, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.Message || err.error || `HTTP ${response.status}`);
      }

      setShowConfirm(false);
      setSuccess(true);
      setTimeout(() => navigate("/UserManagement"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    (firstName || "").trim() &&
    (lastName || "").trim() &&
    (email || "").trim() &&
    realm &&
    company;

  const sections = [
    { id: "basic", label: "Basic Info", icon: <User className="w-4 h-4" /> },
  ];

  return (
    <>
      <EntityEditorLayout
        sections={sections}
        selectedSection={selectedSection}
        onSectionSelect={setSelectedSection}
        sectionCardTitle="User"
        sidebarFooter={
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <Button
                onClick={handleCreateClick}
                disabled={loading || !canSubmit}
                className="w-full bg-slate-600 hover:bg-slate-700 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {loading ? "Creating..." : "Create User"}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/UserManagement")}
                className="w-full hover:bg-slate-50 hover:border-slate-300"
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
                  <div className="w-14 h-14 rounded-xl bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] flex items-center justify-center">
                    <User className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-2xl font-semibold text-slate-900 leading-tight">Create New User</h1>
                    <p className="text-sm text-slate-500">Add a new user. A confirmation email will be sent to set up their password.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] border border-[rgb(59,76,164)]/20">
                    Rank: {rank}
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
                User created successfully! Redirecting to User Management...
              </AlertDescription>
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
                  <Label htmlFor="firstName">First name <span className="text-red-500">*</span></Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={loading}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name <span className="text-red-500">*</span></Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading}
                    className="bg-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="bg-white"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Title <span className="text-red-500">*</span></Label>
                  <Select value={title} onValueChange={setTitle} disabled={loading}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TITLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.value === "OTHER" ? "Other" : o.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rank <span className="text-red-500">*</span></Label>
                  <Select value={rank} onValueChange={setRank} disabled={loading}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RANK_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Realm <span className="text-red-500">*</span></Label>
                <Select
                  value={realm}
                  onValueChange={(v) => {
                    setRealm(v);
                    setCompany("");
                  }}
                  disabled={loading || loadingRealms}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={loadingRealms ? "Loading…" : "Select realm"} />
                  </SelectTrigger>
                  <SelectContent>
                    {realmList.map((r) => (
                      <SelectItem key={r.uid} value={r.uid}>{r.name || r.uid}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Company <span className="text-red-500">*</span></Label>
                <Select
                  value={company}
                  onValueChange={setCompany}
                  disabled={loading || loadingCompanies || !realm}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={!realm ? "Select realm first" : loadingCompanies ? "Loading…" : "Select company"} />
                  </SelectTrigger>
                  <SelectContent>
                    {companyList.map((c) => (
                      <SelectItem key={c.uid} value={c.uid}>{c.name || c.uid}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
      </EntityEditorLayout>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm user creation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>You&apos;re about to create a new User.</p>
                <p>A confirmation email will be sent to this address:</p>
                <p className="font-medium text-slate-900">{email.trim()}</p>
                <p>with further instructions for this user to access the DNA and set up their password and account informations.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCreate();
              }}
              disabled={loading}
              className="bg-slate-600 hover:bg-slate-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
