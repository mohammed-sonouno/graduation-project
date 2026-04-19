/**
 * Generates human-readable explanations for why a programme is recommended.
 * Uses only stored admission band, stream, and user average — no external claims.
 */

function bandText(p, locale) {
  if (p.minAvgMin != null && p.minAvgMax != null) {
    return locale === 'en' ? `${p.minAvgMin}–${p.minAvgMax}` : `${p.minAvgMin}–${p.minAvgMax}`;
  }
  if (p.minAvgMin != null) {
    return locale === 'en' ? `${p.minAvgMin}+` : `من ${p.minAvgMin} فما فوق`;
  }
  if (p.minAvgMax != null) {
    return locale === 'en' ? `up to ${p.minAvgMax}` : `حتى ${p.minAvgMax}`;
  }
  return locale === 'en' ? 'not available' : 'غير متوفر';
}

function midBand(p) {
  const a = Number(p.minAvgMin);
  const b = Number(p.minAvgMax);
  const okA = Number.isFinite(a);
  const okB = Number.isFinite(b);
  if (okA && okB) return (a + b) / 2;
  if (okA) return a;
  if (okB) return b;
  return null;
}

function streamLabel(stream, locale) {
  if (!stream) return locale === 'en' ? 'any stream' : 'أي فرع';
  const s = String(stream).toLowerCase();
  if (locale === 'en') {
    if (s === 'scientific') return 'scientific';
    if (s === 'industrial') return 'industrial';
    if (s === 'both') return 'scientific or industrial';
    return stream;
  }
  if (s === 'scientific') return 'علمي';
  if (s === 'industrial') return 'صناعي';
  if (s === 'both') return 'علمي أو صناعي';
  return stream;
}

/**
 * @param {object} program — DB row (minAvgMin, minAvgMax, streamType, …)
 * @param {number} average — user's Tawjihi average
 * @param {string|null} userStream — 'scientific' | 'industrial' | null
 * @returns {{ en: string, ar: string }}
 */
export function explainFitSummary(program, average, userStream, complexity = 'medium') {
  const mid = midBand(program);
  const stream = program.streamType;
  const band = bandText(program, 'en');
  const bandAr = bandText(program, 'ar');
  const progStream = streamLabel(stream, 'en');
  const progStreamAr = streamLabel(stream, 'ar');

  const enParts = [];
  const arParts = [];

  enParts.push(`Admission range: ${band} (${progStream}).`);
  arParts.push(`نطاق القبول: ${bandAr} (${progStreamAr}).`);

  if (mid != null && Number.isFinite(average)) {
    const diff = average - mid;
    if (diff >= 5) {
      enParts.push(`Your average of ${average} is well above the typical admission range, so this should be a comfortable choice for you.`);
      arParts.push(`معدلك ${average} أعلى من نطاق القبول بشكل مريح، فهالخيار مناسب إلك.`);
      if (complexity === 'complex') {
        enParts.push(`This suggests strong competitiveness and lower admission stress.`);
        arParts.push(`هاد يشير لقوة في التنافس وقلة الضغط في القبول.`);
      }
    } else if (diff >= 2) {
      enParts.push(`With ${average}, you are above the midpoint of the admission range — this is a solid option and should be a realistic choice.`);
      arParts.push(`بمعدل ${average}، إنت فوق متوسط نطاق القبول — هالخيار قوي وواضح إنه واقعي.`);
      if (complexity === 'complex') {
        enParts.push(`You're positioned favorably, indicating good chances of acceptance.`);
        arParts.push(`إنت في موقع قوي، يشير لفرص جيدة في القبول.`);
      }
    } else if (diff >= 0) {
      enParts.push(`Your average of ${average} is close to the admission range, so this one is competitive. It is still realistic, but keep it in mind while you decide.`);
      arParts.push(`معدلك ${average} قريب من نطاق القبول، فهالخيار فيه تنافس. لسا واقعي، بس خلي هالشي ببالك وانت بتختار.`);
      if (complexity === 'complex') {
        enParts.push(`Competitive programs like this often require strong overall applications.`);
        arParts.push(`البرامج التنافسية زي هاد غالباً تحتاج طلبات قوية شاملة.`);
      }
    } else if (diff >= -3) {
      enParts.push(`Your average is slightly below the typical range. This could still be possible, but it will be competitive — a good choice if you are genuinely interested.`);
      arParts.push(`معدلك أقل شوي من النطاق المعتاد. ممكن يكون صعب شوي، بس إذا مهتم فعلاً فدايمًا في فرصة.`);
      if (complexity === 'complex') {
        enParts.push(`Consider additional qualifications or waitlist options if available.`);
        arParts.push(`فكر في مؤهلات إضافية أو قوائم الانتظار لو متوفرة.`);
      }
    } else {
      enParts.push(`Your average of ${average} is below the usual admission range for this programme. It would be a stretch, but you can still explore it if you want to challenge yourself.`);
      arParts.push(`معدلك ${average} أقل من نطاق القبول المعتاد لهالبرنامج. صعب شوي، بس لو حابب تتحدى نفسك ممكن تدرس هالخيار.`);
      if (complexity === 'complex') {
        enParts.push(`This might require exceptional extracurriculars or alternative pathways.`);
        arParts.push(`هاد ممكن يحتاج نشاطات استثنائية أو طرق بديلة.`);
      }
    }
  }

  if (userStream && stream && stream !== 'both' && stream !== userStream) {
    enParts.push(`Note: this programme is for the ${streamLabel(stream, 'en')} stream, which is different from yours. Please verify your eligibility.`);
    arParts.push(`ملاحظة: هالبرنامج للفرع ال${streamLabel(stream, 'ar')}، وهاد مختلف عن فرعك. تأكد من أهليتك.`);
    if (complexity === 'complex') {
      enParts.push(`Stream mismatches can sometimes be navigated through special permissions or transfers.`);
      arParts.push(`اختلافات الفرع ممكن تُحل من خلال إذن خاص أو نقل.`);
    }
  }

  if (program.isEstimate) {
    enParts.push('These figures are approximate and may change — check the latest official numbers.');
    arParts.push('هاي الأرقام تقريبية وممكن تتغير — تأكد من الأرقام الرسمية الأخيرة.');
  }

  return { en: enParts.join(' '), ar: arParts.join(' ') };
}
