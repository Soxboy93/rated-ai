/** Arabic text helpers: normalisation for matching, and digit conversion. */

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXT_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹"; // Persian/Urdu digits some keyboards produce

/** Convert Arabic-Indic digits (٠-٩) and extended forms to 0-9. */
export function toWesternDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, ch => {
    const a = ARABIC_INDIC.indexOf(ch);
    return String(a >= 0 ? a : EXT_ARABIC_INDIC.indexOf(ch));
  });
}

/** Convert 0-9 to Arabic-Indic digits. */
export function toArabicIndicDigits(text: string): string {
  return text.replace(/[0-9]/g, d => ARABIC_INDIC[Number(d)]);
}

/**
 * Normalise Arabic for keyword matching: remove diacritics and tatweel, unify alef/yaa/taa-marbuta/hamza forms,
 * and convert digits. Latin text is lower-cased. Never used for display.
 */
export function normalizeArabic(text: string): string {
  return toWesternDigits(text)
    .replace(/[ً-ٰٟـ]/g, "") // tashkeel, dagger alef, tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[‌‍‎‏]/g, "")
    .toLowerCase();
}
