
import type { UserRole } from '@/types/auth';

export interface UsersFilterValues {
    search: string;
    role: UserRole | '';
    isActive: '' | 'true' | 'false';
    regionId: string;
    districtId: string;
    schoolId: string;
}

interface Props {
    value: UsersFilterValues;
    onChange: (value: UsersFilterValues) => void;
    onReset: () => void;
}

const fieldClass =
    'w-full min-w-0 rounded-xl border bg-background px-3 py-2.5 text-sm';

export function UsersFilters({
    value,
    onChange,
    onReset,
}: Props) {
    function change<K extends keyof UsersFilterValues>(
        key: K,
        next: UsersFilterValues[K],
    ) {
        onChange({ ...value, [key]: next });
    }

    return (
        <div className="space-y-4 rounded-2xl border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                    <label htmlFor="filter-search" className="text-sm">
                        Ф.И.Ш. ёки логин
                    </label>
                    <input
                        id="filter-search"
                        className={fieldClass}
                        value={value.search}
                        maxLength={100}
                        placeholder="Қидириш..."
                        onChange={(e) =>
                            change('search', e.target.value)
                        }
                    />
                </div>

                <div className="space-y-1">
                    <label htmlFor="filter-role" className="text-sm">
                        Рол
                    </label>
                    <select
                        id="filter-role"
                        className={fieldClass}
                        value={value.role}
                        onChange={(e) =>
                            change('role', e.target.value as UsersFilterValues['role'])
                        }
                    >
                        <option value="">Барча роллар</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        <option value="REGION_ADMIN">REGION_ADMIN</option>
                        <option value="DISTRICT_ADMIN">DISTRICT_ADMIN</option>
                        <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
                        <option value="USER">USER</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="filter-status" className="text-sm">
                        Ҳолат
                    </label>
                    <select
                        id="filter-status"
                        className={fieldClass}
                        value={value.isActive}
                        onChange={(e) =>
                            change(
                                'isActive',
                                e.target.value as UsersFilterValues['isActive'],
                            )
                        }
                    >
                        <option value="">Барча ҳолатлар</option>
                        <option value="true">Фаол</option>
                        <option value="false">Блокланган</option>
                    </select>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                    onClick={onReset}
                >
                    Фильтрларни тозалаш
                </button>
            </div>
        </div>
    );
}
