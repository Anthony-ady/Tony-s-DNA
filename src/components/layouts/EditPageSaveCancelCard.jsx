/* eslint-disable react/prop-types */
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, X } from "lucide-react";

/**
 * Standard sidebar actions for entity editor layouts: primary Save + outline Cancel.
 */
export function EditPageSaveCancelCard({
  onSave,
  onCancel,
  saving = false,
  /** When true, Save is disabled (e.g. no pending changes) */
  saveDisabled = false,
  saveLabel = "Save Changes",
  savingLabel = "Saving…",
  cancelLabel = "Cancel",
}) {
  return (
    <Card className="border-slate-200 shadow-sm border-[rgb(220,227,255)]/90 overflow-hidden">
      <CardContent className="p-4 space-y-2">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving || saveDisabled}
          className={cn(TAILWIND_CLASSES.editPrimaryButton)}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? savingLabel : saveLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className={cn(TAILWIND_CLASSES.editCancelButton)}
        >
          <X className="w-4 h-4 mr-2" />
          {cancelLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export default EditPageSaveCancelCard;
