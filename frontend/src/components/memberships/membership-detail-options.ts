import type { SelectOption } from "@/components/common/SelectField";

export type MembershipSelectKey =
  | "educationLanguage"
  | "educationForm"
  | "employmentType"
  | "qualificationCategory"
  | "educationLevel";

export const MEMBERSHIP_OPTIONS: Record<MembershipSelectKey, SelectOption[]> = {
  educationLanguage: [
    { value: "UZ", label: "O‘zbek tili" },
    { value: "RU", label: "Rus tili" },
    { value: "KK", label: "Qoraqalpoq tili" },
    { value: "TJ", label: "Tojik tili" },
    { value: "EN", label: "Ingliz tili" },
    { value: "OTHER", label: "Boshqa" },
  ],

  educationForm: [
    { value: "FULL_TIME", label: "Kunduzgi" },
    { value: "EVENING", label: "Kechki" },
    { value: "PART_TIME", label: "Sirtqi" },
    { value: "DISTANCE", label: "Masofaviy" },
    { value: "DUAL", label: "Dual ta’lim" },
  ],

  employmentType: [
    { value: "PRIMARY", label: "Asosiy ish joyi" },
    { value: "PART_TIME", label: "O‘rindoshlik" },
    { value: "HOURLY", label: "Soatbay" },
    { value: "TEMPORARY", label: "Vaqtincha" },
  ],

  qualificationCategory: [
    { value: "OLIY", label: "Oliy toifa" },
    { value: "BIRINCHI", label: "Birinchi toifa" },
    { value: "IKKINCHI", label: "Ikkinchi toifa" },
    { value: "MUTAXASSIS", label: "Mutaxassis" },
    { value: "TOIFASIZ", label: "Toifasiz" },
  ],

  educationLevel: [
    { value: "SECONDARY", label: "O‘rta" },
    {
      value: "SECONDARY_SPECIAL",
      label: "O‘rta maxsus",
    },
    { value: "BACHELOR", label: "Bakalavr" },
    { value: "MASTER", label: "Magistr" },
    {
      value: "PHD",
      label: "Falsafa doktori (PhD)",
    },
    {
      value: "DSC",
      label: "Fan doktori (DSc)",
    },
  ],
};

export function membershipOptions(
  key: MembershipSelectKey,
  currentValue: string,
): SelectOption[] {
  const options = MEMBERSHIP_OPTIONS[key];

  // Bazada oldindan saqlangan qiymatlar
  // avtomatik o‘chib ketmasligi uchun.
  if (
    currentValue &&
    !options.some((option) => option.value === currentValue)
  ) {
    return [
      {
        value: currentValue,
        label: `${currentValue} (avvalgi qiymat)`,
      },
      ...options,
    ];
  }

  return options;
}
