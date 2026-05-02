/**
 * Builds natural-language comparison between two engineering programmes.
 * All facts come from DB rows only. Missing fields are acknowledged honestly.
 */

function clip(s, max = 220) {
  const t = String(s || '').trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function bandText(r, locale) {
  if (r.minAvgMin != null && r.minAvgMax != null) {
    return `${r.minAvgMin}–${r.minAvgMax}`;
  }
  if (r.minAvgMin != null) {
    return locale === 'en' ? `${r.minAvgMin}+` : `من ${r.minAvgMin} فما فوق`;
  }
  if (r.minAvgMax != null) {
    return locale === 'en' ? `up to ${r.minAvgMax}` : `حتى ${r.minAvgMax}`;
  }
  return null;
}

function midBand(r) {
  const a = Number(r.minAvgMin);
  const b = Number(r.minAvgMax);
  if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  if (Number.isFinite(a)) return a;
  if (Number.isFinite(b)) return b;
  return null;
}

function diffLabel(level, locale) {
  if (!level) return null;
  const m = {
    low: ['low', 'منخفض'],
    medium: ['medium', 'متوسط'],
    high: ['high', 'مرتفع']
  };
  const x = m[String(level).toLowerCase()];
  return x ? (locale === 'en' ? x[0] : x[1]) : String(level);
}

function streamLabel(s, locale) {
  if (!s) return locale === 'en' ? 'not specified' : 'غير محدد';
  const v = String(s).toLowerCase();
  if (locale === 'en') {
    if (v === 'scientific') return 'scientific';
    if (v === 'industrial') return 'industrial';
    if (v === 'both') return 'scientific or industrial';
    return s;
  }
  if (v === 'scientific') return 'علمي';
  if (v === 'industrial') return 'صناعي';
  if (v === 'both') return 'علمي أو صناعي';
  return s;
}

/**
 * @returns {{ linesEn: string[], linesAr: string[], summaryEn: string, summaryAr: string, hasGap: boolean }}
 */
export function buildComparisonLines(rowA, rowB) {
  if (!rowA || !rowB) {
    return { linesEn: [], linesAr: [], summaryEn: '', summaryAr: '', hasGap: true };
  }

  const nameA = (rowA.nameEn || rowA.nameAr || rowA.programKey || 'A').trim();
  const nameB = (rowB.nameEn || rowB.nameAr || rowB.programKey || 'B').trim();
  const nameArA = (rowA.nameAr || rowA.nameEn || rowA.programKey || 'أ').trim();
  const nameArB = (rowB.nameAr || rowB.nameEn || rowB.programKey || 'ب').trim();

  const linesEn = [];
  const linesAr = [];

  // --- Admission ---
  const bA = bandText(rowA, 'en');
  const bB = bandText(rowB, 'en');
  const bArA = bandText(rowA, 'ar');
  const bArB = bandText(rowB, 'ar');
  if (bA && bB) {
    const midA = midBand(rowA);
    const midB = midBand(rowB);
    if (midA != null && midB != null) {
      if (midA > midB + 2) {
        linesEn.push(`Admission: ${nameA} typically requires a higher average (${bA}) than ${nameB} (${bB}), which means ${nameA} tends to be more selective.`);
        linesAr.push(`القبول: ${nameArA} عادةً بتطلب معدل أعلى (${bArA}) من ${nameArB} (${bArB})، يعني ${nameArA} أكثر تنافساً.`);
      } else if (midB > midA + 2) {
        linesEn.push(`Admission: ${nameB} typically requires a higher average (${bB}) than ${nameA} (${bA}), which means ${nameB} tends to be more selective.`);
        linesAr.push(`القبول: ${nameArB} عادةً بتطلب معدل أعلى (${bArB}) من ${nameArA} (${bArA})، يعني ${nameArB} أكثر تنافساً.`);
      } else {
        linesEn.push(`Admission: Both have similar admission ranges — ${nameA}: ${bA}, ${nameB}: ${bB}.`);
        linesAr.push(`القبول: نطاق القبول متقارب — ${nameArA}: ${bArA}، ${nameArB}: ${bArB}.`);
      }
    } else {
      linesEn.push(`Admission: ${nameA}: ${bA}; ${nameB}: ${bB}.`);
      linesAr.push(`القبول: ${nameArA}: ${bArA}؛ ${nameArB}: ${bArB}.`);
    }
  } else if (bA) {
    linesEn.push(`Admission: ${nameA} has an admission range of ${bA}. I do not have admission data for ${nameB}.`);
    linesAr.push(`القبول: ${nameArA} نطاق قبوله ${bArA}. ما عندي بيانات قبول لـ ${nameArB}.`);
  } else if (bB) {
    linesEn.push(`Admission: ${nameB} has an admission range of ${bB}. I do not have admission data for ${nameA}.`);
    linesAr.push(`القبول: ${nameArB} نطاق قبوله ${bArB}. ما عندي بيانات قبول لـ ${nameArA}.`);
  }

  // --- Stream ---
  const sA = streamLabel(rowA.streamType, 'en');
  const sB = streamLabel(rowB.streamType, 'en');
  const sArA = streamLabel(rowA.streamType, 'ar');
  const sArB = streamLabel(rowB.streamType, 'ar');
  if (rowA.streamType === rowB.streamType && rowA.streamType) {
    linesEn.push(`Stream: Both require the ${sA} stream.`);
    linesAr.push(`الفرع: كلاهم بتطلبوا فرع ${sArA}.`);
  } else {
    linesEn.push(`Stream: ${nameA} requires ${sA}; ${nameB} requires ${sB}.`);
    linesAr.push(`الفرع: ${nameArA} بتطلب ${sArA}؛ ${nameArB} بتطلب ${sArB}.`);
  }

  // --- Difficulty ---
  const dA = diffLabel(rowA.difficulty, 'en');
  const dB = diffLabel(rowB.difficulty, 'en');
  const dArA = diffLabel(rowA.difficulty, 'ar');
  const dArB = diffLabel(rowB.difficulty, 'ar');
  if (dA && dB) {
    if (dA === dB) {
      linesEn.push(`Difficulty: Both are rated as ${dA}.`);
      linesAr.push(`الصعوبة: كلاهم مصنفين ${dArA}.`);
    } else {
      linesEn.push(`Difficulty: ${nameA} is rated ${dA}, while ${nameB} is rated ${dB}.`);
      linesAr.push(`الصعوبة: ${nameArA} مصنف ${dArA}، بينما ${nameArB} مصنف ${dArB}.`);
    }
  } else if (dA) {
    linesEn.push(`Difficulty: ${nameA} is rated ${dA}. No difficulty rating available for ${nameB}.`);
    linesAr.push(`الصعوبة: ${nameArA} مصنف ${dArA}. ما في تصنيف صعوبة لـ ${nameArB}.`);
  } else if (dB) {
    linesEn.push(`Difficulty: ${nameB} is rated ${dB}. No difficulty rating available for ${nameA}.`);
    linesAr.push(`الصعوبة: ${nameArB} مصنف ${dArB}. ما في تصنيف صعوبة لـ ${nameArA}.`);
  }

  // --- Competition ---
  const cA = diffLabel(rowA.competition, 'en');
  const cB = diffLabel(rowB.competition, 'en');
  const cArA = diffLabel(rowA.competition, 'ar');
  const cArB = diffLabel(rowB.competition, 'ar');
  if (cA && cB) {
    if (cA === cB) {
      linesEn.push(`Competition: Both have ${cA} competition.`);
      linesAr.push(`التنافس: كلاهم تنافسهم ${cArA}.`);
    } else {
      linesEn.push(`Competition: ${nameA} has ${cA} competition, while ${nameB} has ${cB}.`);
      linesAr.push(`التنافس: ${nameArA} تنافسه ${cArA}، بينما ${nameArB} تنافسه ${cArB}.`);
    }
  }

  // --- Career summaries ---
  const carEnA = clip(rowA.careerSummaryEn);
  const carEnB = clip(rowB.careerSummaryEn);
  if (carEnA || carEnB) {
    linesEn.push('');
    linesEn.push(`Career paths:`);
    if (carEnA) linesEn.push(`• ${nameA}: ${carEnA}`);
    if (carEnB) linesEn.push(`• ${nameB}: ${carEnB}`);
  }
  const carArA = clip(rowA.careerSummaryAr || rowA.careerSummaryEn);
  const carArB = clip(rowB.careerSummaryAr || rowB.careerSummaryEn);
  if (carArA || carArB) {
    linesAr.push('');
    linesAr.push(`مجالات العمل:`);
    if (carArA) linesAr.push(`• ${nameArA}: ${carArA}`);
    if (carArB) linesAr.push(`• ${nameArB}: ${carArB}`);
  }

  // --- Summary reasoning ---
  const summaryEn = buildSummaryEn(nameA, nameB, rowA, rowB);
  const summaryAr = buildSummaryAr(nameArA, nameArB, rowA, rowB);

  return { linesEn, linesAr, summaryEn, summaryAr, hasGap: false };
}

function buildSummaryEn(nameA, nameB, rowA, rowB) {
  const midA = midBand(rowA);
  const midB = midBand(rowB);
  const parts = [];

  if (midA != null && midB != null) {
    const harder = midA > midB ? nameA : midB > midA ? nameB : null;
    if (harder) {
      parts.push(`${harder} generally requires a higher admission average, so it tends to be the more competitive option.`);
    }
  }

  const dA = rowA.difficulty;
  const dB = rowB.difficulty;
  if (dA && dB && dA !== dB) {
    const levels = { low: 1, medium: 2, high: 3 };
    const lA = levels[String(dA).toLowerCase()] || 0;
    const lB = levels[String(dB).toLowerCase()] || 0;
    if (lA > lB) {
      parts.push(`In terms of coursework, ${nameA} is considered more challenging.`);
    } else if (lB > lA) {
      parts.push(`In terms of coursework, ${nameB} is considered more challenging.`);
    }
  }

  if (rowA.streamType !== rowB.streamType && rowA.streamType && rowB.streamType) {
    parts.push('They also differ in stream requirements, so make sure yours matches.');
  }

  if (!parts.length) {
    parts.push('Both programmes are fairly similar on the metrics I have. Your choice may come down to personal interest and career goals.');
  }

  return parts.join(' ');
}

function buildSummaryAr(nameA, nameB, rowA, rowB) {
  const midA = midBand(rowA);
  const midB = midBand(rowB);
  const parts = [];

  if (midA != null && midB != null) {
    const harder = midA > midB ? nameA : midB > midA ? nameB : null;
    if (harder) {
      parts.push(`${harder} عادةً بتطلب معدل قبول أعلى، فبتكون الخيار الأكثر تنافساً.`);
    }
  }

  const dA = rowA.difficulty;
  const dB = rowB.difficulty;
  if (dA && dB && dA !== dB) {
    const levels = { low: 1, medium: 2, high: 3 };
    const lA = levels[String(dA).toLowerCase()] || 0;
    const lB = levels[String(dB).toLowerCase()] || 0;
    if (lA > lB) {
      parts.push(`من ناحية المواد، ${nameA} تُعتبر أصعب.`);
    } else if (lB > lA) {
      parts.push(`من ناحية المواد، ${nameB} تُعتبر أصعب.`);
    }
  }

  if (rowA.streamType !== rowB.streamType && rowA.streamType && rowB.streamType) {
    parts.push('كمان بختلفوا بمتطلبات الفرع، فتأكد إنه فرعك بناسب.');
  }

  if (!parts.length) {
    parts.push('البرنامجين متقاربين حسب المعلومات اللي عندي. القرار ممكن يرجع لاهتماماتك وأهدافك المهنية.');
  }

  return parts.join(' ');
}
