import { useEffect, useId, useState } from 'react';

import { authorizedGet } from '@/lib/auth-session';

export interface ResidenceValue {
  regionId: number | null;
  districtId: number | null;
  mahallaId: number | null;
}

interface Option {
  id: number;
  name: string;
}

interface MahallasPage {
  data: Option[];
  totalPages: number;
}

interface OptionsState {
  path: string | null;
  items: Option[];
  loading: boolean;
  error: string;
}

function useAddressOptions(
  path: string | null,
  paginated = false,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<OptionsState>({
    path: null,
    items: [],
    loading: false,
    error: '',
  });

  useEffect(() => {
    if (!path) return;

    const controller = new AbortController();

    setState({
      path,
      items: [],
      loading: true,
      error: '',
    });

    async function load(): Promise<Option[]> {
      if (!paginated) {
        return authorizedGet<Option[]>(
          path!,
          controller.signal,
        );
      }

      const items: Option[] = [];
      let page = 1;

      while (!controller.signal.aborted) {
        const result = await authorizedGet<MahallasPage>(
          `${path}&page=${page}&limit=100`,
          controller.signal,
        );

        items.push(...result.data);

        if (page >= result.totalPages) break;
        page += 1;
      }

      return items;
    }

    void load()
      .then((items) => {
        if (controller.signal.aborted) return;

        setState({
          path,
          items,
          loading: false,
          error: '',
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        setState({
          path,
          items: [],
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Ro‘yxatni yuklab bo‘lmadi',
        });
      });

    return () => controller.abort();
  }, [path, paginated, attempt]);

  // Avvalgi hududning ro‘yxatini yangi tanlovda ko‘rsatmaymiz.
  const current =
    path !== null && state.path === path
      ? state
      : {
          items: [],
          loading: path !== null,
          error: '',
        };

  return {
    ...current,
    retry: () => setAttempt((value) => value + 1),
  };
}

interface AddressSelectProps {
  label: string;
  placeholder: string;
  value: number | null;
  options: ReturnType<typeof useAddressOptions>;
  disabled: boolean;
  onChange: (value: number | null) => void;
}

function AddressSelect({
  label,
  placeholder,
  value,
  options,
  disabled,
  onChange,
}: AddressSelectProps) {
  const id = useId();

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>

      <select
        id={id}
        value={value ?? ''}
        disabled={disabled || options.loading || !!options.error}
        onChange={(event) =>
          onChange(
            event.target.value === ''
              ? null
              : Number(event.target.value),
          )
        }
        className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">
          {options.loading ? 'Yuklanmoqda…' : placeholder}
        </option>

        {options.items.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>

      {options.error && (
        <div className="space-y-1">
          <p role="alert" className="text-xs text-destructive">
            {options.error}
          </p>

          <button
            type="button"
            disabled={disabled}
            onClick={options.retry}
            className="text-xs underline disabled:opacity-50"
          >
            Qayta urinish
          </button>
        </div>
      )}
    </div>
  );
}

interface ResidenceFieldsProps {
  value: ResidenceValue;
  onChange: (value: ResidenceValue) => void;
  disabled?: boolean;
}

export function ResidenceFields({
  value,
  onChange,
  disabled = false,
}: ResidenceFieldsProps) {
  const regions = useAddressOptions('/regions/options');

  const districts = useAddressOptions(
    value.regionId
      ? `/districts/options?regionId=${value.regionId}`
      : null,
  );

  const mahallas = useAddressOptions(
    value.districtId
      ? `/mahallas/options?districtId=${value.districtId}`
      : null,
    true,
  );

  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-3 text-sm font-semibold">
        Yashash hududi
      </legend>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AddressSelect
          label="Viloyat"
          placeholder="Viloyatni tanlang"
          value={value.regionId}
          options={regions}
          disabled={disabled}
          onChange={(regionId) =>
            onChange({
              regionId,
              districtId: null,
              mahallaId: null,
            })
          }
        />

        <AddressSelect
          label="Tuman yoki shahar"
          placeholder="Tumanni tanlang"
          value={value.districtId}
          options={districts}
          disabled={disabled || !value.regionId}
          onChange={(districtId) =>
            onChange({
              ...value,
              districtId,
              mahallaId: null,
            })
          }
        />

        <AddressSelect
          label="Mahalla"
          placeholder="Mahallani tanlang"
          value={value.mahallaId}
          options={mahallas}
          disabled={disabled || !value.districtId}
          onChange={(mahallaId) =>
            onChange({
              ...value,
              mahallaId,
            })
          }
        />
      </div>
    </fieldset>
  );
}