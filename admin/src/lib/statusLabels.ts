import { currentMessages } from "@/i18n";

type LabelGroup = keyof ReturnType<typeof currentMessages>["labels"];

// 从 labels.<group>.<key> 取当前语言文案；未知值原样返回
function label(group: LabelGroup, key: string): string {
  const map = currentMessages().labels[group] as Record<string, string>;
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : key;
}

/** Project pipeline status keys (API values) */
export const PROJECT_STATUSES = [
  "DRAFT",
  "SCRIPTING",
  "SCRIPT_READY",
  "IMAGING",
  "IMAGE_READY",
  "VIDEOING",
  "VIDEO_READY",
  "AUDIOING",
  "COMPOSING",
  "AUDITING",
  "DONE",
  "REJECTED",
  "FAILED",
  "CANCELLED",
] as const;

// Resolve project status display text
export function projectStatusLabel(status: string): string {
  return label("projectStatus", status);
}

// Resolve order status display text
export function orderStatusLabel(status: string): string {
  return label("orderStatus", status);
}

// Resolve audit status display text
export function auditStatusLabel(status: string): string {
  return label("auditStatus", status);
}

// Resolve visibility display text
export function visibilityLabel(status: string): string {
  return label("visibility", status);
}

// Resolve ledger kind display text
export function ledgerKindLabel(kind: string): string {
  return label("ledgerKind", kind);
}

// Resolve pay type display text
export function payTypeLabel(payType: string): string {
  return label("payType", payType);
}

// Resolve task status display text
export function taskStatusLabel(status: string): string {
  return label("taskStatus", status);
}

// Resolve task domain display text
export function taskDomainLabel(domain: string): string {
  return label("taskDomain", domain);
}

// Resolve task type display text
export function taskTypeLabel(taskType: string): string {
  return label("taskType", taskType);
}

/** Filter options for project status select (value stays English for API) */
export function projectStatusOptions(): { value: string; label: string }[] {
  return [
    { value: "", label: currentMessages().labels.allStatuses },
    ...PROJECT_STATUSES.map((value) => ({ value, label: projectStatusLabel(value) })),
  ];
}

// Drama generation / asset type labels (see dramaLabels.ts)
export function dramaGenerationLabel(status: string): string {
  return label("dramaGeneration", status);
}

export function dramaAssetTypeText(type: string): string {
  return label("dramaAssetType", type);
}
