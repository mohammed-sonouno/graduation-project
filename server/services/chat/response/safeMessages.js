/**
 * Allowed non-database wording: greetings, help, clarification, and explicit "no data" notices.
 * Factual content must come only from repository rows (see ResponseComposer).
 */

export function inferReplyLocale(userMessage) {
  const s = String(userMessage || '');
  let arabic = 0;
  let latin = 0;
  for (const ch of s) {
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(ch)) arabic += 1;
    else if (/[A-Za-z]/.test(ch)) latin += 1;
  }
  if (arabic === 0) return 'en';
  if (arabic > latin) return 'ar';
  return 'en';
}

function textHasArabic(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(text || ''));
}

function textHasLatin(text) {
  return /[A-Za-z]/.test(String(text || ''));
}

function textIsArabicDominant(text) {
  const source = String(text || '');
  const arabicChars = (source.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const latinChars = (source.match(/[A-Za-z]/g) || []).length;
  return arabicChars > 0 && arabicChars >= latinChars;
}

function pickLocaleFacts(majorPage, locale) {
  const factsEn = String(majorPage?.factsEn || '').trim();
  const factsAr = String(majorPage?.factsAr || '').trim();
  if (locale === 'ar') {
    if (factsAr && textIsArabicDominant(factsAr)) return factsAr;
    return '';
  }
  if (factsEn && textHasLatin(factsEn) && !textHasArabic(factsEn)) return factsEn;
  return '';
}

function majorPageContextTail(majorPage, locale) {
  if (!majorPage?.majorId) return '';
  const name = majorPage.majorName || '';
  const facts = pickLocaleFacts(majorPage, locale);
  const chips = (
    locale === 'ar' ? majorPage.suggestedQuestionsAr : majorPage.suggestedQuestionsEn
  ) || [];
  const sample = chips.map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
  if (locale === 'en') {
    const bits = [];
    bits.push(
      `Since you are on the ${name} page, I can answer questions about this programme — feel free to ask anything about it.`
    );
    if (facts) bits.push(facts);
    if (sample.length) {
      bits.push(`You could try: ${sample.map((c) => `"${c}"`).join(', ')}.`);
    }
    return bits.join('\n\n');
  }
  const bits = [];
  bits.push(
    `بما إنك على صفحة ${name}، بقدر أجاوبك عن هالتخصص — اسألني أي شيء عنه.`
  );
  if (facts) bits.push(facts);
  if (sample.length) {
    bits.push(`ممكن تجرّب: ${sample.map((c) => `«${c}»`).join('، ')}.`);
  }
  return bits.join('\n\n');
}

export function msgNotInDatabase(locale, majorPage = null) {
  const base =
    locale === 'en'
      ? 'I do not have enough information to answer that question right now. Try rephrasing it, or ask me about something specific such as a programme, event, or community. If you are on a programme page, you can ask about that programme directly.'
      : 'ما عندي معلومات كافية عشان أجاوبك على هالسؤال حالياً. جرّب تعيد صياغته، أو اسألني عن شي محدد مثل تخصص أو فعالية أو مجتمع. إذا كنت على صفحة برنامج، اسألني عن نفس البرنامج مباشرة.';
  const tail = majorPageContextTail(majorPage, locale);
  return tail ? `${base}\n\n${tail}` : base;
}

export function msgUnknownIntent(locale, majorPage = null) {
  const base =
    locale === 'en'
      ? 'I am not sure I understood your question. Could you rephrase it? Type "help" to see examples, or ask about a specific programme, event, or community.'
      : 'مش متأكد إني فهمت سؤالك. ممكن تعيد صياغته؟ اكتب «مساعدة» عشان تشوف أمثلة، أو اسأل عن تخصص أو فعالية أو مجتمع محدد.';
  const tail = majorPageContextTail(majorPage, locale);
  return tail ? `${base}\n\n${tail}` : base;
}

/** Lookup by id returned no row — still a database-backed answer. */
export function msgEventNotInDatabase(locale) {
  return locale === 'en'
    ? 'I could not find an event with that ID. Please double-check the number and try again.'
    : 'ما لقيت فعالية بهالرقم. تأكد من الرقم وجرّب مرة ثانية.';
}
