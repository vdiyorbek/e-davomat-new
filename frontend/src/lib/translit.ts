/**
 * O‘zbek lotin yozuvini kirill yozuviga o‘giradi.
 * Faqat backenddan kelgan, tarjimasi bo‘lmagan nomlar uchun ishlatiladi
 * (UI matnlari esa locales/uz-Cyrl papkasida qo‘lda tayyorlangan).
 */
const APOS = "[‘'ʻ`’ʼ]";

const DIGRAPHS: [RegExp, string][] = [
    [new RegExp(`O${APOS}`, 'g'), 'Ў'],
    [new RegExp(`o${APOS}`, 'g'), 'ў'],
    [new RegExp(`G${APOS}`, 'g'), 'Ғ'],
    [new RegExp(`g${APOS}`, 'g'), 'ғ'],
    [/Sh/g, 'Ш'], [/SH/g, 'Ш'], [/sh/g, 'ш'],
    [/Ch/g, 'Ч'], [/CH/g, 'Ч'], [/ch/g, 'ч'],
    [/Yo/g, 'Ё'], [/YO/g, 'Ё'], [/yo/g, 'ё'],
    [/Yu/g, 'Ю'], [/YU/g, 'Ю'], [/yu/g, 'ю'],
    [/Ya/g, 'Я'], [/YA/g, 'Я'], [/ya/g, 'я'],
    [/Ye/g, 'Е'], [/YE/g, 'Е'], [/ye/g, 'е'],
];

const SINGLE: Record<string, string> = {
    a: 'а', b: 'б', d: 'д', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н',
    o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'с', w: 'в',
};

const VOWELS = /[аеёиоуўэюяaeiou]/i;

export function translitUzLatnToCyrl(text: string): string {
    let value = text;
    for (const [pattern, replacement] of DIGRAPHS) value = value.replace(pattern, replacement);

    let out = '';
    for (let i = 0; i < value.length; i += 1) {
        const char = value[i];
        const lower = char.toLowerCase();
        const upper = char !== lower;

        if (lower === 'e') {
            const prev = out[out.length - 1] ?? '';
            const wordStart = !prev || !/\p{L}/u.test(prev);
            const cyr = wordStart || VOWELS.test(prev) ? 'э' : 'е';
            out += upper ? cyr.toUpperCase() : cyr;
        } else if (new RegExp(APOS).test(char)) {
            out += 'ъ';
        } else if (SINGLE[lower]) {
            out += upper ? SINGLE[lower].toUpperCase() : SINGLE[lower];
        } else {
            out += char;
        }
    }
    return out;
}
