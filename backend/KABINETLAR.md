# O‘qituvchi va o‘quvchi kabinetlari, CHSB/BSB testlari

`yarn migration:run` — `teacher_class_subjects.weeklyHours` ustuni hamda
`assessments`, `assessment_questions`, `assessment_attempts` jadvallarini qo‘shadi.
Yangi kutubxona: `pdf-lib` (`yarn install`).

## Jarayon

1. **Maktab administratori** — *Dars jadvali → O‘qituvchilar yuklamasi*: har fan-sinf uchun
   o‘quv rejasidagi haftalik soatni kiritadi; jadvalga qo‘yilgan darslar bilan solishtiriladi
   (yetishmaydi / ortiqcha, hafta kunlari bo‘yicha taqsimot).
2. **O‘qituvchi** — kabinetda *Bugungi darslar*: hozirgi dars ajralib turadi, bir bosishda
   jurnal yozuvi ochiladi va o‘sha fan/sinf darajasidagi tasdiqlangan darslikdan mavzu tanlanadi
   (*Kitobni ko‘rish* — PDF aynan mavzu sahifasida ochiladi). *Haftalik jadvalim* — butun hafta.
3. **CHSB / BSB** — o‘qituvchi mavzularni tanlaydi (CHSB: darsda o‘tilganlar bir bosishda;
   BSB: bitta bob), AI darslikning faqat shu mavzular sahifalarini (≤60 sahifa) o‘qib test tuzadi.
   O‘qituvchi har savolni tekshiradi/tahrirlaydi, so‘ng vaqt oynasi bilan nashr qiladi yoki chop etadi
   (o‘quvchi nusxasi va javob kaliti bilan).
4. **O‘quvchi** — *Mening kunim* (bugungi darslar va mavzular, uy vazifasi, davomat, ochiq testlar),
   *Dars jadvalim*, *Davomatim*, *Testlarim*: taymer bilan onlayn topshirish, javoblar avtomatik
   saqlanadi, vaqt tugasa o‘zi topshiriladi.

## Xavfsizlik va adolat

* To‘g‘ri javoblar o‘quvchiga test oynasi yopilmaguncha yuborilmaydi.
* Har o‘quvchiga savollar o‘z tartibida; AI variantlari server tomonda aralashtiriladi.
* Har o‘quvchiga bitta urinish (DB unique), muddat server soati bo‘yicha.
* O‘qituvchi faqat o‘z fan-sinf biriktirmalari va o‘z fanidagi darslikni ko‘radi.

## Baholash shkalasi

`src/modules/assessments/grading.ts`: 86%+ → 5, 71% → 4, 56% → 3, aks holda 2.
Maktabingiz boshqa shkala ishlatsa — shu faylni o‘zgartiring.

## `.env`

| O‘zgaruvchi | Standart | Izoh |
|---|---|---|
| `GEMINI_API_KEY`, `GEMINI_MODEL` | — | Mavjud sozlama ishlatiladi |
| `AI_TESTS_DAILY_LIMIT` | 20 | Bir o‘qituvchi kuniga nechta AI test yarata oladi |
| `AI_TESTS_CONCURRENCY` | 3 | Bir jarayonda parallel generatsiyalar |
