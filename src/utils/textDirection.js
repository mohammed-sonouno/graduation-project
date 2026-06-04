/** Arabic and related scripts used for RTL layout. */
const ARABIC_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasArabicScript(text) {
  if (!text || typeof text !== 'string') return false;
  return ARABIC_SCRIPT_RE.test(text);
}

/** @returns {'rtl' | 'ltr'} */
export function getTextDir(text) {
  return hasArabicScript(text) ? 'rtl' : 'ltr';
}

/** Props for block-level user content (description, reviews, etc.). */
export function rtlContentProps(text, className = '') {
  const dir = getTextDir(text);
  const align = dir === 'rtl' ? 'text-right' : 'text-start';
  return {
    dir,
    lang: hasArabicScript(text) ? 'ar' : undefined,
    className: [className, align].filter(Boolean).join(' '),
  };
}
