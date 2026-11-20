export type SettingGroup = "photos" | "push" | "lag" | "live" | "calendar";

export interface SystemSetting {
  key: string;
  group: SettingGroup;
  type: "int" | "bool";
  min: number | null;
  max: number | null;
  unit: "seconds" | "minutes" | "days" | "count" | "grade" | null;
  default: number | boolean;
  value: number | boolean;
  overridden: boolean;
  updatedAt: string | null;
  updatedBy: { login: string; name: string | null } | null;
}

export interface SystemSettingHistory {
  id: string;
  key: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedBy: { login: string; name: string | null } | null;
}
