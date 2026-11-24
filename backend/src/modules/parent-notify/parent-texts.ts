export const PARENT_LANGUAGES = [
  'uz',
  'uz-Cyrl',
  'ru',
  'en',
  'kk',
  'ky',
  'tg',
] as const;
export type ParentLanguage = (typeof PARENT_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<ParentLanguage, string> = {
  uz: 'O‘zbekcha',
  'uz-Cyrl': 'Ўзбекча',
  ru: 'Русский',
  en: 'English',
  kk: 'Қазақша',
  ky: 'Кыргызча',
  tg: 'Тоҷикӣ',
};

export function isParentLanguage(value: unknown): value is ParentLanguage {
  return (
    typeof value === 'string' &&
    (PARENT_LANGUAGES as readonly string[]).includes(value)
  );
}

export interface BotTexts {
  askContact: string;
  shareButton: string;
  notYourContact: string;
  notFound: string;
  linked: string;
  openApp: string;
  settingsTitle: string;
  arrival: string;
  leave: string;
  absent: string;
  excuse: string;
  langChanged: string;
  help: string;
  needLink: string;
  arrived: string;
  left: string;
  absentMsg: string;
  excuseApproved: string;
  excuseRejected: string;
  reason: string;
}

export const TEXTS: Record<ParentLanguage, BotTexts> = {
  uz: {
    askContact:
      'Farzandingizni ulash uchun telefon raqamingizni ulashing. Raqam maktabda ro‘yxatdan o‘tgan ota-ona raqami bilan bir xil bo‘lishi kerak.',
    shareButton: '📱 Raqamni ulashish',
    notYourContact:
      'Iltimos, o‘zingizning raqamingizni pastdagi tugma orqali ulashing.',
    notFound:
      'Bu raqam bo‘yicha farzand topilmadi. Maktabda ota-ona telefoni to‘g‘ri kiritilganini tekshirtiring.',
    linked:
      'Ulandi! Farzandlaringiz:\n{{children}}\n\nXabarlar shu yerga keladi. Davomat tarixini ilovada ko‘rishingiz mumkin.',
    openApp: '📊 Davomatni ochish',
    settingsTitle: 'Xabarnoma sozlamalari (bosib yoqing/o‘chiring):',
    arrival: 'Maktabga keldi',
    leave: 'Maktabdan chiqdi',
    absent: 'Kelmadi',
    excuse: 'Ariza natijasi',
    langChanged: 'Til o‘zgartirildi.',
    help: '/settings — xabarnomalar\n/lang — til\n/app — davomat ilovasi',
    needLink: 'Avval telefon raqamingizni ulang: /start',
    arrived: '✅ {{name}} maktabga keldi ({{time}})',
    left: '🏠 {{name}} maktabdan chiqdi ({{time}})',
    absentMsg:
      '⚠️ {{name}} bugun maktabga kelmadi (dars {{start}} da boshlangan). Sababi bo‘lsa, maktabga murojaat qiling.',
    excuseApproved: '📄 {{name}} uchun ariza tasdiqlandi ({{from}} — {{to}}).',
    excuseRejected:
      '📄 {{name}} uchun ariza rad etildi ({{from}} — {{to}}).{{reason}}',
    reason: ' Sabab: {{text}}',
  },
  'uz-Cyrl': {
    askContact:
      'Фарзандингизни улаш учун телефон рақамингизни улашинг. Рақам мактабда рўйхатдан ўтган ота-она рақами билан бир хил бўлиши керак.',
    shareButton: '📱 Рақамни улашиш',
    notYourContact:
      'Илтимос, ўзингизнинг рақамингизни пастдаги тугма орқали улашинг.',
    notFound:
      'Бу рақам бўйича фарзанд топилмади. Мактабда ота-она телефони тўғри киритилганини текширтиринг.',
    linked:
      'Уланди! Фарзандларингиз:\n{{children}}\n\nХабарлар шу ерга келади. Давомат тарихини иловада кўришингиз мумкин.',
    openApp: '📊 Давоматни очиш',
    settingsTitle: 'Хабарнома созламалари (босиб ёқинг/ўчиринг):',
    arrival: 'Мактабга келди',
    leave: 'Мактабдан чиқди',
    absent: 'Келмади',
    excuse: 'Ариза натижаси',
    langChanged: 'Тил ўзгартирилди.',
    help: '/settings — хабарномалар\n/lang — тил\n/app — давомат иловаси',
    needLink: 'Аввал телефон рақамингизни уланг: /start',
    arrived: '✅ {{name}} мактабга келди ({{time}})',
    left: '🏠 {{name}} мактабдан чиқди ({{time}})',
    absentMsg:
      '⚠️ {{name}} бугун мактабга келмади (дарс {{start}} да бошланган). Сабаби бўлса, мактабга мурожаат қилинг.',
    excuseApproved: '📄 {{name}} учун ариза тасдиқланди ({{from}} — {{to}}).',
    excuseRejected:
      '📄 {{name}} учун ариза рад этилди ({{from}} — {{to}}).{{reason}}',
    reason: ' Сабаб: {{text}}',
  },
  ru: {
    askContact:
      'Чтобы подключить ребёнка, поделитесь номером телефона. Номер должен совпадать с номером родителя, указанным в школе.',
    shareButton: '📱 Поделиться номером',
    notYourContact: 'Пожалуйста, поделитесь своим номером кнопкой ниже.',
    notFound:
      'По этому номеру ребёнок не найден. Попросите школу проверить номер родителя.',
    linked:
      'Подключено! Ваши дети:\n{{children}}\n\nСообщения будут приходить сюда. Историю посещаемости можно посмотреть в приложении.',
    openApp: '📊 Открыть посещаемость',
    settingsTitle: 'Настройки уведомлений (нажмите, чтобы включить/выключить):',
    arrival: 'Пришёл в школу',
    leave: 'Ушёл из школы',
    absent: 'Не пришёл',
    excuse: 'Результат заявки',
    langChanged: 'Язык изменён.',
    help: '/settings — уведомления\n/lang — язык\n/app — приложение посещаемости',
    needLink: 'Сначала подключите номер телефона: /start',
    arrived: '✅ {{name}} пришёл(ла) в школу ({{time}})',
    left: '🏠 {{name}} ушёл(ла) из школы ({{time}})',
    absentMsg:
      '⚠️ {{name}} сегодня не пришёл(ла) в школу (уроки начались в {{start}}). Если есть причина, свяжитесь со школой.',
    excuseApproved: '📄 Заявка для {{name}} одобрена ({{from}} — {{to}}).',
    excuseRejected:
      '📄 Заявка для {{name}} отклонена ({{from}} — {{to}}).{{reason}}',
    reason: ' Причина: {{text}}',
  },
  en: {
    askContact:
      'To link your child, share your phone number. It must match the parent number registered at the school.',
    shareButton: '📱 Share my number',
    notYourContact: 'Please share your own number with the button below.',
    notFound:
      'No child was found for this number. Ask the school to check the parent phone number.',
    linked:
      'Linked! Your children:\n{{children}}\n\nNotifications will arrive here. You can see the attendance history in the app.',
    openApp: '📊 Open attendance',
    settingsTitle: 'Notification settings (tap to turn on/off):',
    arrival: 'Arrived at school',
    leave: 'Left school',
    absent: 'Absent',
    excuse: 'Excuse result',
    langChanged: 'Language changed.',
    help: '/settings — notifications\n/lang — language\n/app — attendance app',
    needLink: 'Please link your phone number first: /start',
    arrived: '✅ {{name}} arrived at school ({{time}})',
    left: '🏠 {{name}} left school ({{time}})',
    absentMsg:
      '⚠️ {{name}} did not come to school today (lessons started at {{start}}). If there is a reason, please contact the school.',
    excuseApproved:
      '📄 The excuse for {{name}} was approved ({{from}} — {{to}}).',
    excuseRejected:
      '📄 The excuse for {{name}} was rejected ({{from}} — {{to}}).{{reason}}',
    reason: ' Reason: {{text}}',
  },
  kk: {
    askContact:
      'Баланы байланыстыру үшін телефон нөміріңізбен бөлісіңіз. Нөмір мектепте тіркелген ата-ана нөміріне сәйкес болуы керек.',
    shareButton: '📱 Нөмірмен бөлісу',
    notYourContact:
      'Өтінеміз, өз нөміріңізбен төмендегі түйме арқылы бөлісіңіз.',
    notFound:
      'Бұл нөмір бойынша бала табылмады. Мектепке ата-ана телефонын тексертіңіз.',
    linked:
      'Қосылды! Балаларыңыз:\n{{children}}\n\nХабарлар осында келеді. Қатысу тарихын қосымшадан көре аласыз.',
    openApp: '📊 Қатысуды ашу',
    settingsTitle: 'Хабарландыру параметрлері (қосу/өшіру үшін басыңыз):',
    arrival: 'Мектепке келді',
    leave: 'Мектептен шықты',
    absent: 'Келмеді',
    excuse: 'Өтініш нәтижесі',
    langChanged: 'Тіл өзгертілді.',
    help: '/settings — хабарландырулар\n/lang — тіл\n/app — қатысу қосымшасы',
    needLink: 'Алдымен телефон нөміріңізді байланыстырыңыз: /start',
    arrived: '✅ {{name}} мектепке келді ({{time}})',
    left: '🏠 {{name}} мектептен шықты ({{time}})',
    absentMsg:
      '⚠️ {{name}} бүгін мектепке келмеді (сабақ {{start}} басталды). Себебі болса, мектепке хабарласыңыз.',
    excuseApproved: '📄 {{name}} үшін өтініш мақұлданды ({{from}} — {{to}}).',
    excuseRejected:
      '📄 {{name}} үшін өтініш қабылданбады ({{from}} — {{to}}).{{reason}}',
    reason: ' Себебі: {{text}}',
  },
  ky: {
    askContact:
      'Баланы байланыштыруу үчүн телефон номериңиз менен бөлүшүңүз. Номер мектепте катталган ата-эне номерине дал келиши керек.',
    shareButton: '📱 Номер менен бөлүшүү',
    notYourContact:
      'Сураныч, өз номериңиз менен төмөнкү баскыч аркылуу бөлүшүңүз.',
    notFound:
      'Бул номер боюнча бала табылган жок. Мектептен ата-эне телефонун текшерүүнү сураныңыз.',
    linked:
      'Байланышты! Балдарыңыз:\n{{children}}\n\nКабарлар ушул жерге келет. Катышуу тарыхын колдонмодон көрө аласыз.',
    openApp: '📊 Катышууну ачуу',
    settingsTitle: 'Билдирме жөндөөлөрү (күйгүзүү/өчүрүү үчүн басыңыз):',
    arrival: 'Мектепке келди',
    leave: 'Мектептен чыкты',
    absent: 'Келген жок',
    excuse: 'Арыз жыйынтыгы',
    langChanged: 'Тил өзгөртүлдү.',
    help: '/settings — билдирмелер\n/lang — тил\n/app — катышуу колдонмосу',
    needLink: 'Алгач телефон номериңизди байланыштырыңыз: /start',
    arrived: '✅ {{name}} мектепке келди ({{time}})',
    left: '🏠 {{name}} мектептен чыкты ({{time}})',
    absentMsg:
      '⚠️ {{name}} бүгүн мектепке келген жок (сабак {{start}} башталган). Себеби болсо, мектепке кайрылыңыз.',
    excuseApproved: '📄 {{name}} үчүн арыз бекитилди ({{from}} — {{to}}).',
    excuseRejected:
      '📄 {{name}} үчүн арыз четке кагылды ({{from}} — {{to}}).{{reason}}',
    reason: ' Себеби: {{text}}',
  },
  tg: {
    askContact:
      'Барои пайваст кардани фарзандатон рақами телефони худро фиристед. Рақам бояд бо рақами падару модари дар мактаб сабтшуда мувофиқ бошад.',
    shareButton: '📱 Фиристодани рақам',
    notYourContact: 'Лутфан, рақами худатонро бо тугмаи поин фиристед.',
    notFound:
      'Бо ин рақам фарзанд ёфт нашуд. Аз мактаб хоҳиш кунед, ки телефони падару модарро санҷад.',
    linked:
      'Пайваст шуд! Фарзандонатон:\n{{children}}\n\nПаёмҳо ба ҳамин ҷо меоянд. Таърихи ҳозиршавиро дар барнома дидан мумкин аст.',
    openApp: '📊 Кушодани ҳозиршавӣ',
    settingsTitle: 'Танзимоти огоҳӣ (барои фаъол/хомӯш кардан пахш кунед):',
    arrival: 'Ба мактаб омад',
    leave: 'Аз мактаб баромад',
    absent: 'Наомад',
    excuse: 'Натиҷаи ариза',
    langChanged: 'Забон иваз шуд.',
    help: '/settings — огоҳиҳо\n/lang — забон\n/app — барномаи ҳозиршавӣ',
    needLink: 'Аввал рақами телефони худро пайваст кунед: /start',
    arrived: '✅ {{name}} ба мактаб омад ({{time}})',
    left: '🏠 {{name}} аз мактаб баромад ({{time}})',
    absentMsg:
      '⚠️ {{name}} имрӯз ба мактаб наомад (дарс дар {{start}} оғоз шуд). Агар сабаб бошад, ба мактаб муроҷиат кунед.',
    excuseApproved: '📄 Арзаи {{name}} тасдиқ шуд ({{from}} — {{to}}).',
    excuseRejected: '📄 Арзаи {{name}} рад шуд ({{from}} — {{to}}).{{reason}}',
    reason: ' Сабаб: {{text}}',
  },
};

/** `{{key}}` o‘rnini to‘ldiradi. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(values[key] ?? ''),
  );
}
