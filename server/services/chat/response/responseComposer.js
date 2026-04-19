/**
 * Formats structured drafts built only from repository rows.
 * Wording here is either (a) safe non-factual templates (greeting, help, prompts) or
 * (b) labels/formatting around values that came from the database.
 */

import {
  inferReplyLocale,
  msgEventNotInDatabase,
  msgNotInDatabase,
  msgUnknownIntent
} from './safeMessages.js';
import * as personality from './responsePersonality.js';

export { inferReplyLocale };

function formatDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function bullets(lines) {
  return lines.map((x) => `• ${x}`).join('\n');
}

function extractFactValue(text, labels) {
  const source = String(text || '');
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&');
    const match = source.match(new RegExp(escaped + ':\\s*([^.]+)\\.', 'i'));
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function extractFactSection(text, labels) {
  const source = String(text || '');
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&');
    const pattern = escaped + ':\\s*([\\s\\S]+?)(?=(?:[A-Za-z][A-Za-z ]+|[\\u0600-\\u06FF][\\u0600-\\u06FF\\s]+):|$)';
    const match = source.match(new RegExp(pattern, 'i'));
    if (match?.[1]) return match[1].trim().replace(/\\s+/g, ' ');
  }
  return '';
}

function looksArabicHeavy(text) {
  const source = String(text || '');
  const arabicChars = (source.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars = (source.match(/[A-Za-z]/g) || []).length;
  return arabicChars > 0 && arabicChars >= latinChars;
}

function buildArabicFactsFallback(majorPage, ctxRow, aspect = 'overview') {
  const factsAr = String(ctxRow?.factsAr || '');
  const factsEn = String(ctxRow?.factsEn || '');
  const source = factsEn || factsAr;
  if (!source) return '';

  const duration = extractFactValue(source, ['Duration']);
  const degree = extractFactValue(source, ['Degree awarded']);
  const code = extractFactValue(source, ['Program code']);
  const descriptionAr = '';
  const descriptionEn = extractFactSection(source, ['Official program description']);
  const careersAr = '';
  const careersEn = extractFactSection(source, ['Official career opportunities section']);

  const lines = [];
  const majorName = majorPage?.majorName || '\u0647\u0630\u0627 \u0627\u0644\u062a\u062e\u0635\u0635';
  const collegeName = majorPage?.collegeName || '\u0627\u0644\u0643\u0644\u064a\u0629 \u0627\u0644\u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0647';

  if (aspect === 'careers') {
    if (careersAr) {
      lines.push(`\u062d\u0633\u0628 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u062a\u0648\u0641\u0631\u0629 \u0639\u0646\u062f\u064a\u060c \u0641\u0631\u0635 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0640 ${majorName}: ${careersAr}`);
    } else if (careersEn) {
      lines.push(`\u0639\u0646\u062f\u064a \u0625\u0634\u0627\u0631\u0629 \u0631\u0633\u0645\u064a\u0629 \u0625\u0644\u0649 \u0641\u0631\u0635 \u0627\u0644\u0639\u0645\u0644 \u0644\u0640 ${majorName}\u060c \u0644\u0643\u0646 \u0627\u0644\u062a\u0641\u0635\u064a\u0644 \u0627\u0644\u0645\u062a\u0627\u062d \u062d\u0627\u0644\u064a\u064b\u0627 \u0641\u064a \u0627\u0644\u0645\u0635\u062f\u0631 \u0627\u0644\u0623\u0635\u0644\u064a \u0645\u0646\u0634\u0648\u0631 \u0628\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629.`);
    }
  } else {
    lines.push(`${majorName} \u064a\u0646\u062f\u0631\u062c \u062a\u062d\u062a ${collegeName}.`);
    if (duration) lines.push(`\u0645\u062f\u0629 \u0627\u0644\u062f\u0631\u0627\u0633\u0629: ${duration}.`);
    if (degree) lines.push(`\u0627\u0644\u062f\u0631\u062c\u0629 \u0627\u0644\u0645\u0645\u0646\u0648\u062d\u0629: ${degree}.`);
    if (code) lines.push(`\u0631\u0645\u0632 \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062c: ${code}.`);
    if (descriptionAr) {
      lines.push(descriptionAr);
    } else if (descriptionEn) {
      lines.push('\u0627\u0644\u0648\u0635\u0641 \u0627\u0644\u062a\u0641\u0635\u064a\u0644\u064a \u0627\u0644\u0645\u062a\u0627\u062d \u062d\u0627\u0644\u064a\u064b\u0627 \u0644\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062c \u0645\u0648\u062c\u0648\u062f \u0641\u064a \u0627\u0644\u0645\u0635\u062f\u0631 \u0627\u0644\u0623\u0635\u0644\u064a \u0628\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629\u060c \u0644\u0643\u0646 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629 \u0627\u0644\u0645\u0624\u0643\u062f\u0629 \u0638\u0627\u0647\u0631\u0629 \u0623\u0639\u0644\u0627\u0647.');
    }
  }

  return lines.filter(Boolean).join(' ');
}

function pickMajorFacts(locale, majorPage, ctxRow, aspect = 'overview') {
  if (!ctxRow?.factsEn && !ctxRow?.factsAr) return '';
  if (locale === 'en') return String(ctxRow.factsEn || ctxRow.factsAr || '').trim();

  const factsAr = String(ctxRow?.factsAr || '').trim();
  if (
    factsAr &&
    looksArabicHeavy(factsAr) &&
    !factsAr.includes('Official program description') &&
    !factsAr.includes('Official career opportunities section')
  ) {
    return factsAr;
  }

  return buildArabicFactsFallback(majorPage, ctxRow, aspect);
}
function programDisplayName(p) {
  return (p.nameAr || p.nameEn || '').trim() || '—';
}

function streamArLabel(streamType) {
  if (streamType === 'scientific') return 'علمي';
  if (streamType === 'industrial') return 'صناعي';
  if (streamType == null || streamType === '') return 'غير محدد';
  return String(streamType);
}

function streamEnLabel(streamType) {
  if (streamType === 'scientific') return 'scientific';
  if (streamType === 'industrial') return 'industrial';
  if (streamType == null || streamType === '') return 'not specified';
  return String(streamType);
}

function estimateFooter(locale, show) {
  if (!show) return '';
  return locale === 'en'
    ? '\n\nPlease note: some of the figures above are approximate and may differ from the latest official numbers.'
    : '\n\nملاحظة: بعض الأرقام أعلاه تقريبية وممكن تختلف عن الأرقام الرسمية الأخيرة.';
}

function admissionBandLine(engRow, locale) {
  if (!engRow) return '';
  const min = engRow.minAvgMin != null && engRow.minAvgMin !== '' ? Number(engRow.minAvgMin) : null;
  const max = engRow.minAvgMax != null && engRow.minAvgMax !== '' ? Number(engRow.minAvgMax) : null;
  const hasMin = Number.isFinite(min);
  const hasMax = Number.isFinite(max);
  if (hasMin && hasMax) return locale === 'en' ? `between ${min} and ${max}` : `بين ${min} و ${max}`;
  if (hasMin) return locale === 'en' ? `around ${min} or above` : `حوالي ${min} فما فوق`;
  if (hasMax) return locale === 'en' ? `up to around ${max}` : `حتى حوالي ${max}`;
  return '';
}

function difficultyPhrase(level, locale) {
  if (!level) return null;
  const l = String(level).toLowerCase();
  if (locale === 'en') {
    if (l === 'low') return 'relatively accessible — most students manage it well with regular study';
    if (l === 'medium') return 'moderately challenging — it requires steady effort, especially in technical subjects';
    if (l === 'high') return 'quite demanding — it requires strong dedication and consistent hard work';
    return String(level);
  }
  if (l === 'low') return 'سهل نسبياً — أغلب الطلاب بقدروا يتعاملوا معه بدراسة منتظمة';
  if (l === 'medium') return 'متوسط الصعوبة — بتطلب جهد مستمر، خصوصاً بالمواد التقنية';
  if (l === 'high') return 'صعب — بتطلب التزام قوي وجهد مستمر';
  return String(level);
}

export class ResponseComposer {
  compose(draft, userMessage, options = {}) {
    const locale = options.replyLocale || inferReplyLocale(userMessage);
    switch (draft.kind) {
      case 'unknown_intent':
        return msgUnknownIntent(locale, options.majorPage);
      case 'not_in_database':
        return msgNotInDatabase(locale, options.majorPage);
      case 'greet':
        return this._greet(draft, locale);
      case 'help':
        return this._help(locale);
      case 'whoami':
        return this._whoami(draft, locale);
      case 'notifications_empty':
        return this._notificationsEmpty(draft, locale);
      case 'notifications_list':
        return this._notificationsList(draft, locale);
      case 'registrations_empty':
        return this._registrationsEmpty(locale);
      case 'registrations_list':
        return this._registrationsList(draft, locale);
      case 'events_count':
        return this._eventsCount(draft, locale);
      case 'event_missing_id':
        return locale === 'en' ? 'Please send the event number (id) you want.' : 'أرسل رقم الفعالية (المعرّف) الذي تريد التفاصيل عنه.';
      case 'event_not_found':
        return msgEventNotInDatabase(locale);
      case 'event_details':
        return this._eventDetails(draft, locale);
      case 'events_search_prompt':
        return locale === 'en'
          ? 'What should I search for? Example: search events workshop'
          : '\u0634\u0648 \u0628\u062f\u0643 \u0623\u062f\u0648\u0631 \u0639\u0644\u064a\u0647\u061f \u0645\u062b\u0627\u0644: \u0627\u0628\u062d\u062b \u0639\u0646 \u0641\u0639\u0627\u0644\u064a\u0629 \u0648\u0631\u0634\u0629';
      case 'events_search':
        return this._eventsSearch(draft, locale);
      case 'events_list':
        return this._eventsList(draft, locale);
      case 'communities_search_prompt':
        return locale === 'en' ? 'Tell me which community or club to look for.' : 'اكتب اسم المجتمع أو النادي اللي بدك تبحث عنه.';
      case 'communities_search':
        return this._communitiesSearch(draft, locale);
      case 'communities_list':
        return this._communitiesList(draft, locale);
      case 'engineering_recommend_prompt':
        return this._engineeringPrompt(draft, locale);
      case 'engineering_recommend':
        return this._engineeringRecommend(draft, locale, options);
      case 'engineering_acceptance_prompt':
        return locale === 'en'
          ? 'Which program do you mean? For example: Computer Engineering or Civil Engineering.'
          : '\u0623\u064a \u0628\u0631\u0646\u0627\u0645\u062c \u062a\u0642\u0635\u062f\u061f \u0645\u062b\u0644\u064b\u0627: \u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u062d\u0627\u0633\u0648\u0628 \u0623\u0648 \u0627\u0644\u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0645\u062f\u0646\u064a\u0629.';
      case 'engineering_acceptance':
        return this._engineeringAcceptance(draft, locale);
      case 'engineering_compare':
        return this._engineeringCompare(draft, locale);
      case 'engineering_compare_partial':
        return this._engineeringComparePartial(draft, locale);
      case 'engineering_compare_prompt':
        return personality.compareNeedTwoLabels(locale);
      case 'engineering_followup_rank':
        return this._engineeringFollowupRank(draft, locale);
      case 'engineering_followup_need_context':
        return personality.followupNeedPriorList(locale);
      case 'engineering_followup_need_stream':
        return personality.followupNeedStream(locale);
      case 'major_advisor_snapshot':
        return this._majorAdvisorSnapshot(draft, locale);
      case 'major_advisor_best_eng':
        return this._majorAdvisorBestEng(draft, locale, options);
      case 'major_advisor_need_average':
        return this._majorAdvisorNeedAverage(draft, locale);
      case 'major_advisor_need_stream':
        return this._majorAdvisorNeedStream(draft, locale);
      case 'major_advisor_best_non_eng':
        return this._majorAdvisorBestNonEng(draft, locale);
      case 'university_qa':
        return this._universityQA(draft, locale);
      case 'faculty_qa':
        return this._facultyQA(draft, locale);
      case 'faculty_abet':
        return this._facultyAbet(draft, locale);
      case 'feedback_acknowledged':
        return this._feedbackAcknowledged(draft, locale);
      default:
        return msgNotInDatabase(locale);
    }
  }

  _greet(draft, locale) {
    const mp = draft.majorPage;
    if (mp) {
      if (locale === 'ar' && mp.greetingAr) return mp.greetingAr;
      if (mp.greetingEn) return mp.greetingEn;
    }
    const name = draft.name?.trim() || (locale === 'en' ? 'there' : '');
    if (locale === 'en') {
      return `Hello${name ? ` ${name}` : ''} \uD83D\uDC4B\n\nHow can I help you today?`;
    }
    return name
      ? `\u0623\u0647\u0644\u0627 ${name} \uD83D\uDC4B\n\n\u0643\u064a\u0641 \u0628\u0642\u062f\u0631 \u0623\u0633\u0627\u0639\u062f\u0643 \u0627\u0644\u064a\u0648\u0645\u061f`
      : `\u0623\u0647\u0644\u0627 \uD83D\uDC4B\n\n\u0643\u064a\u0641 \u0628\u0642\u062f\u0631 \u0623\u0633\u0627\u0639\u062f\u0643 \u0627\u0644\u064a\u0648\u0645\u061f`;
  }

  _whoami(draft, locale) {
    const name = draft.name?.trim() || '';
    if (locale === 'en') {
      return name
        ? `You are signed in as ${name}.`
        : `You are signed in. For privacy, I can only display your name.`;
    }
    return name ? `إنت داخل باسم: ${name}.` : `إنت داخل، وبحكم الخصوصية بقدر أعرض اسمك بس.`;
  }

  _help(locale) {
    if (locale === 'en') {
      return [
        'Here are some things I can help you with:',
        bullets([
          '“Who am I?”',
          '“My notifications” / “Unread notifications”',
          '“My registrations”',
          '“List events” / “Count events” / “Search events <keyword>”',
          '“List communities” / “Search communities <keyword>”',
          '“My average is 75 industrial — what engineering programmes may fit?”',
          '“What is the acceptance average for Computer Engineering?”',
          '“Difference between Civil Engineering and Electrical Engineering”'
        ])
      ].join('\n');
    }
    return [
      '\u062a\u0642\u062f\u0631 \u062a\u0633\u0623\u0644\u0646\u064a \u0628\u0637\u0631\u064a\u0642\u0629 \u0639\u0627\u062f\u064a\u0629\u060c \u0648\u0647\u0627\u064a \u0623\u0645\u062b\u0644\u0629 \u0633\u0631\u064a\u0639\u0629:',
      bullets([
        '\u00ab\u0627\u0633\u0645\u064a\u00bb',
        '\u00ab\u0625\u0634\u0639\u0627\u0631\u0627\u062a\u064a\u00bb \u0623\u0648 \u00ab\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u063a\u064a\u0631 \u0645\u0642\u0631\u0648\u0621\u0629\u00bb',
        '\u00ab\u062a\u0633\u062c\u064a\u0644\u0627\u062a\u064a\u00bb',
        '\u00ab\u0627\u0639\u0631\u0636 \u0627\u0644\u0641\u0639\u0627\u0644\u064a\u0627\u062a\u00bb \u0623\u0648 \u00ab\u0639\u062f\u062f \u0627\u0644\u0641\u0639\u0627\u0644\u064a\u0627\u062a\u00bb \u0623\u0648 \u00ab\u0627\u0628\u062d\u062b \u0639\u0646 \u0641\u0639\u0627\u0644\u064a\u0629 \u0648\u0631\u0634\u0629\u00bb',
        '\u00ab\u0627\u0639\u0631\u0636 \u0627\u0644\u0645\u062c\u062a\u0645\u0639\u0627\u062a\u00bb \u0623\u0648 \u00ab\u0627\u0628\u062d\u062b \u0639\u0646 \u0646\u0627\u062f\u064a \u0631\u0648\u0628\u0648\u062a\u00bb',
        '\u00ab\u0645\u0639\u062f\u0644\u064a 75 \u0635\u0646\u0627\u0639\u064a\u00bb',
               '\u00ab\u0642\u062f\u064a\u0634 \u0645\u0639\u062f\u0644 \u0642\u0628\u0648\u0644 \u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u062d\u0627\u0633\u0648\u0628\u061f\u00bb',
        '\u00ab\u0627\u0644\u0641\u0631\u0642 \u0628\u064a\u0646 \u0627\u0644\u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0645\u062f\u0646\u064a\u0629 \u0648\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064a\u0629\u00bb'
      ])
    ].join('\n');
  }

  _notificationsEmpty(draft, locale) {
    if (locale === 'en') {
      return draft.unreadOnly ? 'You do not have any unread notifications right now.' : 'You do not have any notifications yet.';
    }
    return draft.unreadOnly
      ? '\u0645\u0627 \u0639\u0646\u062f\u0643 \u0625\u0634\u0639\u0627\u0631\u0627\u062a \u063a\u064a\u0631 \u0645\u0642\u0631\u0648\u0621\u0629 \u0647\u0644\u0642\u062a.'
      : '\u0645\u0627 \u0641\u064a \u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0639\u0646\u062f\u0643 \u0644\u0647\u0644\u0623.';
  }

  _notificationsList(draft, locale) {
    const lines = draft.items.map((x) => {
      const unread = !x.read ? (locale === 'en' ? ' (unread)' : ' (غير مقروء)') : '';
      const extra = x.message ? ` — ${x.message}` : '';
      return `${x.title}${unread}${extra}`;
    });
    const head =
      locale === 'en'
        ? `Here are your latest notifications:\n`
        : `هاي أحدث الإشعارات عندك:\n`;
    return head + bullets(lines);
  }

  _registrationsEmpty(locale) {
    return locale === 'en'
      ? 'You are not registered for any events yet.'
      : '\u0645\u0627 \u0639\u0646\u062f\u0643 \u062a\u0633\u062c\u064a\u0644\u0627\u062a \u0639\u0644\u0649 \u0641\u0639\u0627\u0644\u064a\u0627\u062a \u0647\u0644\u0642\u062a.';
  }

  _registrationsList(draft, locale) {
    const lines = draft.items.map((r) => {
      const when = r.eventStartDate ? ` — ${formatDate(r.eventStartDate)}` : '';
      const where = r.eventLocation ? ` — ${r.eventLocation}` : '';
      const title = r.eventTitle || String(r.eventId);
      return `${title}${when}${where}`;
    });
    const head = locale === 'en' ? `Your recent registrations:\n` : `هاي آخر تسجيلاتك:\n`;
    return head + bullets(lines);
  }

  _eventsCount(draft, locale) {
    if (draft.status) {
      return locale === 'en'
        ? `There are ${draft.total} events with the status “${draft.status}”.`
        : `في ${draft.total} فعالية بحالة «${draft.status}».`;
    }
    return locale === 'en'
      ? `There are ${draft.total} events in total.`
      : `مجموع الفعاليات المسجّلة: ${draft.total}.`;
  }

  _eventDetails(draft, locale) {
    const ev = draft.event;
    const parts = [];
    if (locale === 'en') {
      parts.push(`${ev.title}`);
      if (ev.status) parts.push(`Status: ${ev.status}`);
      if (ev.category) parts.push(`Category: ${ev.category}`);
      if (ev.clubName) parts.push(`Organiser: ${ev.clubName}`);
      if (ev.location) parts.push(`Location: ${ev.location}`);
      if (ev.startDate) {
        const t = ev.startTime ? ` ${ev.startTime}` : '';
        parts.push(`Starts: ${formatDate(ev.startDate)}${t}`);
      }
      if (ev.endDate) {
        const t = ev.endTime ? ` ${ev.endTime}` : '';
        parts.push(`Ends: ${formatDate(ev.endDate)}${t}`);
      }
      return [`Here is a summary of this event:`, bullets(parts)].join('\n');
    }
    parts.push(`«${ev.title}»`);
    if (ev.status) parts.push(`الحالة: ${ev.status}`);
    if (ev.category) parts.push(`التصنيف: ${ev.category}`);
    if (ev.clubName) parts.push(`الجهة المنظمة: ${ev.clubName}`);
    if (ev.location) parts.push(`المكان: ${ev.location}`);
    if (ev.startDate) {
      const t = ev.startTime ? ` الساعة ${ev.startTime}` : '';
      parts.push(`البداية: ${formatDate(ev.startDate)}${t}`);
    }
    if (ev.endDate) {
      const t = ev.endTime ? ` الساعة ${ev.endTime}` : '';
      parts.push(`النهاية: ${formatDate(ev.endDate)}${t}`);
    }
    return [`هاي أهم تفاصيل الفعالية:`, bullets(parts)].join('\n');
  }

  _eventsSearch(draft, locale) {
    const lines = draft.items.map((e) => {
      const d = e.startDate ? ` — ${formatDate(e.startDate)}` : '';
      return locale === 'en'
        ? `${e.title}${d} (id: ${e.id})`
        : `${e.title}${d} — رقم الفعالية: ${e.id}`;
    });
    const head =
      locale === 'en'
        ? `Here are the results for “${draft.q}”:\n`
        : `هاي نتائج البحث عن «${draft.q}»:\n`;
    return head + bullets(lines);
  }

  _eventsList(draft, locale) {
    const lines = draft.items.map((e) => {
      const d = e.startDate ? ` — ${formatDate(e.startDate)}` : '';
      const loc = e.location ? ` — ${e.location}` : '';
      return locale === 'en'
        ? `${e.title}${d}${loc} (id: ${e.id})`
        : `${e.title}${d}${loc} — رقم الفعالية: ${e.id}`;
    });
    const head = locale === 'en' ? `Here are the upcoming events:\n` : `هاي أقرب الفعاليات:\n`;
    return head + bullets(lines);
  }

  _communitiesSearch(draft, locale) {
    const lines = draft.items.map((c) => `${c.name} — ${c.collegeName}`);
    const head =
      locale === 'en'
        ? `Here are communities matching “${draft.q}”:\n`
        : `هاي مجتمعات قريبة من «${draft.q}»:\n`;
    return head + bullets(lines);
  }

  _communitiesList(draft, locale) {
    const lines = draft.items.map((c) => `${c.name} — ${c.collegeName}`);
    const head = locale === 'en' ? `Here are some communities you might be interested in:\n` : `هاي بعض المجتمعات:\n`;
    return head + bullets(lines);
  }

  _engineeringPrompt(draft, locale) {
    const focus = draft?.promptFocus || 'both';
    if (focus === 'average') return personality.engineeringPromptAverageOnly(locale);
    if (focus === 'stream') return personality.engineeringPromptStreamOnly(locale);
    return personality.engineeringPromptPolished(locale);
  }

  _explainLineForProgram(programKey, draft, locale) {
    const ex =
      draft.recommendationExplanations?.safe?.find((x) => x.programKey === programKey) ||
      draft.recommendationExplanations?.competitive?.find((x) => x.programKey === programKey);
    if (!ex) return '';
    return locale === 'en' ? ex.en : ex.ar;
  }

  _engineeringRecommend(draft, locale, options = {}) {
    const {
      average,
      streamLabel,
      streamUnspecified,
      hasEstimate,
      safeOptions = [],
      competitiveOptions = []
    } = draft;

    const complexity = options.questionComplexity || 'medium';
    const detailed = complexity === 'complex';

    const streamEn =
      streamLabel?.en ?? (streamUnspecified ? 'not specified' : '—');
    const streamAr =
      streamLabel?.ar ?? (streamUnspecified ? 'غير محدد' : '—');

    const parts = [];
    parts.push(
      personality.recommendLeadForCategory(
        draft.majorPage?.category || options.majorPage?.category || 'engineering',
        locale
      )
    );
    if (draft.interestMatchedNone && draft.interestTerms?.length) {
      parts.push('');
      parts.push(personality.interestNoKeywordMatch(locale, draft.interestTerms));
    }
    parts.push('');
    parts.push(
      locale === 'en'
        ? `Your average: ${average}. Your stream: ${streamEn}.`
        : `معدلك: ${average}. فرعك: ${streamAr}.`
    );
    if (detailed) {
      parts.push('');
      parts.push(locale === 'en' ? 'Based on your profile, here are the recommendations:' : 'بناءً على ملفك الشخصي، إليك التوصيات:');
    }
    parts.push('');
    parts.push(locale === 'en' ? 'Good options for you:' : 'خيارات مناسبة إلك:');
    if (safeOptions.length) {
      for (const p of safeOptions) {
        const name = programDisplayName(p);
        const detail = this._explainLineForProgram(p.programKey, draft, locale, detailed);
        parts.push(detail ? `• ${name}\n  ${detail}` : `• ${name}`);
      }
    } else {
      parts.push(locale === 'en' ? '• No programmes matched your criteria right now. Try adjusting your average or stream.' : '• ما في برامج طابقت معاييرك حالياً. جرّب تعدّل المعدل أو الفرع.');
    }
    if (competitiveOptions.length) {
      parts.push('');
      parts.push(personality.recommendNearThresholdTitle(locale));
      for (const p of competitiveOptions) {
        const name = programDisplayName(p);
        const detail = this._explainLineForProgram(p.programKey, draft, locale, detailed);
        parts.push(detail ? `• ${name}\n  ${detail}` : `• ${name}`);
      }
    }
    if (detailed) {
      parts.push('');
      parts.push(locale === 'en' ? 'These recommendations consider your average, stream, and interests. If you have more details, I can refine them further.' : 'هذه التوصيات تأخذ بعين الاعتبار معدلك وفرعك واهتماماتك. لو عندك تفاصيل أكثر، بقدر أحسن التوصيات.');
    }
    parts.push(estimateFooter(locale, hasEstimate));
    return parts.join('\n').trim();
  }

  _engineeringCompare(draft, locale) {
    const head = personality.compareLead(locale);
    const body = locale === 'en' ? draft.linesEn.join('\n') : draft.linesAr.join('\n');
    const summary = locale === 'en' ? (draft.summaryEn || '') : (draft.summaryAr || '');
    const parts = [head, '', body];
    if (summary) {
      parts.push('');
      parts.push(locale === 'en' ? `In short: ${summary}` : `باختصار: ${summary}`);
    }
    parts.push('');
    parts.push(personality.compareFooter(locale));
    return parts.join('\n').trim();
  }

  _engineeringComparePartial(draft, locale) {
    const name = programDisplayName(draft.found);
    return personality.comparePartial(locale, name, draft.missingLabel);
  }

  _engineeringFollowupRank(draft, locale) {
    const parts = [];
    parts.push(personality.followupRankLead(locale));
    parts.push('');
    const nameA = programDisplayName(draft.rowA);
    const nameB = programDisplayName(draft.rowB);
    parts.push(locale === 'en' ? `${nameA} vs ${nameB}` : `${nameA} مقابل ${nameB}`);
    parts.push('');
    parts.push(locale === 'en' ? `How they fit your average (${draft.average}):` : `كيف بناسبوك بمعدل ${draft.average}:`);
    parts.push(`• ${nameA}: ${locale === 'en' ? draft.fitA.en : draft.fitA.ar}`);
    parts.push(`• ${nameB}: ${locale === 'en' ? draft.fitB.en : draft.fitB.ar}`);
    const detail = locale === 'en' ? (draft.linesEn || []).join('\n') : (draft.linesAr || []).join('\n');
    if (detail) {
      parts.push('');
      parts.push(detail);
    }
    const summary = locale === 'en' ? (draft.summaryEn || '') : (draft.summaryAr || '');
    if (summary) {
      parts.push('');
      parts.push(locale === 'en' ? `In short: ${summary}` : `باختصار: ${summary}`);
    }
    parts.push('');
    parts.push(personality.compareFooter(locale));
    return parts.join('\n').trim();
  }

  _majorAdvisorSnapshot(draft, locale) {
    const { aspect = 'overview', majorPage, engRow, ctxRow, profileGpa, profileMajor } = draft;
    const name = majorPage?.majorName || (locale === 'en' ? 'this programme' : 'هالبرنامج');
    const paragraphs = [];

    const desc =
      locale === 'en'
        ? (engRow?.descriptionEn || '').trim()
        : (engRow?.descriptionAr || engRow?.descriptionEn || '').trim();
    const notes = (engRow?.notes || '').trim();
    const diff = difficultyPhrase(engRow?.difficulty, locale);
    const comp = engRow?.competition ? difficultyPhrase(engRow.competition, locale) : null;
    const stream =
      locale === 'en'
        ? streamEnLabel(engRow?.streamType)
        : streamArLabel(engRow?.streamType);
    const band = engRow != null ? admissionBandLine(engRow, locale) : '';

    if (aspect === 'competition') {
      if (engRow && comp) {
        if (locale === 'en') {
          paragraphs.push(`In terms of competition, ${name} is ${comp}.`);
          paragraphs.push('This means the number of applicants relative to available seats can influence how selective admission is.');
        } else {
          paragraphs.push(`من ناحية التنافس، ${name} ${comp}.`);
          paragraphs.push('يعني عدد المتقدمين مقارنة بالمقاعد المتاحة ممكن يأثر على صعوبة القبول.');
        }
      } else if (engRow) {
        paragraphs.push(locale === 'en'
          ? `I do not have specific competition data for ${name} right now. You could check with the admissions office for the latest figures.`
          : `ما عندي بيانات تنافس محددة لـ ${name} حالياً. ممكن تتواصل مع مكتب القبول للأرقام الأخيرة.`);
      } else if (ctxRow?.factsEn || ctxRow?.factsAr) {
        const f = pickMajorFacts(locale, majorPage, ctxRow, 'competition');
        if (f) paragraphs.push(f);
      }
      if (notes) paragraphs.push(notes);
    }

    else if (aspect === 'difficulty') {
      if (engRow && diff) {
        if (locale === 'en') {
          paragraphs.push(`${name} is considered ${diff}.`);
          if (band) paragraphs.push(`For context, the admission average is typically ${band}, which can give you a sense of the academic expectations.`);
        } else {
          paragraphs.push(`${name} ${diff}.`);
          if (band) paragraphs.push(`للعلم، معدل القبول عادةً ${band}، وهاد بيعطيك فكرة عن المستوى الأكاديمي المتوقع.`);
        }
      } else if (engRow) {
        paragraphs.push(locale === 'en'
          ? `I do not have a specific difficulty rating for ${name} at the moment.`
          : `ما عندي تقييم صعوبة محدد لـ ${name} حالياً.`);
      } else if (ctxRow?.factsEn || ctxRow?.factsAr) {
        const f = pickMajorFacts(locale, majorPage, ctxRow, 'difficulty');
        if (f) paragraphs.push(f);
      }
      if (notes) paragraphs.push(notes);
    }

    else if (aspect === 'overview') {
      if (engRow) {
        if (desc) paragraphs.push(desc);
        if (diff) {
          paragraphs.push(locale === 'en'
            ? `In terms of difficulty, this programme is ${diff}.`
            : `من ناحية الصعوبة، هالبرنامج ${diff}.`);
        }
        if (band) {
          paragraphs.push(locale === 'en'
            ? `The admission average is typically ${band}.`
            : `معدل القبول عادةً ${band}.`);
        }
        if (engRow.isAbetAccredited != null) {
          paragraphs.push(locale === 'en'
            ? `This programme ${engRow.isAbetAccredited ? 'is' : 'is not'} ABET accredited.`
            : `هالبرنامج ${engRow.isAbetAccredited ? 'حاصل' : 'مش حاصل'} على اعتماد ABET.`);
        }
      } else if (ctxRow?.factsEn || ctxRow?.factsAr) {
        const f = pickMajorFacts(locale, majorPage, ctxRow, 'overview');
        if (f) paragraphs.push(f);
      }
    }

    else if (aspect === 'careers') {
      const careerText = locale === 'en'
        ? (engRow?.careerSummaryEn || '').trim()
        : (engRow?.careerSummaryAr || engRow?.careerSummaryEn || '').trim();
      if (careerText) {
        paragraphs.push(locale === 'en'
          ? `Graduates of ${name} typically go into careers such as: ${careerText}`
          : `خريجين ${name} عادةً بشتغلوا بمجالات مثل: ${careerText}`);
      } else if (ctxRow?.factsEn || ctxRow?.factsAr) {
        const f = locale === 'en' ? ctxRow.factsEn : ctxRow.factsAr || ctxRow.factsEn;
        if (f) {
          paragraphs.push(locale === 'en'
            ? `From the official programme pages I have this careers-related summary for ${name}: ${f}`
            : `من الصفحات الرسمية للبرنامج عندي هالملخص المرتبط بمجالات ${name}: ${f}`);
        }
      } else {
        paragraphs.push(locale === 'en'
          ? `I do not have detailed career information for ${name} yet. Generally, the faculty office or career services can give you a clearer picture of what graduates go on to do.`
          : `ما عندي معلومات تفصيلية عن الوظائف لـ ${name} حالياً. بشكل عام، مكتب الكلية أو خدمات التوظيف بيقدروا يعطوك صورة أوضح.`);
      }
    }

    else if (aspect === 'admission') {
      if (band) {
        if (locale === 'en') {
          paragraphs.push(`To get into ${name}, you typically need a Tawjihi average of ${band}.`);
          if (stream && stream !== 'not specified') {
            paragraphs.push(`This programme is for students in the ${stream} stream.`);
          }
        } else {
          paragraphs.push(`عشان تدخل ${name}، عادةً بتحتاج معدل توجيهي ${band}.`);
          if (stream && stream !== 'غير محدد') {
            paragraphs.push(`هالبرنامج مخصص لطلاب فرع ال${stream}.`);
          }
        }
      } else {
        paragraphs.push(locale === 'en'
          ? `I do not have admission average details for ${name} right now. I would recommend checking with the admissions office for the most up-to-date numbers.`
          : `ما عندي تفاصيل معدل القبول لـ ${name} حالياً. بنصحك تتواصل مع مكتب القبول للأرقام الأخيرة.`);
      }
    }

    else if (aspect === 'math') {
      if (engRow?.keywords?.length) {
        const kw = engRow.keywords.join(', ');
        paragraphs.push(locale === 'en'
          ? `${name} covers topics related to: ${kw}. If you enjoy these areas, you will likely find the coursework engaging.`
          : `${name} بغطي مواضيع مثل: ${kw}. إذا بتحب هالمجالات، رح تستمتع بالمواد.`);
      }
      if (notes) paragraphs.push(notes);
      if (!paragraphs.length) {
        paragraphs.push(locale === 'en'
          ? `I do not have specific details about the math content in ${name}. You could check the programme's course plan or ask the department directly.`
          : `ما عندي تفاصيل محددة عن محتوى الرياضيات بـ ${name}. ممكن تراجع خطة المواد أو تسأل القسم مباشرة.`);
      }
    }

    else if (aspect === 'format') {
      if (locale === 'en') {
        if (stream && stream !== 'not specified') {
          paragraphs.push(`${name} is designed for students from the ${stream} stream.`);
        } else {
          paragraphs.push(`I do not have specific stream requirement details for ${name}.`);
        }
      } else {
        if (stream && stream !== 'غير محدد') {
          paragraphs.push(`${name} مصمم لطلاب فرع ال${stream}.`);
        } else {
          paragraphs.push(`ما عندي تفاصيل محددة عن متطلبات الفرع لـ ${name}.`);
        }
      }
      if (notes) paragraphs.push(notes);
    }

    else if (aspect === 'fit') {
      const fitParts = [];
      if (locale === 'en') {
        if (engRow) {
          if (diff) fitParts.push(`Academically, ${name} is ${diff}.`);
          if (band) fitParts.push(`The admission average is typically ${band}.`);
          if (profileGpa != null) {
            const mid = engRow.minAvgMin != null && engRow.minAvgMax != null
              ? (Number(engRow.minAvgMin) + Number(engRow.minAvgMax)) / 2
              : null;
            if (mid != null && Number.isFinite(mid)) {
              const gap = Number(profileGpa) - mid;
              if (gap >= 5) {
                fitParts.push(`With your average of ${profileGpa}, you are well above the typical range — this looks like a comfortable fit for you.`);
              } else if (gap >= 0) {
                fitParts.push(`With your average of ${profileGpa}, you are within range — it should be realistic, though it may be competitive.`);
              } else {
                fitParts.push(`With your average of ${profileGpa}, you are a bit below the typical range. It could be a stretch, but it is not impossible.`);
              }
            } else {
              fitParts.push(`Your average is ${profileGpa}.`);
            }
          }
          if (!fitParts.length) fitParts.push(`Based on what I have, ${name} could be a reasonable option, but I would need your average and stream to give you a clearer picture.`);
        } else {
          fitParts.push('To give you a proper assessment, could you share your Tawjihi average and stream (scientific or industrial)?');
        }
      } else {
        if (engRow) {
          if (diff) fitParts.push(`أكاديمياً، ${name} ${diff}.`);
          if (band) fitParts.push(`معدل القبول عادةً ${band}.`);
          if (profileGpa != null) {
            const mid = engRow.minAvgMin != null && engRow.minAvgMax != null
              ? (Number(engRow.minAvgMin) + Number(engRow.minAvgMax)) / 2
              : null;
            if (mid != null && Number.isFinite(mid)) {
              const gap = Number(profileGpa) - mid;
              if (gap >= 5) {
                fitParts.push(`بمعدلك ${profileGpa}، إنت فوق النطاق المعتاد بوضوح — هالتخصص بيناسبك بشكل مريح.`);
              } else if (gap >= 0) {
                fitParts.push(`بمعدلك ${profileGpa}، إنت ضمن النطاق — واقعي بس ممكن يكون فيه تنافس.`);
              } else {
                fitParts.push(`بمعدلك ${profileGpa}، إنت أقل شوي من النطاق المعتاد. صعب شوي بس مش مستحيل.`);
              }
            } else {
              fitParts.push(`معدلك ${profileGpa}.`);
            }
          }
          if (!fitParts.length) fitParts.push(`حسب اللي عندي، ${name} ممكن يكون خيار معقول، بس بحتاج معدلك وفرعك عشان أعطيك صورة أوضح.`);
        } else {
          fitParts.push('عشان أقدر أقيّم بشكل صحيح، احكيلي معدلك التوجيهي وفرعك (علمي أو صناعي).');
        }
      }
      for (const fp of fitParts) paragraphs.push(fp);
    }

    // Careers block is now handled in the 'careers' aspect above, so skip the old careerText block

    if (!paragraphs.length && (majorPage?.greetingEn || majorPage?.greetingAr)) {
      const g = locale === 'ar' ? majorPage.greetingAr : majorPage.greetingEn;
      if (g) paragraphs.push(g);
    }

    if (!paragraphs.length) {
      return msgNotInDatabase(locale);
    }
    const cat = majorPage?.category || 'other';
    const head = personality.snapshotHeadForCategory(cat, locale, name);
    return [head, '', paragraphs.join('\n\n')].join('\n').trim();
  }

  _majorAdvisorBestEng(draft, locale, options = {}) {
    const { majorPage } = draft;
    const head =
      locale === 'en'
        ? `You are on the ${majorPage?.majorName || 'programme'} page. Here is how the engineering programmes compare for you.`
        : `إنت بتسأل من صفحة ${majorPage?.majorName || 'البرنامج'}. هاي مقارنة للبرامج الهندسية حسب ملفك.`;
    const body = this._engineeringRecommend(draft, locale, options);
    const tail =
      locale === 'en'
        ? `\n\nJust a note: this focuses on engineering programmes. You are currently viewing ${majorPage?.majorName || 'the one you are viewing'}.`
        : `\n\nخلي ببالك: القائمة مركّزة على برامج الهندسة. التخصص الحالي هو ${majorPage?.majorName || 'المعروض في الصفحة'}.`;
    return [head, '', body, tail].join('\n').trim();
  }

  _majorAdvisorNeedAverage(draft, locale) {
    const n = draft.majorPage?.majorName || (locale === 'en' ? 'this programme' : 'هذا البرنامج');
    return locale === 'en'
      ? `To compare ${n} with other engineering programmes, could you share your Tawjihi average? For example: "My average is 85".`
      : `عشان أقارن ${n} مع برامج هندسية ثانية، احكيلي معدلك التوجيهي. مثلاً: «معدلي 85».`;
  }

  _majorAdvisorNeedStream(draft, locale) {
    const n = draft.majorPage?.majorName || (locale === 'en' ? 'this programme' : 'هذا البرنامج');
    const avg = draft.average;
    const avgBit =
      avg != null && Number.isFinite(Number(avg))
        ? locale === 'en'
          ? `I have your average (${avg}). `
          : `عندي معدلك (${avg}). `
        : '';
    return locale === 'en'
      ? `${avgBit}Are you in the scientific or industrial stream? This will help me find the best options for ${n}.`
      : `${avgBit}فرعك علمي ولا صناعي؟ هالشي بساعدني ألاقي أفضل الخيارات لـ ${n}.`;
  }

  _majorAdvisorBestNonEng(draft, locale) {
    const { majorPage, profileGpa, profileMajor } = draft;
    const parts = [];
    const name = majorPage?.majorName || '';
    if (locale === 'en') {
      parts.push(
        `You are viewing ${name}. At the moment, I can only rank and compare engineering programmes automatically. For other faculties, I can share what I know about the specific programme you are looking at.`
      );
      if (majorPage?.factsEn) parts.push(`About this programme: ${majorPage.factsEn}`);
      if (profileGpa != null) parts.push(`Your GPA: ${profileGpa}.`);
      if (profileMajor) parts.push(`Your current major interest: ${profileMajor}.`);
    } else {
      parts.push(
        `إنت على صفحة ${name}. الترتيب الآلي متوفر حالياً لبرامج الهندسة بس.`
      );
      if (majorPage?.factsAr || majorPage?.factsEn) parts.push(`عن هالتخصص: ${majorPage.factsAr || majorPage.factsEn}`);
      if (profileGpa != null) parts.push(`معدلك: ${profileGpa}.`);
      if (profileMajor) parts.push(`اهتمامك الحالي: ${profileMajor}.`);
    }
    return parts.join('\n\n');
  }

  _universityQA(draft, locale) {
    const matches = draft.matches || [];
    if (!matches.length) return msgNotInDatabase(locale);
    const parts = [];
    for (const m of matches) {
      const answer = locale === 'ar' ? (m.answerAr || m.answerEn) : (m.answerEn || m.answerAr);
      if (answer) parts.push(answer);
    }
    if (!parts.length) return msgNotInDatabase(locale);
    if (parts.length === 1) return parts[0];
    return parts.join('\n\n');
  }

  _facultyQA(draft, locale) {
    const matches = draft.matches || [];
    if (!matches.length) return msgNotInDatabase(locale);
    const parts = [];
    for (const m of matches) {
      const answer = locale === 'ar' ? (m.answerAr || m.answerEn) : (m.answerEn || m.answerAr);
      if (answer) parts.push(answer);
    }
    if (!parts.length) return msgNotInDatabase(locale);
    if (parts.length === 1) return parts[0];
    return parts.join('\n\n');
  }

  _facultyAbet(draft, locale) {
    const programs = draft.programs || [];
    const qaMatches = draft.qaMatches || [];
    const parts = [];
    if (qaMatches.length) {
      const answer = locale === 'ar'
        ? (qaMatches[0].answerAr || qaMatches[0].answerEn)
        : (qaMatches[0].answerEn || qaMatches[0].answerAr);
      if (answer) parts.push(answer);
    }
    if (programs.length) {
      parts.push('');
      parts.push(locale === 'en'
        ? `ABET-accredited programmes (${programs.length}):`
        : `البرامج المعتمدة من ABET (${programs.length}):`);
      for (const p of programs) {
        const name = locale === 'ar' ? (p.nameAr || p.nameEn) : p.nameEn;
        const dept = p.departmentName || '';
        parts.push(dept ? `• ${name} — ${dept}` : `• ${name}`);
      }
    }
    if (!parts.filter(Boolean).length) return msgNotInDatabase(locale);
    return parts.join('\n').trim();
  }

  _engineeringAcceptance(draft, locale) {
    const showEst = draft.programs.some((p) => p.isEstimate);
    const lines = draft.programs.map((p) => {
      const name = p.nameAr || p.nameEn;
      const stream = locale === 'en' ? streamEnLabel(p.streamType) : streamArLabel(p.streamType);
      const est = p.isEstimate ? (locale === 'en' ? ' (approximate)' : ' (تقريبي)') : '';
      if (locale === 'en') {
        return `${name}: you would typically need an average of ${p.rangeTextEn}${est} (${stream} stream).`;
      }
      return `${name}: عادةً بتحتاج معدل ${p.rangeTextAr}${est} (فرع ${stream}).`;
    });
    const head = `${personality.acceptancePreamble(locale)}\n`;
    return [head, bullets(lines), estimateFooter(locale, showEst)].join('\n').trim();
  }

  _feedbackAcknowledged(draft, locale) {
    if (locale === 'en') {
      return "Thank you for the feedback! I'll note that for future improvements. If you have a correction or more details, please share them.";
    }
    return "شكراً للملاحظة! باخذها بعين الاعتبار للتحسينات المستقبلية. لو عندك تصحيح أو تفاصيل أكثر، شاركها معي.";
  }
}
