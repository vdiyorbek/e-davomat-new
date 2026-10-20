import type { School } from '@/types/school';
import type { SelectOption } from '@/components/common/SelectField';

function unique(items: { id: number; name: string }[]): SelectOption[] {
    return Array.from(new Map(items.map((item) => [item.id, item])).values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({ value: String(item.id), label: item.name, keywords: item.name }));
}

/**
 * Ruxsat berilgan maktablar ro‘yxatidan viloyat → tuman → maktab
 * kaskad filtrlari uchun variantlarni hisoblaydi.
 */
export function schoolScopeOptions(
    schools: School[] | null | undefined,
    regionId: string,
    districtId: string,
) {
    const list = schools ?? [];

    const regions = unique(list.map((school) => school.district.region));

    const inRegion = list.filter(
        (school) => !regionId || String(school.district.region.id) === regionId,
    );
    const districts = unique(inRegion.map((school) => school.district));

    const schoolOptions = inRegion
        .filter((school) => !districtId || String(school.districtId) === districtId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((school) => ({
            value: String(school.id),
            label: school.name,
            keywords: `${school.name} ${school.district.name}`,
        }));

    return { regions, districts, schools: schoolOptions };
}
