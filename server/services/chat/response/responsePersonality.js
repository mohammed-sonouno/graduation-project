/**
 * Phrasing only — no factual claims. Facts always come from draft / DB-backed fields.
 * English: warm, clear academic-advisor tone. Arabic: natural Palestinian advisor tone.
 */

export function recommendLead(locale) {
  return recommendLeadForCategory('engineering', locale);
}

/** @param {string} category — major_chat_context.category when on a major page; default engineering for global recommender */
export function recommendLeadForCategory(category, locale) {
  if (locale === 'en') {
    if (category === 'business') {
      return 'Based on your average and stream, here are the engineering programmes that could be a good fit for you:';
    }
    if (category === 'arts' || category === 'health' || category === 'law') {
      return 'Looking at what matches your numbers, here are the engineering options worth considering:';
    }
    return 'Based on your average and stream, here are the programmes that look like a good match for you:';
  }
  if (category === 'business') {
    return 'بناءً على معدلك وفرعك، هاي البرامج الهندسية اللي ممكن تناسبك:';
  }
  if (category === 'arts' || category === 'health' || category === 'law') {
    return 'بالنظر لمعدلك، هاي خيارات الهندسة اللي ممكن تناسبك:';
  }
  return 'بناءً على معدلك وفرعك، هاي البرامج اللي بتناسبك:';
}

export function snapshotHeadForCategory(category, locale, programmeName) {
  const name = programmeName || (locale === 'en' ? 'this programme' : 'هالبرنامج');
  if (locale === 'en') {
    if (category === 'engineering') {
      return `Here is what I know about ${name}:`;
    }
    if (category === 'business') {
      return `Here is what I can tell you about ${name}:`;
    }
    if (category === 'arts') {
      return `Here is what we have on ${name}:`;
    }
    if (category === 'health') {
      return `Here is what I can share about ${name} — for licensing or clinical details, please check with the faculty office directly:`;
    }
    if (category === 'law') {
      return `Here is what I know about ${name} — for practice-route specifics, the faculty office can give you the latest details:`;
    }
    return `Here is what I found about ${name}:`;
  }
  if (category === 'engineering') {
    return `هاي المعلومات اللي عندي عن ${name}:`;
  }
  if (category === 'business') {
    return `هاي اللي بقدر أحكيلك إياه عن ${name}:`;
  }
  if (category === 'arts') {
    return `هاي اللي عنا عن ${name}:`;
  }
  if (category === 'health') {
    return `هاي اللي بقدر أشاركك إياه عن ${name} — لتفاصيل الترخيص أو السريريات، تواصل مع عمادة الكلية:`;
  }
  if (category === 'law') {
    return `هاي اللي عندي عن ${name} — لتفاصيل مسارات الممارسة، الكلية بتقدر تفيدك أكثر:`;
  }
  return `هاي اللي لقيته عن ${name}:`;
}

export function acceptancePreamble(locale) {
  return locale === 'en'
    ? 'Here are the admission averages I have on file for this programme:'
    : 'هاي معدلات القبول اللي عنا لهالبرنامج:';
}

export function recommendNearThresholdTitle(locale) {
  return locale === 'en'
    ? 'These are close to your average — competitive but worth looking into:'
    : 'هاي قريبة من معدلك — فيها تنافس بس تستاهل تطلع عليها:';
}

export function compareLead(locale) {
  return locale === 'en'
    ? 'Here is a side-by-side look at both programmes:'
    : 'هاي مقارنة بين البرنامجين:';
}

export function compareFooter(locale) {
  return locale === 'en'
    ? 'If any detail shows "not available", it means we do not have that information yet — it does not mean the programme lacks it.'
    : 'إذا أي تفصيل طلع "غير متوفر"، يعني ما عنا هالمعلومة حالياً — مش معناتها إنها مش موجودة بالبرنامج.';
}

export function followupRankLead(locale) {
  return locale === 'en'
    ? 'Let me compare the two programmes you were just looking at:'
    : 'خليني أقارنلك بين البرنامجين اللي كنا نحكي عنهم:';
}

export function interestNoKeywordMatch(locale, terms) {
  const t = (terms || []).join(', ');
  return locale === 'en'
    ? `I was not able to match your interests (${t}) to specific programmes, so I am showing you the best options based on your average instead.`
    : `ما قدرت أربط اهتماماتك (${t}) ببرامج محددة، فبعرضلك أفضل الخيارات حسب معدلك.`;
}

export function comparePartial(locale, foundName, missingLabel) {
  return locale === 'en'
    ? `I found "${foundName}", but I could not find "${missingLabel}". Could you double-check the name? Try using the official programme name.`
    : `لقيت «${foundName}»، بس ما لقيت «${missingLabel}». ممكن تتأكد من الاسم؟ جرّب تستخدم الاسم الرسمي للبرنامج.`;
}

export function compareNeedTwoLabels(locale) {
  return locale === 'en'
    ? 'To compare, I need the names of both programmes. For example: "Compare Civil Engineering and Electrical Engineering".'
    : 'عشان أقارن، بدي أسماء البرنامجين. مثلاً: «قارن بين الهندسة المدنية والكهربائية».';
}

export function followupNeedPriorList(locale) {
  return locale === 'en'
    ? 'I need a previous recommendation with at least two options before I can compare them. Try asking for a recommendation with your average first.'
    : 'بدي توصية سابقة فيها خيارين على الأقل قبل ما أقارن بينهم. جرّب تسأل عن التوصية حسب معدلك أولاً.';
}

export function engineeringPromptPolished(locale) {
  return locale === 'en'
    ? 'Sure, I would be happy to help! Could you share your Tawjihi average and whether you are in the scientific or industrial stream?\n\nFor example: "My average is 75 industrial"'
    : 'أكيد، بساعدك! احكيلي معدلك التوجيهي وإذا فرعك علمي أو صناعي.\n\nمثال: «معدلي 75 صناعي»';
}

export function engineeringPromptAverageOnly(locale) {
  return locale === 'en'
    ? 'Could you share your Tawjihi average? Just the number is fine.\n\nFor example: "My average is 82"'
    : 'شو معدلك التوجيهي؟ بس الرقم كافي.\n\nمثال: «معدلي 82»';
}

export function engineeringPromptStreamOnly(locale) {
  return locale === 'en'
    ? 'Got your average, thanks! Are you in the scientific or industrial stream?\n\nJust say "scientific" or "industrial".'
    : 'تمام، وصلني معدلك! فرعك علمي ولا صناعي؟\n\nبس احكي «علمي» أو «صناعي».';
}

export function followupNeedStream(locale) {
  return locale === 'en'
    ? 'To compare these two properly, I need to know your stream — are you scientific or industrial?'
    : 'عشان أقارنهم بشكل صحيح، بدي أعرف فرعك — علمي ولا صناعي؟';
}
