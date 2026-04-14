import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from '@/config/theme';

const EntityEditorLayout = ({
  backAction,
  sections = [],
  selectedSection,
  onSectionSelect,
  sectionCardTitle = "Sections",
  sidebarFooter,
  sidebarExtra,
  header,
  alerts = [],
  className,
  children,
}) => {
  return (
    <div className={cn("min-h-screen bg-white", className)}>
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        {backAction && (
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={backAction.onClick}
              className="flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              {backAction.icon || <ArrowLeft className="w-4 h-4" />}
              {backAction.label}
            </Button>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-6">
              {sections.length > 0 && (
                <Card className="border-slate-200 shadow-sm border-[rgb(220,227,255)]/90 overflow-hidden">
                  <CardHeader
                    className={cn(
                      TAILWIND_CLASSES.editSidebarSectionHeader,
                      "p-4"
                    )}
                  >
                    <CardTitle className={TAILWIND_CLASSES.editSidebarSectionTitle}>
                      {sectionCardTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent
                    className={cn(
                      "space-y-1 px-4 pb-4 pt-[20px]"
                    )}
                  >
                    {sections.map((section) => (
                      <Button
                        key={section.id}
                        variant="ghost"
                        disabled={section.disabled}
                        className={cn(
                          "w-full justify-start h-8 text-xs",
                          section.disabled
                            ? "text-slate-400 cursor-not-allowed opacity-60"
                            : selectedSection === section.id
                            ? `${TAILWIND_CLASSES.primaryBgLight} ${TAILWIND_CLASSES.primaryText}`
                            : "text-slate-700 hover:bg-slate-50"
                        )}
                        onClick={() => !section.disabled && onSectionSelect && onSectionSelect(section.id)}
                      >
                        <div className="flex items-center gap-2">
                          {section.icon}
                          {section.label}
                        </div>
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {sidebarFooter}
              {sidebarExtra}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {header}
            {alerts.map((alertNode, index) =>
              alertNode ? <React.Fragment key={index}>{alertNode}</React.Fragment> : null
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityEditorLayout;
