/* eslint-disable react/prop-types */
import EntityEditorLayout from "@/components/layouts/EntityEditorLayout";
import { EditPageHeaderBanner } from "@/components/layouts/EditPageHeaderBanner";
import { EditPageSaveCancelCard } from "@/components/layouts/EditPageSaveCancelCard";

/**
 * Opinionated template: EntityEditorLayout + standard “General Parameters” sidebar,
 * gradient header banner, and Save / Cancel card. Pass form content as children.
 *
 * For pages that only need the building blocks, import {@link EditPageHeaderBanner}
 * and {@link EditPageSaveCancelCard} directly with {@link EntityEditorLayout}.
 */
export function EditEntityPageLayout({
  sections = [],
  selectedSection,
  onSectionSelect,
  sectionCardTitle = "General Parameters",
  headerIcon,
  title,
  subtitle,
  titleTooltip,
  headerTrailing,
  headerChildren,
  onSave,
  onCancel,
  saving = false,
  saveDisabled = false,
  backAction,
  sidebarExtra,
  alerts = [],
  className,
  children,
}) {
  return (
    <EntityEditorLayout
      className={className}
      backAction={backAction}
      sections={sections}
      selectedSection={selectedSection}
      onSectionSelect={onSectionSelect}
      sectionCardTitle={sectionCardTitle}
      sidebarFooter={
        <EditPageSaveCancelCard
          onSave={onSave}
          onCancel={onCancel}
          saving={saving}
          saveDisabled={saveDisabled}
        />
      }
      sidebarExtra={sidebarExtra}
      alerts={alerts}
      header={
        <EditPageHeaderBanner
          icon={headerIcon}
          title={title}
          subtitle={subtitle}
          titleTooltip={titleTooltip}
          trailing={headerTrailing}
        >
          {headerChildren}
        </EditPageHeaderBanner>
      }
    >
      {children}
    </EntityEditorLayout>
  );
}

export default EditEntityPageLayout;
