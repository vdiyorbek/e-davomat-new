import type { TFunction } from "i18next";

import type { SelectOption } from "@/components/common/SelectField";

export type MembershipSelectKey =
  | "educationLanguage"
  | "educationForm"
  | "employmentType"
  | "qualificationCategory"
  | "educationLevel";

/** Tanlov maydonlarining backend qiymatlari. Matnlar `memberDetails.options.*` da. */
export const MEMBERSHIP_OPTIONS: Record<MembershipSelectKey, string[]> = {
  educationLanguage: ["UZ", "RU", "KK", "TJ", "EN", "OTHER"],
  educationForm: ["FULL_TIME", "EVENING", "PART_TIME", "DISTANCE", "DUAL"],
  employmentType: ["PRIMARY", "PART_TIME", "HOURLY", "TEMPORARY"],
  qualificationCategory: ["OLIY", "BIRINCHI", "IKKINCHI", "MUTAXASSIS", "TOIFASIZ"],
  educationLevel: ["SECONDARY", "SECONDARY_SPECIAL", "BACHELOR", "MASTER", "PHD", "DSC"],
};

export function membershipOptions(
  key: MembershipSelectKey,
  currentValue: string,
  t: TFunction,
): SelectOption[] {
  const options = MEMBERSHIP_OPTIONS[key].map((value) => ({
    value,
    label: t(`memberDetails.options.${key}.${value}`),
  }));

  // Bazada oldindan saqlangan, ro‘yxatda yo‘q qiymatlar o‘chib ketmasligi uchun.
  if (currentValue && !MEMBERSHIP_OPTIONS[key].includes(currentValue)) {
    return [
      { value: currentValue, label: t("memberDetails.legacyValue", { value: currentValue }) },
      ...options,
    ];
  }

  return options;
}
