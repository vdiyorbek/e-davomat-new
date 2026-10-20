# E-davomat — frontend

React 19 + Vite + TypeScript, **shadcn/ui** (radix-nova) va **Tailwind CSS v4**, **i18next** orqali 4 tilli.

## Ishga tushirish

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build
```

`VITE_API_URL` — backend manzili (standart: `http://localhost:3000/api`). Logotip `public/logotip.jpg` dan olinadi (topilmasa, ikonka chiqadi).

## Tillar (i18n)

| Kod       | Til                         |
|-----------|-----------------------------|
| `uz`      | O‘zbekcha (lotin) — asosiy  |
| `uz-Cyrl` | Ўзбекча (кирилл)            |
| `ru`      | Русский                     |
| `en`      | English                     |

- Tarjimalar: `src/i18n/locales/<til>/<bo‘lim>.json`. Fayl nomi kalitning birinchi qismi bo‘ladi: `attendance.json` → `t('attendance.title')`.
- Har bir til alohida yuklanadi (lazy), ya’ni foydalanuvchi faqat o‘z tilini yuklab oladi.
- Yangi matn qo‘shganda **to‘rtala** papkaga bir xil kalitni qo‘shing.
- Sana va vaqt: `src/lib/date.ts` (`formatDate`, `formatTime`, `formatDateLong`). Oy va hafta kuni nomlari tilga mos, vaqtlar Toshkent bo‘yicha.
- Backenddan keladigan fan nomlari: `localizedName()`. `nameRu`/`nameEn` bo‘lsa, shular olinadi; kirill uchun avtomatik transliteratsiya qilinadi.
- API so‘rovlariga `Accept-Language` sarlavhasi qo‘shiladi, shuning uchun backend xabarlarini ham tarjima qilish mumkin.

## Moslashuvchan dizayn

- **Telefon (<768px):** yuqori sarlavha, pastki navigatsiya paneli va chiquvchi menyu. Ro‘yxatlar kartalar ko‘rinishida.
- **Planshet (768–1023px):** tor ikonka paneli; ☰ tugmasi to‘liq menyuni ochadi. Ro‘yxatlar 2 ustunli kartalar ko‘rinishida.
- **Kompyuter (≥1024px):** to‘liq yon panel; ≥1280px da jadvallar.
- Formalar dialog oynalarda ochiladi (telefonda ichi aylanadi).

## Umumiy komponentlar (`src/components/common`)

`PageHeader`, `Field`, `SelectField` (12 tadan ko‘p variant bo‘lsa, avtomatik qidiruvli bo‘ladi), `FileInput`, `Pagination`,
`StatusBadge`, `LoadingState` / `ErrorState` / `EmptyState` / `SuccessNotice`, `useConfirm` (AlertDialog),
`DetailList`, `LanguageSwitcher`, `ThemeToggle`. Menyu bitta manbadan olinadi: `src/layouts/nav-config.ts`.
