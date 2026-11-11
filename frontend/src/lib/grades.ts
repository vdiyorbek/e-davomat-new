import { useTranslation } from "react-i18next";

export const GRADES = Array.from({ length: 12 }, (_, index) =>
  String(index + 1),
);

export function useGradeOptions() {
  const { t } = useTranslation();
  return GRADES.map((grade) => ({
    value: grade,
    label: t("calendar.gradeN", { grade }),
  }));
}
