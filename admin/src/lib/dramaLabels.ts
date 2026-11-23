import { dramaAssetTypeText, dramaGenerationLabel } from "@/lib/statusLabels";

/** 漫剧资产生成状态（与 params.generation.status 一致） */
export const DRAMA_GENERATION_STATUSES = [
  "queued",
  "running",
  "generating",
  "done",
  "failed",
  "cancelled",
] as const;

/** 漫剧生成状态标签（idle 仅用于分镜等无 params.generation 时的展示回退） */
export function dramaGenerationStatusLabel(status: string): string {
  return dramaGenerationLabel(status);
}

/** 列表/详情展示：空值显示 — */
export function formatDramaGenerationStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return dramaGenerationStatusLabel(status);
}

/** 漫剧资产类型标签 */
export function dramaAssetTypeLabel(type: string): string {
  return dramaAssetTypeText(type);
}
