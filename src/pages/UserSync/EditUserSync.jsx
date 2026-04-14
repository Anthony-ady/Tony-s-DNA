import { useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, Link2, Type, Shield, Radio, ListOrdered } from "lucide-react";
import { EditEntityPageLayout } from "@/components/layouts/EditEntityPageLayout";
import { UserSyncPanel } from "./UserSync";

const sections = [
  { id: "basic", label: "General info", icon: <Type className="w-4 h-4" /> },
  { id: "privacy", label: "Privacy", icon: <Shield className="w-4 h-4" /> },
  { id: "endpoints", label: "Endpoints", icon: <Radio className="w-4 h-4" /> },
  { id: "parameters", label: "Parameters", icon: <ListOrdered className="w-4 h-4" /> },
];

export default function EditUserSync() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uid = searchParams.get("id");
  const nameFromUrl = searchParams.get("name");

  const [activeSection, setActiveSection] = useState("basic");
  const [editor, setEditor] = useState({
    hasPending: false,
    saving: false,
    save: async () => {},
  });

  const onStatusChange = useCallback((s) => {
    setEditor(s);
  }, []);

  const displayName = nameFromUrl?.trim() ? decodeURIComponent(nameFromUrl) : "User sync";
  const truncatedName =
    displayName.length > 42 ? `${displayName.slice(0, 42)}…` : displayName;

  if (!uid) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No user sync selected</h2>
          <p className="text-slate-600 mb-4">Open a user sync from the list to edit it.</p>
          <Button variant="outline" onClick={() => navigate("/UserSyncManagement")}>
            Back to User Syncs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <EditEntityPageLayout
      sections={sections}
      selectedSection={activeSection}
      onSectionSelect={setActiveSection}
      sectionCardTitle="General Parameters"
      headerIcon={<Link2 className="w-7 h-7" />}
      title={truncatedName}
      titleTooltip={displayName}
      subtitle="Edit user sync configuration"
      onSave={() => editor.save()}
      onCancel={() => navigate("/UserSyncManagement")}
      saving={editor.saving}
      saveDisabled={!editor.hasPending}
    >
      <UserSyncPanel
        uid={uid}
        nameFromUrl={nameFromUrl}
        embedded={false}
        activeSection={activeSection}
        onStatusChange={onStatusChange}
      />
    </EditEntityPageLayout>
  );
}
