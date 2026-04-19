/**
 * Controls whether POST /api/chat includes non-null `debug` (engine plan / sources).
 */
export function shouldIncludeChatDebug() {
  const override = String(process.env.CHATBOT_DEBUG || '').trim().toLowerCase();
  if (override === '1' || override === 'true' || override === 'yes') return true;
  return process.env.NODE_ENV !== 'production';
}
