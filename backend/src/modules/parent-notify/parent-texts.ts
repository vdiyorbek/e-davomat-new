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
      '👋 <b>E-davomat</b>ga xush kelibsiz!\n\nFarzandingiz davomatini kuzatish uchun telefon raqamingizni ulashing.\n\n📱 Raqam maktabda ro‘yxatdan o‘tgan ota-ona raqami bilan bir xil bo‘lishi kerak.',
    shareButton: '📱 Raqamni ulashish',
    notYourContact:
      '☝️ Iltimos, o‘zingizning raqamingizni pastdagi tugma orqali ulashing.',
    notFound:
      '😕 Bu raqam bo‘yicha farzand topilmadi.\n\n• Maktabda ota-ona telefoni to‘g‘ri kiritilganini tekshirtiring\n• Maktabingiz xabarnoma xizmatiga hali ulanmagan bo‘lishi mumkin',
    linked:
      '🎉 <b>Ulandi!</b>\n\n👨‍👩‍👧 Farzandlaringiz:\n{{children}}\n\n🔔 Maktabga kelgani, chiqqani va kelmagani haqida shu yerga xabar yuboraman.\n📊 Davomat tarixi va arizalar pastdagi tugmada.',
    openApp: '📊 Davomatni ochish',
    settingsTitle:
      '⚙️ <b>Xabarnoma sozlamalari</b>\nBosib yoqing yoki o‘chiring:',
    arrival: '🏫 Maktabga keldi',
    leave: '🏠 Maktabdan chiqdi',
    absent: '⚠️ Kelmadi',
    excuse: '📄 Ariza natijasi',
    langChanged: '✅ Til o‘zgartirildi.',
    help: 'ℹ️ <b>Buyruqlar</b>\n/settings — xabarnomalar\n/lang — til\n/app — davomat ilovasi',
    needLink: '🔗 Avval telefon raqamingizni ulang: /start',
    arrived: '✅ <b>{{name}}</b> maktabga keldi\n🕗 Vaqt: <b>{{time}}</b>',
    left: '🏠 <b>{{name}}</b> maktabdan chiqdi\n🕑 Vaqt: <b>{{time}}</b>',
    absentMsg:
      '⚠️ <b>{{name}}</b> bugun maktabga kelmadi\n📚 Dars soat <b>{{start}}</b> da boshlangan\n\nSababi bo‘lsa, maktabga murojaat qiling.',
    excuseApproved:
      '📄 <b>Ariza tasdiqlandi</b> ✅\n👤 {{name}}\n📅 {{from}} — {{to}}',
    excuseRejected:
      '📄 <b>Ariza rad etildi</b> ❌\n👤 {{name}}\n📅 {{from}} — {{to}}{{reason}}',
    reason: '\n💬 Sabab: {{text}}',
  },
  'uz-Cyrl': {
    askContact:
      '👋 <b>E-davomat</b>га хуш келибсиз!\n\nФарзандингиз давоматини кузатиш учун телефон рақамингизни улашинг.\n\n📱 Рақам мактабда рўйхатдан ўтган ота-она рақами билан бир хил бўлиши керак.',
    shareButton: '📱 Рақамни улашиш',
    notYourContact:
      '☝️ Илтимос, ўзингизнинг рақамингизни пастдаги тугма орқали улашинг.',
    notFound:
      '😕 Бу рақам бўйича фарзанд топилмади.\n\n• Мактабда ота-она телефони тўғри киритилганини текширинг\n• Мактабингиз хабарнома хизматига ҳали уланмаган бўлиши мумкин',
    linked:
      '🎉 <b>Уланди!</b>\n\n👨‍👩‍👧 Фарзандларингиз:\n{{children}}\n\n🔔 Мактабга келгани, чиққани ва келмагани ҳақида шу ерга хабар юбораман.\n📊 Давомат тарихи ва аризалар пастдаги тугмада.',
    openApp: '📊 Давоматни очиш',
    settingsTitle: '⚙️ <b>Хабарнома созламалари</b>\nБосиб ёқинг ёки ўчиринг:',
    arrival: '🏫 Мактабга келди',
    leave: '🏠 Мактабдан чиқди',
    absent: '⚠️ Келмади',
    excuse: '📄 Ариза натижаси',
    langChanged: '✅ Тил ўзгартирилди.',
    help: 'ℹ️ <b>Буйруқлар</b>\n/settings — хабарномалар\n/lang — тил\n/app — давомат иловаси',
    needLink: '🔗 Аввал телефон рақамингизни уланг: /start',
    arrived: '✅ <b>{{name}}</b> мактабга келди\n🕗 Вақт: <b>{{time}}</b>',
    left: '🏠 <b>{{name}}</b> мактабдан чиқди\n🕑 Вақт: <b>{{time}}</b>',
    absentMsg:
      '⚠️ <b>{{name}}</b> бугун мактабга келмади\n📚 Дарс соат <b>{{start}}</b> да бошланган\n\nСабаби бўлса, мактабга мурожаат қилинг.',
    excuseApproved:
      '📄 <b>Ариза тасдиқланди</b> ✅\n👤 {{name}}\n📅 {{from}} — {{to}}',
    excuseRejected:
      '📄 <b>Ариза рад этилди</b> ❌\n👤 {{name}}\n📅 {{from}} — {{to}}{{reason}}',
    reason: '\n💬 Сабаб: {{text}}',
  },
  ru: {
    askContact:
      '👋 Добро пожаловать в <b>E-davomat</b>!\n\nЧтобы следить за посещаемостью ребёнка, поделитесь номером телефона.\n\n📱 Номер должен совпадать с номером родителя, указанным в школе.',
    shareButton: '📱 Поделиться номером',
    notYourContact:
      '☝️ Пожалуйста, поделитесь своим номером с помощью кнопки ниже.',
    notFound:
      '😕 По этому номеру ребёнок не найден.\n\n• Проверьте, что телефон родителя правильно указан в школе\n• Возможно, ваша школа ещё не подключена к уведомлениям',
    linked:
      '🎉 <b>Готово!</b>\n\n👨‍👩‍👧 Ваши дети:\n{{children}}\n\n🔔 Я буду сообщать сюда, когда ребёнок пришёл в школу, ушёл или не пришёл.\n📊 История посещаемости и заявки — по кнопке ниже.',
    openApp: '📊 Открыть посещаемость',
    settingsTitle:
      '⚙️ <b>Настройки уведомлений</b>\nНажмите, чтобы включить или выключить:',
    arrival: '🏫 Пришёл в школу',
    leave: '🏠 Ушёл из школы',
    absent: '⚠️ Не пришёл',
    excuse: '📄 Результат заявки',
    langChanged: '✅ Язык изменён.',
    help: 'ℹ️ <b>Команды</b>\n/settings — уведомления\n/lang — язык\n/app — приложение посещаемости',
    needLink: '🔗 Сначала подключите номер телефона: /start',
    arrived: '✅ <b>{{name}}</b> пришёл(а) в школу\n🕗 Время: <b>{{time}}</b>',
    left: '🏠 <b>{{name}}</b> вышел(а) из школы\n🕑 Время: <b>{{time}}</b>',
    absentMsg:
      '⚠️ <b>{{name}}</b> сегодня не пришёл(а) в школу\n📚 Уроки начались в <b>{{start}}</b>\n\nЕсли есть причина, обратитесь в школу.',
    excuseApproved:
      '📄 <b>Заявка одобрена</b> ✅\n👤 {{name}}\n📅 {{from}} — {{to}}',
    excuseRejected:
      '📄 <b>Заявка отклонена</b> ❌\n👤 {{name}}\n📅 {{from}} — {{to}}{{reason}}',
    reason: '\n💬 Причина: {{text}}',
  },
  en: {
    askContact:
      '👋 Welcome to <b>E-davomat</b>!\n\nShare your phone number to follow your child’s attendance.\n\n📱 It must match the parent phone number registered at the school.',
    shareButton: '📱 Share my number',
    notYourContact: '☝️ Please share your own number using the button below.',
    notFound:
      '😕 No child found for this number.\n\n• Check that the parent’s phone is entered correctly at the school\n• Your school may not be connected to notifications yet',
    linked:
      '🎉 <b>Connected!</b>\n\n👨‍👩‍👧 Your children:\n{{children}}\n\n🔔 I’ll message you here when your child arrives, leaves or is absent.\n📊 Attendance history and excuses are in the app below.',
    openApp: '📊 Open attendance',
    settingsTitle: '⚙️ <b>Notification settings</b>\nTap to turn on or off:',
    arrival: '🏫 Arrived at school',
    leave: '🏠 Left school',
    absent: '⚠️ Absent',
    excuse: '📄 Excuse result',
    langChanged: '✅ Language changed.',
    help: 'ℹ️ <b>Commands</b>\n/settings — notifications\n/lang — language\n/app — attendance app',
    needLink: '🔗 Please link your phone number first: /start',
    arrived: '✅ <b>{{name}}</b> arrived at school\n🕗 Time: <b>{{time}}</b>',
    left: '🏠 <b>{{name}}</b> left school\n🕑 Time: <b>{{time}}</b>',
    absentMsg:
      '⚠️ <b>{{name}}</b> did not come to school today\n📚 Classes started at <b>{{start}}</b>\n\nIf there is a reason, please contact the school.',
    excuseApproved:
      '📄 <b>Excuse approved</b> ✅\n👤 {{name}}\n📅 {{from}} — {{to}}',
    excuseRejected:
      '📄 <b>Excuse rejected</b> ❌\n👤 {{name}}\n📅 {{from}} — {{to}}{{reason}}',
    reason: '\n💬 Reason: {{text}}',
  },
  kk: {
    askContact:
      '👋 <b>E-davomat</b> жүйесіне қош келдіңіз!\n\nБаланың қатысуын бақылау үшін телефон нөміріңізбен бөлісіңіз.\n\n📱 Нөмір мектепте тіркелген ата-ана нөмірімен бірдей болуы керек.',
    shareButton: '📱 Нөмірмен бөлісу',
    notYourContact: '☝️ Өз нөміріңізді төмендегі түйме арқылы жіберіңіз.',
    notFound:
      '😕 Бұл нөмір бойынша бала табылмады.\n\n• Мектепте ата-ана телефоны дұрыс енгізілгенін тексеріңіз\n• Мектебіңіз хабарландыру қызметіне әлі қосылмаған болуы мүмкін',
    linked:
      '🎉 <b>Қосылды!</b>\n\n👨‍👩‍👧 Балаларыңыз:\n{{children}}\n\n🔔 Бала мектепке келгенде, шыққанда немесе келмегенде осында хабар жіберемін.\n📊 Қатысу тарихы мен өтініштер төмендегі түймеде.',
    openApp: '📊 Қатысуды ашу',
    settingsTitle:
      '⚙️ <b>Хабарландыру параметрлері</b>\nҚосу немесе өшіру үшін басыңыз:',
    arrival: '🏫 Мектепке келді',
    leave: '🏠 Мектептен шықты',
    absent: '⚠️ Келмеді',
    excuse: '📄 Өтініш нәтижесі',
    langChanged: '✅ Тіл өзгертілді.',
    help: 'ℹ️ <b>Командалар</b>\n/settings — хабарландырулар\n/lang — тіл\n/app — қатысу қосымшасы',
    needLink: '🔗 Алдымен телефон нөміріңізді байланыстырыңыз: /start',
    arrived: '✅ <b>{{name}}</b> мектепке келді\n🕗 Уақыты: <b>{{time}}</b>',
    left: '🏠 <b>{{name}}</b> мектептен шықты\n🕑 Уақыты: <b>{{time}}</b>',
    absentMsg:
      '⚠️ <b>{{name}}</b> бүгін мектепке келген жоқ\n📚 Сабақ <b>{{start}}</b> басталды\n\nСебебі болса, мектепке хабарласыңыз.',
    excuseApproved:
      '📄 <b>Өтініш мақұлданды</b> ✅\n👤 {{name}}\n📅 {{from}} — {{to}}',
    excuseRejected:
      '📄 <b>Өтініш қабылданбады</b> ❌\n👤 {{name}}\n📅 {{from}} — {{to}}{{reason}}',
    reason: '\n💬 Себебі: {{text}}',
  },
  ky: {
    askContact:
      '👋 <b>E-davomat</b> тутумуна кош келиңиз!\n\nБаланын катышуусун көзөмөлдөө үчүн телефон номериңиз менен бөлүшүңүз.\n\n📱 Номер мектепте катталган ата-эне номери менен бирдей болушу керек.',
    shareButton: '📱 Номер менен бөлүшүү',
    notYourContact: '☝️ Өз номериңизди төмөнкү баскыч аркылуу жөнөтүңүз.',
    notFound:
      '😕 Бул номер боюнча бала табылган жок.\n\n• Мектепте ата-эненин телефону туура киргизилгенин текшериңиз\n• Мектебиңиз билдирме кызматына али туташа элек болушу мүмкүн',
    linked:
      '🎉 <b>Туташты!</b>\n\n👨‍👩‍👧 Балдарыңыз:\n{{children}}\n\n🔔 Бала мектепке келгенде, чыкканда же келбегенде ушул жерге билдирем.\n📊 Катышуу тарыхы жана арыздар төмөнкү баскычта.',
    openApp: '📊 Катышууну ачуу',
    settingsTitle:
      '⚙️ <b>Билдирме жөндөөлөрү</b>\nКүйгүзүү же өчүрүү үчүн басыңыз:',
    arrival: '🏫 Мектепке келди',
    leave: '🏠 Мектептен чыкты',
    absent: '⚠️ Келген жок',
    excuse: '📄 Арыз жыйынтыгы',
    langChanged: '✅ Тил өзгөртүлдү.',
    help: 'ℹ️ <b>Буйруктар</b>\n/settings — билдирмелер\n/lang — тил\n/app — катышуу колдонмосу',
    needLink: '🔗 Адегенде телефон номериңизди байланыштырыңыз: /start',
    arrived: '✅ <b>{{name}}</b> мектепке келди\n🕗 Убактысы: <b>{{time}}</b>',
    left: '🏠 <b>{{name}}</b> мектептен чыкты\n🕑 Убактысы: <b>{{time}}</b>',
    absentMsg:
      '⚠️ <b>{{name}}</b> бүгүн мектепке келген жок\n📚 Сабак <b>{{start}}</b> башталды\n\nСебеби болсо, мектепке кайрылыңыз.',
    excuseApproved:
      '📄 <b>Арыз бекитилди</b> ✅\n👤 {{name}}\n📅 {{from}} — {{to}}',
    excuseRejected:
      '📄 <b>Арыз четке кагылды</b> ❌\n👤 {{name}}\n📅 {{from}} — {{to}}{{reason}}',
    reason: '\n💬 Себеби: {{text}}',
  },
  tg: {
    askContact:
      '👋 Ба <b>E-davomat</b> хуш омадед!\n\nБарои пайгирии ҳозиршавии фарзандатон рақами телефони худро фиристед.\n\n📱 Рақам бояд бо рақами падар ё модар, ки дар мактаб сабт шудааст, якхела бошад.',
    shareButton: '📱 Фиристодани рақам',
    notYourContact: '☝️ Лутфан, рақами худатонро бо тугмаи поён фиристед.',
    notFound:
      '😕 Бо ин рақам фарзанд ёфт нашуд.\n\n• Санҷед, ки телефони падару модар дар мактаб дуруст сабт шудааст\n• Мумкин мактаби шумо ба хизмати огоҳӣ ҳанӯз пайваст нашудааст',
    linked:
      '🎉 <b>Пайваст шуд!</b>\n\n👨‍👩‍👧 Фарзандони шумо:\n{{children}}\n\n🔔 Вақте ки фарзанд ба мактаб омад, баромад ё наомад, дар ин ҷо хабар медиҳам.\n📊 Таърихи ҳозиршавӣ ва аризаҳо дар тугмаи поён.',
    openApp: '📊 Кушодани ҳозиршавӣ',
    settingsTitle:
      '⚙️ <b>Танзимоти огоҳӣ</b>\nБарои фаъол ё хомӯш кардан пахш кунед:',
    arrival: '🏫 Ба мактаб омад',
    leave: '🏠 Аз мактаб баромад',
    absent: '⚠️ Наомад',
    excuse: '📄 Натиҷаи ариза',
    langChanged: '✅ Забон иваз шуд.',
    help: 'ℹ️ <b>Фармонҳо</b>\n/settings — огоҳиҳо\n/lang — забон\n/app — барномаи ҳозиршавӣ',
    needLink: '🔗 Аввал рақами телефони худро пайваст кунед: /start',
    arrived: '✅ <b>{{name}}</b> ба мактаб омад\n🕗 Вақт: <b>{{time}}</b>',
    left: '🏠 <b>{{name}}</b> аз мактаб баромад\n🕑 Вақт: <b>{{time}}</b>',
    absentMsg:
      '⚠️ <b>{{name}}</b> имрӯз ба мактаб наомад\n📚 Дарс соати <b>{{start}}</b> оғоз шуд\n\nАгар сабаб бошад, ба мактаб муроҷиат кунед.',
    excuseApproved:
      '📄 <b>Ариза тасдиқ шуд</b> ✅\n👤 {{name}}\n📅 {{from}} — {{to}}',
    excuseRejected:
      '📄 <b>Ариза рад шуд</b> ❌\n👤 {{name}}\n📅 {{from}} — {{to}}{{reason}}',
    reason: '\n💬 Сабаб: {{text}}',
  },
};

/** Telegram HTML uchun maxsus belgilarni ekranlaydi. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Hammasi BOSH HARFDA yozilgan ismni «Familiya Ism» ko‘rinishiga keltiradi (aks holda tegmaydi). */
export function niceName(value: string): string {
  const text = value.trim();
  if (text === '' || text !== text.toUpperCase() || text === text.toLowerCase())
    return text;
  return text
    .toLowerCase()
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_, sep: string, ch: string) => sep + ch.toUpperCase(),
    );
}

/**
 * `{{key}}` o‘rnini to‘ldiradi. Qiymatlar HTML uchun ekranlanadi;
 * tayyor HTML bo‘lgan kalitlar `raw` ro‘yxatida beriladi.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
  raw: string[] = [],
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = String(values[key] ?? '');
    return raw.includes(key) ? value : escapeHtml(value);
  });
}
