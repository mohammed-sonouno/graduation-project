import { normalizeText, includesAny, extractComparisonPair } from '../../../utils/chatText.js';

/**
 * True when the message should NOT be collapsed into "major page overview"
 * (user is clearly asking about another domain).
 */
export function hasNonMajorGlobalIntentSignals(userMessage) {
  const msg = normalizeText(userMessage);
  if (extractComparisonPair(userMessage)) return true;

  if (
    includesAny(msg, [
      'university',
      'الجامعة',
      'جامعة',
      'najah',
      'النجاح',
      'an-najah',
      'campus',
      'campuses',
      'حرم',
      'library',
      'مكتبة',
      'vision',
      'mission',
      'رؤية',
      'رسالة'
    ])
  ) {
    return true;
  }

  if (
    includesAny(msg, ['abet', 'accredited', 'accreditation', 'اعتماد', 'معتمد']) &&
    includesAny(msg, ['engineering', 'هندسة', 'faculty', 'كلية', 'program', 'برنامج'])
  ) {
    return true;
  }

  if (
    includesAny(msg, ['faculty', 'كلية', 'college']) &&
    includesAny(msg, ['engineering', 'هندسة']) &&
    includesAny(msg, ['department', 'departments', 'اقسام', 'أقسام', 'student', 'طلاب', 'labs', 'مختبر'])
  ) {
    return true;
  }

  if (
    includesAny(msg, ['notification', 'notifications', 'اشعار', 'اشعارات', 'تنبيه']) ||
    includesAny(msg, ['registration', 'registrations', 'تسجيل', 'تسجيلاتي']) ||
    (includesAny(msg, ['event', 'events', 'فعالية', 'فعاليات', 'حدث', 'أحداث']) &&
      !includesAny(msg, ['this major', 'this programme', 'هاد التخصص']))
  ) {
    return true;
  }

  if (includesAny(msg, ['community', 'communities', 'مجتمع', 'مجتمعات', 'نادي', 'نوادي'])) {
    return true;
  }

  if (
    includesAny(msg, [
      'recommend', 'تنصحني', 'انسب',
      'what can i join', 'what can i study',
      'شو بقدر ادخل', 'شو بقدر ادرس',
      'fits me', 'fit me', 'what fits',
      'which major', 'what major', 'best major',
      'أفضل تخصص', 'أحسن تخصص', 'شو أفضل', 'شو أحسن'
    ]) ||
    (includesAny(msg, ['average', 'معدل', 'توجيهي', 'tawjihi']) &&
      includesAny(msg, ['engineering', 'هندسة', 'program', 'برنامج', 'تخصص', 'what', 'شو']))
  ) {
    return true;
  }

  if (includesAny(msg, ['who am i', 'اسمي', 'مين انا', 'help', 'مساعدة', 'what can you do'])) {
    return true;
  }

  return false;
}
