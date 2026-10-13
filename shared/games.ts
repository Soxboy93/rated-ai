/**
 * Question generators for the five mini-games. Pure and seedable so they can be unit-tested.
 * Every question is a multiple choice: options are shuffled, `answer` is the index of the right one.
 */
import { type Rng, pick, randInt, shuffle } from "./rng";
import type { Lang } from "./jordan";

export type AgeId = "kids" | "tweens" | "teens";
export type Level = 1 | 2 | 3;

export type Choice = {
  prompt: string;
  options: string[];
  answer: number;
  /** Text to read aloud (spelling) when different from the prompt. */
  say?: string;
  /** Short friendly explanation shown after answering. */
  explain?: string;
  /** Small topic chip shown above the question. */
  topic?: string;
  /** Short meaning clue (spelling), so the question can be answered without audio. */
  clue?: string;
};

const tr = (lang: Lang, en: string, ar: string) => (lang === "ar" ? ar : en);

/** Build a Choice from the right answer and plausible wrong ones (deduplicated, shuffled). */
function makeChoice(rng: Rng, prompt: string, right: string, wrong: string[], extra: Partial<Choice> = {}): Choice {
  const distractors = Array.from(new Set(wrong.filter(w => w !== right))).slice(0, 3);
  // Hand-written distractors can collide (e.g. a*(b-1) == (a-1)*b); top up with nearby numbers so there are always 4 options.
  const n = Number(right);
  for (let k = 1; distractors.length < 3 && Number.isFinite(n) && k < 50; k++) {
    for (const cand of [String(n + k), String(n - k)]) {
      if (distractors.length < 3 && cand !== right && !distractors.includes(cand) && !(n >= 0 && Number(cand) < 0)) distractors.push(cand);
    }
  }
  const options = shuffle(rng, [right, ...distractors]);
  return { prompt, options, answer: options.indexOf(right), ...extra };
}

/** Wrong numbers near the right one, never equal to it. */
function nearNumbers(rng: Rng, right: number, spread: number, allowNegative: boolean): string[] {
  const out = new Set<number>();
  let guard = 0;
  while (out.size < 3 && guard++ < 60) {
    const delta = randInt(rng, 1, spread) * (rng() < 0.5 ? -1 : 1);
    const v = right + delta;
    if (v !== right && (allowNegative || v >= 0)) out.add(v);
  }
  let fill = 1;
  while (out.size < 3) { // tiny answers (0, 1) can run out of near values
    if (right + fill !== right) out.add(right + fill);
    fill++;
  }
  return Array.from(out).map(String);
}

/* ------------------------------------------------------------------ Math */

export function makeMathQuestion(age: AgeId, level: Level, rng: Rng, lang: Lang = "en"): Choice {
  const q = tr(lang, "?", "؟");
  if (age === "kids") {
    const max = [10, 20, 50][level - 1];
    if (rng() < 0.55) {
      const a = randInt(rng, 1, max - 1), b = randInt(rng, 1, max - a);
      return makeChoice(rng, `${a} + ${b} = ${q}`, String(a + b), nearNumbers(rng, a + b, 3, false), { topic: tr(lang, "Adding", "الجمع"), explain: `${a} + ${b} = ${a + b}` });
    }
    const a = randInt(rng, 2, max), b = randInt(rng, 1, a);
    return makeChoice(rng, `${a} − ${b} = ${q}`, String(a - b), nearNumbers(rng, a - b, 3, false), { topic: tr(lang, "Taking away", "الطرح"), explain: `${a} − ${b} = ${a - b}` });
  }
  if (age === "tweens") {
    if (level < 3) {
      const maxT = level === 1 ? 5 : 10;
      const a = randInt(rng, 2, maxT), b = randInt(rng, 2, 10);
      if (rng() < 0.6) {
        return makeChoice(rng, `${a} × ${b} = ${q}`, String(a * b), [String(a * (b + 1)), String(a * (b - 1)), String((a + 1) * b), String(a * b + a + 1)], { topic: tr(lang, "Times tables", "جدول الضرب"), explain: `${a} × ${b} = ${a * b}` });
      }
      return makeChoice(rng, `${a * b} ÷ ${a} = ${q}`, String(b), nearNumbers(rng, b, 3, false), { topic: tr(lang, "Dividing", "القسمة"), explain: tr(lang, `${a} × ${b} = ${a * b}, so ${a * b} ÷ ${a} = ${b}`, `${a} × ${b} = ${a * b}، إذن ${a * b} ÷ ${a} = ${b}`) });
    }
    const kind = randInt(rng, 0, 2);
    if (kind === 0) {
      const a = randInt(rng, 40, 150), b = randInt(rng, 25, 90);
      return makeChoice(rng, `${a} + ${b} = ${q}`, String(a + b), nearNumbers(rng, a + b, 10, false), { topic: tr(lang, "Big adding", "جمع الأعداد الكبيرة"), explain: `${a} + ${b} = ${a + b}` });
    }
    if (kind === 1) {
      const a = randInt(rng, 80, 200), b = randInt(rng, 20, 79);
      return makeChoice(rng, `${a} − ${b} = ${q}`, String(a - b), nearNumbers(rng, a - b, 10, false), { topic: tr(lang, "Big taking away", "طرح الأعداد الكبيرة"), explain: `${a} − ${b} = ${a - b}` });
    }
    const a = randInt(rng, 11, 25), b = randInt(rng, 3, 9);
    return makeChoice(rng, `${a} × ${b} = ${q}`, String(a * b), nearNumbers(rng, a * b, 12, false), { topic: tr(lang, "Big times", "الضرب في أعداد كبيرة"), explain: `${a} × ${b} = ${a * b}` });
  }
  // teens
  if (level === 1) {
    const p = pick(rng, [10, 20, 25, 50]);
    const n = pick(rng, [40, 60, 80, 100, 120, 200]);
    const ans = (n * p) / 100;
    return makeChoice(rng, tr(lang, `What is ${p}% of ${n}?`, `ما هو ${p}% من ${n}؟`), String(ans), nearNumbers(rng, ans, Math.max(3, Math.round(ans / 4)), false), { topic: tr(lang, "Percentages", "النسبة المئوية"), explain: `${p}% × ${n} = ${n} × ${p} ÷ 100 = ${ans}` });
  }
  if (level === 2) {
    const a = randInt(rng, -12, 12), b = randInt(rng, -12, 12);
    if (rng() < 0.6) {
      const sign = b < 0 ? `(${b})` : String(b);
      return makeChoice(rng, `${a} + ${sign} = ${q}`, String(a + b), nearNumbers(rng, a + b, 4, true), { topic: tr(lang, "Negative numbers", "الأعداد السالبة"), explain: `${a} + ${sign} = ${a + b}` });
    }
    const c = randInt(rng, 2, 9), d = randInt(rng, -9, 9);
    const dd = d < 0 ? `(${d})` : String(d);
    return makeChoice(rng, `${c} × ${dd} = ${q}`, String(c * d), nearNumbers(rng, c * d, 5, true), { topic: tr(lang, "Negative numbers", "الأعداد السالبة"), explain: `${c} × ${dd} = ${c * d}` });
  }
  const x = randInt(rng, 2, 12), a = randInt(rng, 2, 9), b = randInt(rng, 1, 15);
  return makeChoice(rng, tr(lang, `Solve for x:  ${a}x + ${b} = ${a * x + b}`, `أوجد قيمة س:  ${a}س + ${b} = ${a * x + b}`), String(x), nearNumbers(rng, x, 3, false), { topic: tr(lang, "Algebra", "الجبر"), explain: tr(lang, `${a * x + b} − ${b} = ${a * x}, then ${a * x} ÷ ${a} = ${x}`, `${a * x + b} − ${b} = ${a * x}، ثم ${a * x} ÷ ${a} = ${x}`) });
}

export const makeMathRound = (age: AgeId, level: Level, rng: Rng, count = 10, lang: Lang = "en"): Choice[] =>
  Array.from({ length: count }, () => makeMathQuestion(age, level, rng, lang));

/* -------------------------------------------------------------- Spelling */

const WORDS: Record<AgeId, string[]> = {
  kids: ["cat", "dog", "sun", "tree", "fish", "jump", "said", "were", "what", "come", "some", "away", "green", "happy", "apple", "water", "house", "again", "could", "there", "yellow", "rabbit", "friend", "school", "monkey", "family", "because", "people", "rainbow", "banana", "butterfly", "elephant"],
  tweens: ["island", "height", "enough", "library", "special", "weather", "curious", "captain", "century", "creature", "mountain", "describe", "neighbor", "opposite", "receive", "surprise", "suddenly", "tomorrow", "separate", "adventure", "dangerous", "different", "exercise", "familiar", "gorgeous", "necessary", "vegetable", "restaurant", "particular", "disappear", "experience", "environment"],
  teens: ["rhythm", "deceive", "vacuum", "harass", "tendency", "possession", "privilege", "sacrifice", "guarantee", "apparent", "embarrass", "exaggerate", "hierarchy", "occurrence", "silhouette", "unanimous", "atmosphere", "conscience", "fluorescent", "independent", "mischievous", "parliament", "sophomore", "withhold", "accommodate", "achievement", "acknowledge", "maintenance", "questionnaire", "surveillance", "perseverance", "pronunciation"],
};

const VOWELS = "aeiou";

/** A believable misspelling of `word` (never equal to it). */
export function misspell(word: string, rng: Rng): string {
  for (let attempt = 0; attempt < 30; attempt++) {
    const chars = word.split("");
    const kind = randInt(rng, 0, 3);
    if (kind === 0 && chars.length > 3) { // swap two neighbours
      const i = randInt(rng, 1, chars.length - 2);
      [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    } else if (kind === 1) { // double a letter
      const i = randInt(rng, 1, chars.length - 1);
      chars.splice(i, 0, chars[i]);
    } else if (kind === 2 && chars.length > 4) { // drop a letter
      chars.splice(randInt(rng, 1, chars.length - 2), 1);
    } else { // swap a vowel
      const idxs = chars.map((c, i) => (VOWELS.includes(c) ? i : -1)).filter(i => i >= 0);
      if (idxs.length === 0) continue;
      const i = pick(rng, idxs);
      chars[i] = pick(rng, VOWELS.split("").filter(v => v !== chars[i]));
    }
    const out = chars.join("");
    if (out !== word) return out;
  }
  return word + word[word.length - 1];
}

/**
 * Arabic spelling (إملاء). Each word has hand-written wrong spellings built on real orthography pitfalls: ة / ه, the
 * forms of hamza, ض / ظ, ث / س / ت, ذ / ز / د. Written without a native-educator review: they must be checked before
 * a school pilot. Ages 13-17 reuse the middle list for now.
 */
type ArSpelling = { word: string; wrong: [string, string, string]; clue: string };
const AR_SPELLING: Record<"kids" | "tweens", ArSpelling[]> = {
  kids: [
    { word: "مدرسة", wrong: ["مدرسه", "مدرصة", "مدرسا"], clue: "المكان الذي نتعلّم فيه" },
    { word: "مكتبة", wrong: ["مكتبه", "مكتبا", "مكتبت"], clue: "مكان فيه كتب كثيرة" },
    { word: "حديقة", wrong: ["حديقه", "حديكة", "حديقا"], clue: "مكان فيه أشجار وزهور نلعب فيه" },
    { word: "سيارة", wrong: ["سياره", "سيارت", "صيارة"], clue: "نركبها على الطريق" },
    { word: "شجرة", wrong: ["شجره", "شجرت", "شجرا"], clue: "لها جذع وأوراق وثمار" },
    { word: "طائرة", wrong: ["طايرة", "طائره", "طاءرة"], clue: "تطير في السماء وتحمل المسافرين" },
    { word: "فراشة", wrong: ["فراشه", "براشة", "فراشت"], clue: "حشرة جميلة بأجنحة ملوّنة" },
    { word: "أرنب", wrong: ["ارنب", "إرنب", "أرنوب"], clue: "حيوان أذناه طويلتان ويحب الجزر" },
    { word: "أسد", wrong: ["اسد", "إسد", "أصد"], clue: "ملك الغابة" },
    { word: "ضفدع", wrong: ["ظفدع", "ضفضع", "صفدع"], clue: "حيوان يقفز ويعيش قرب الماء" },
    { word: "ضوء", wrong: ["ظوء", "ضو", "ضؤ"], clue: "يجعلنا نرى في الظلام" },
    { word: "مستشفى", wrong: ["مستشفي", "مستشفا", "مستشفه"], clue: "يعالج فيه الطبيب المرضى" },
    { word: "إلى", wrong: ["الى", "إلي", "ألى"], clue: "نقول: ذهبتُ ___ المدرسة" },
    { word: "موسيقى", wrong: ["موسيقي", "موسيقه", "موسيكى"], clue: "ألحان جميلة نسمعها" },
    { word: "ثعلب", wrong: ["سعلب", "تعلب", "ثعلاب"], clue: "حيوان ماكر ذيله كثيف" },
    { word: "ذهب", wrong: ["زهب", "دهب", "ذحب"], clue: "معدن أصفر ثمين" },
    { word: "ثلاثة", wrong: ["ثلاثه", "ثلاتة", "تلاتة"], clue: "العدد الذي يأتي بعد اثنين" },
    { word: "سؤال", wrong: ["سوال", "سئال", "سؤآل"], clue: "ما نطرحه لنعرف الجواب" },
    { word: "شيء", wrong: ["شئ", "شيئ", "شىء"], clue: "كلمة تدلّ على أي غرض أو أمر" },
    { word: "اسم", wrong: ["إسم", "أسم", "اصم"], clue: "ما نُنادى به" },
    { word: "ابن", wrong: ["إبن", "أبن", "ابين"], clue: "الولد بالنسبة لوالده" },
    { word: "حقيبة", wrong: ["حقيبه", "حقيبا", "حقيبت"], clue: "نحمل فيها كتبنا إلى المدرسة" },
    { word: "ساعة", wrong: ["ساعه", "ساعا", "ساعت"], clue: "تُظهر لنا الوقت" },
    { word: "زهرة", wrong: ["زهره", "ذهرة", "زهرت"], clue: "جزء جميل من النبتة وله عطر" },
    { word: "لعبة", wrong: ["لعبه", "لعبا", "لعبت"], clue: "نلعب بها" },
    { word: "قطة", wrong: ["قطه", "قطا", "قطت"], clue: "حيوان أليف يموء" },
  ],
  tweens: [
    { word: "اجتماع", wrong: ["إجتماع", "اجتمآع", "اجتمااع"], clue: "لقاء يجمع عدداً من الناس" },
    { word: "انتباه", wrong: ["إنتباه", "انتبآه", "انتباة"], clue: "التركيز في ما نسمعه أو نراه" },
    { word: "مهندسة", wrong: ["مهندسه", "مهندصة", "مهندسا"], clue: "امرأة تصمّم المباني أو الآلات" },
    { word: "ظروف", wrong: ["ضروف", "زروف", "ظرووف"], clue: "أحوال وأوضاع" },
    { word: "ضمير", wrong: ["ظمير", "ضميير", "صمير"], clue: "صوت داخلي يفرّق بين الصواب والخطأ" },
    { word: "حاضر", wrong: ["حاظر", "حاضير", "هاضر"], clue: "الموجود في المكان، عكس غائب" },
    { word: "اعتذار", wrong: ["إعتذار", "اعتزار", "اعتظار"], clue: "كلمة نقولها حين نخطئ" },
    { word: "ذاكرة", wrong: ["زاكرة", "داكرة", "ذاكره"], clue: "ما نتذكّر به الأشياء" },
    { word: "ذكاء", wrong: ["زكاء", "دكاء", "ذكآء"], clue: "سرعة الفهم والتفكير" },
    { word: "نظافة", wrong: ["نضافة", "نظافه", "نزافة"], clue: "عكس الوسخ" },
    { word: "ضابط", wrong: ["ظابط", "ضابت", "دابط"], clue: "رتبة في الجيش أو الشرطة" },
    { word: "حفظ", wrong: ["حفض", "هفظ", "حفذ"], clue: "تثبيت المعلومة في الذاكرة" },
    { word: "انتظار", wrong: ["إنتظار", "انتضار", "انتظآر"], clue: "البقاء حتى يأتي شخص أو شيء" },
    { word: "فاكهة", wrong: ["فاكهه", "فاكحة", "فاكهت"], clue: "التفاح والبرتقال والعنب" },
    { word: "الطبيعة", wrong: ["الطبيعه", "الطبيعا", "الطبيعت"], clue: "الجبال والأنهار والأشجار حولنا" },
    { word: "المساء", wrong: ["المسآء", "المسا", "المساأ"], clue: "الوقت بعد العصر وقبل الليل" },
    { word: "الصحراء", wrong: ["الصحرا", "الصحراأ", "الصحرآء"], clue: "أرض واسعة جافة رملية" },
    { word: "الأردن", wrong: ["الاردن", "الإردن", "الأردون"], clue: "بلدنا وعاصمته عمّان" },
    { word: "مؤتمر", wrong: ["موتمر", "مئتمر", "مؤتمار"], clue: "اجتماع كبير لمناقشة موضوع مهم" },
    { word: "مثلث", wrong: ["مسلث", "متلت", "مثلس"], clue: "شكل له ثلاثة أضلاع" },
    { word: "ثقافة", wrong: ["سقافة", "تقافة", "ثقافه"], clue: "المعارف والعادات التي يعرفها شعب" },
    { word: "ثروة", wrong: ["سروة", "تروة", "ثروه"], clue: "مال أو ممتلكات كثيرة" },
    { word: "استماع", wrong: ["إستماع", "اسطماع", "استمائ"], clue: "الإصغاء بانتباه" },
  ],
};
export const arabicSpellingBank = (age: AgeId) => AR_SPELLING[age === "kids" ? "kids" : "tweens"];

export function makeSpellingRound(age: AgeId, level: Level, rng: Rng, count = 8, lang: Lang = "en"): Choice[] {
  if (lang === "ar") {
    const sorted = arabicSpellingBank(age).slice().sort((a, b) => a.word.length - b.word.length || a.word.localeCompare(b.word));
    const third = Math.ceil(sorted.length / 3);
    const pool = sorted.slice((level - 1) * third, level * third);
    return shuffle(rng, pool).slice(0, count).map(item =>
      makeChoice(rng, "أيّ كتابة صحيحة؟", item.word, item.wrong, { say: item.word, clue: item.clue, topic: "الإملاء", explain: `الكتابة الصحيحة: ${item.word}` })
    );
  }
  const sorted = WORDS[age].slice().sort((a, b) => a.length - b.length || a.localeCompare(b));
  const third = Math.ceil(sorted.length / 3);
  const pool = sorted.slice((level - 1) * third, level * third);
  const words = shuffle(rng, pool).slice(0, count);
  return words.map(word => {
    const wrong = new Set<string>();
    let guard = 0;
    while (wrong.size < 3 && guard++ < 50) wrong.add(misspell(word, rng));
    return makeChoice(rng, "Which one is spelled right?", word, Array.from(wrong), { say: word, topic: "Listen and spell", explain: `${word}: ${word.split("").join("-")}` });
  });
}

/* ------------------------------------------------------------------ Quiz */

type QuizItem = { q: string; a: string; wrong: [string, string, string]; topic: string; explain?: string };

const QUIZ: Record<AgeId, QuizItem[]> = {
  kids: [
    { q: "Which animal says “moo”?", a: "Cow", wrong: ["Dog", "Duck", "Cat"], topic: "Animals" },
    { q: "What colour do you get when you mix blue and yellow?", a: "Green", wrong: ["Purple", "Orange", "Pink"], topic: "Colours" },
    { q: "How many legs does a spider have?", a: "8", wrong: ["6", "4", "10"], topic: "Animals" },
    { q: "What do bees make?", a: "Honey", wrong: ["Milk", "Bread", "Juice"], topic: "Animals" },
    { q: "Which planet do we live on?", a: "Earth", wrong: ["Mars", "The Moon", "Jupiter"], topic: "Space" },
    { q: "What is the opposite of hot?", a: "Cold", wrong: ["Warm", "Wet", "Big"], topic: "Words" },
    { q: "How many days are in a week?", a: "7", wrong: ["5", "6", "10"], topic: "Time" },
    { q: "Which one is a fruit?", a: "Banana", wrong: ["Carrot", "Potato", "Onion"], topic: "Food" },
    { q: "What shape has 3 sides?", a: "Triangle", wrong: ["Circle", "Square", "Star"], topic: "Shapes" },
    { q: "What do plants need to grow?", a: "Water and sunlight", wrong: ["Candy", "Toys", "Plastic"], topic: "Nature" },
    { q: "Which season comes after winter?", a: "Spring", wrong: ["Summer", "Autumn", "Winter again"], topic: "Time" },
    { q: "What do we call frozen water?", a: "Ice", wrong: ["Steam", "Cloud", "Mud"], topic: "Science" },
  ],
  tweens: [
    { q: "What is the largest planet in our solar system?", a: "Jupiter", wrong: ["Saturn", "Earth", "Neptune"], topic: "Space" },
    { q: "Which gas do plants take in from the air to make food?", a: "Carbon dioxide", wrong: ["Oxygen", "Helium", "Nitrogen"], topic: "Science" },
    { q: "What is the capital city of France?", a: "Paris", wrong: ["Rome", "Madrid", "Berlin"], topic: "Geography" },
    { q: "How many continents are there?", a: "7", wrong: ["5", "6", "8"], topic: "Geography" },
    { q: "Which of these animals is a mammal?", a: "Dolphin", wrong: ["Shark", "Trout", "Octopus"], topic: "Animals" },
    { q: "At what temperature does water boil at sea level?", a: "100 °C", wrong: ["50 °C", "90 °C", "212 °C"], topic: "Science" },
    { q: "Which is the largest ocean?", a: "Pacific Ocean", wrong: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], topic: "Geography" },
    { q: "Which part of a cell holds its DNA?", a: "The nucleus", wrong: ["The wall", "The membrane", "The vacuole"], topic: "Science" },
    { q: "Who wrote the play “Romeo and Juliet”?", a: "William Shakespeare", wrong: ["Charles Dickens", "Roald Dahl", "Mark Twain"], topic: "Books" },
    { q: "What force pulls objects towards the Earth?", a: "Gravity", wrong: ["Magnetism", "Friction", "Wind"], topic: "Science" },
    { q: "Which is the closest star to Earth?", a: "The Sun", wrong: ["Polaris", "Sirius", "The Moon"], topic: "Space" },
    { q: "What is the main language spoken in Brazil?", a: "Portuguese", wrong: ["Spanish", "English", "French"], topic: "Geography" },
  ],
  teens: [
    { q: "What is the chemical symbol for gold?", a: "Au", wrong: ["Ag", "Gd", "Go"], topic: "Chemistry" },
    { q: "Which layer of the atmosphere contains the ozone layer?", a: "Stratosphere", wrong: ["Troposphere", "Mesosphere", "Thermosphere"], topic: "Earth science" },
    { q: "In which year did World War II end?", a: "1945", wrong: ["1939", "1918", "1950"], topic: "History" },
    { q: "Which organelle is called the powerhouse of the cell?", a: "Mitochondrion", wrong: ["Nucleus", "Ribosome", "Golgi body"], topic: "Biology" },
    { q: "Which theorem links the sides of a right-angled triangle?", a: "Pythagoras’ theorem", wrong: ["Euclid’s theorem", "Fermat’s theorem", "Thales’ theorem"], topic: "Maths" },
    { q: "About how fast does light travel in a vacuum?", a: "300,000 km per second", wrong: ["3,000 km per second", "30,000 km per second", "3 million km per second"], topic: "Physics" },
    { q: "What do we call cell division that makes two identical cells?", a: "Mitosis", wrong: ["Meiosis", "Osmosis", "Diffusion"], topic: "Biology" },
    { q: "What is the smallest prime number?", a: "2", wrong: ["1", "3", "0"], topic: "Maths" },
    { q: "What does GDP stand for?", a: "Gross Domestic Product", wrong: ["General Domestic Profit", "Global Development Plan", "Gross Daily Production"], topic: "Economics" },
    { q: "Who painted the Mona Lisa?", a: "Leonardo da Vinci", wrong: ["Michelangelo", "Vincent van Gogh", "Pablo Picasso"], topic: "Art" },
    { q: "What is the pH of pure water at room temperature?", a: "7", wrong: ["0", "10", "14"], topic: "Chemistry" },
    { q: "Which element has the atomic number 1?", a: "Hydrogen", wrong: ["Helium", "Oxygen", "Carbon"], topic: "Chemistry" },
  ],
};

const AR_QUIZ: Record<AgeId, QuizItem[]> = {
  kids: [
    { q: "ما الحيوان الذي يقول «مواء»؟", a: "القطة", wrong: ["الكلب", "البقرة", "الدجاجة"], topic: "الحيوانات" },
    { q: "ماذا نحصل عندما نخلط اللون الأزرق مع الأصفر؟", a: "الأخضر", wrong: ["البرتقالي", "الوردي", "البنفسجي"], topic: "الألوان" },
    { q: "كم عدد أرجل العنكبوت؟", a: "8", wrong: ["6", "4", "10"], topic: "الحيوانات" },
    { q: "ماذا يصنع النحل؟", a: "العسل", wrong: ["الحليب", "الخبز", "العصير"], topic: "الحيوانات" },
    { q: "على أي كوكب نعيش؟", a: "الأرض", wrong: ["المريخ", "المشتري", "عطارد"], topic: "الفضاء" },
    { q: "ما عكس كلمة «حارّ»؟", a: "بارد", wrong: ["طويل", "كبير", "سريع"], topic: "الكلمات" },
    { q: "كم يوماً في الأسبوع؟", a: "7", wrong: ["5", "6", "10"], topic: "الوقت" },
    { q: "أيٌّ مما يلي فاكهة؟", a: "الموز", wrong: ["الجزر", "البطاطا", "البصل"], topic: "الطعام" },
    { q: "ما عدد أضلاع المثلث؟", a: "3", wrong: ["4", "5", "2"], topic: "الأشكال" },
    { q: "ماذا تحتاج النباتات لتنمو؟", a: "الماء وضوء الشمس", wrong: ["الحلوى", "الألعاب", "البلاستيك"], topic: "الطبيعة" },
    { q: "ما الفصل الذي يأتي بعد الشتاء؟", a: "الربيع", wrong: ["الصيف", "الخريف", "الشتاء مرة أخرى"], topic: "الوقت" },
    { q: "ماذا نسمّي الماء المتجمّد؟", a: "الجليد", wrong: ["البخار", "الغيمة", "الوحل"], topic: "العلوم" },
    { q: "ما عاصمة الأردن؟", a: "عمّان", wrong: ["إربد", "الزرقاء", "الكرك"], topic: "بلدنا الأردن" },
  ],
  tweens: [
    { q: "ما أكبر كوكب في المجموعة الشمسية؟", a: "المشتري", wrong: ["زحل", "الأرض", "نبتون"], topic: "الفضاء" },
    { q: "أيّ غاز تأخذه النباتات من الهواء لتصنع غذاءها؟", a: "ثاني أكسيد الكربون", wrong: ["الأكسجين", "الهيليوم", "النيتروجين"], topic: "العلوم" },
    { q: "ما عاصمة فرنسا؟", a: "باريس", wrong: ["روما", "مدريد", "برلين"], topic: "الجغرافيا" },
    { q: "كم عدد قارات العالم؟", a: "7", wrong: ["5", "6", "8"], topic: "الجغرافيا" },
    { q: "أيٌّ من هذه الحيوانات من الثدييات؟", a: "الدلفين", wrong: ["القرش", "سمك السلمون", "الأخطبوط"], topic: "الحيوانات" },
    { q: "عند أي درجة حرارة يغلي الماء عند مستوى سطح البحر؟", a: "100 °م", wrong: ["50 °م", "90 °م", "150 °م"], topic: "العلوم" },
    { q: "ما أكبر المحيطات؟", a: "المحيط الهادئ", wrong: ["المحيط الأطلسي", "المحيط الهندي", "المحيط المتجمد الشمالي"], topic: "الجغرافيا" },
    { q: "أيّ جزء في الخلية يحتوي على المادة الوراثية؟", a: "النواة", wrong: ["الجدار", "الغشاء", "الفجوة"], topic: "العلوم" },
    { q: "ما القوة التي تجذب الأجسام نحو الأرض؟", a: "الجاذبية", wrong: ["المغناطيسية", "الاحتكاك", "الرياح"], topic: "العلوم" },
    { q: "ما أقرب نجم إلى الأرض؟", a: "الشمس", wrong: ["الشعرى", "النجم القطبي", "القمر"], topic: "الفضاء" },
    { q: "ما اسم المدينة الأثرية الوردية المشهورة في الأردن؟", a: "البتراء", wrong: ["جرش", "أم قيس", "عجلون"], topic: "بلدنا الأردن" },
    { q: "أيّ بحر يُعدّ أخفض منطقة يابسة على سطح الأرض؟", a: "البحر الميت", wrong: ["البحر الأحمر", "البحر المتوسط", "بحر قزوين"], topic: "بلدنا الأردن" },
  ],
  teens: [
    { q: "ما الرمز الكيميائي للذهب؟", a: "Au", wrong: ["Ag", "Gd", "Go"], topic: "الكيمياء" },
    { q: "في أي طبقة من الغلاف الجوي توجد طبقة الأوزون؟", a: "الستراتوسفير", wrong: ["التروبوسفير", "الميزوسفير", "الثرموسفير"], topic: "علوم الأرض" },
    { q: "في أي عام انتهت الحرب العالمية الثانية؟", a: "1945", wrong: ["1939", "1918", "1950"], topic: "التاريخ" },
    { q: "أيّ عُضيّة تُسمّى «محطة الطاقة» في الخلية؟", a: "الميتوكوندريا", wrong: ["النواة", "الريبوسوم", "جسم جولجي"], topic: "الأحياء" },
    { q: "أيّ نظرية تربط بين أضلاع المثلث القائم الزاوية؟", a: "نظرية فيثاغورس", wrong: ["نظرية إقليدس", "نظرية فيرما", "نظرية طاليس"], topic: "الرياضيات" },
    { q: "كم تبلغ سرعة الضوء في الفراغ تقريباً؟", a: "300,000 كم/ث", wrong: ["3,000 كم/ث", "30,000 كم/ث", "3 ملايين كم/ث"], topic: "الفيزياء" },
    { q: "ماذا نسمّي انقسام الخلية الذي ينتج خليتين متطابقتين؟", a: "الانقسام المتساوي (الميتوزي)", wrong: ["الانقسام المنصّف", "الأسموزية", "الانتشار"], topic: "الأحياء" },
    { q: "ما أصغر عدد أوّلي؟", a: "2", wrong: ["1", "3", "0"], topic: "الرياضيات" },
    { q: "ماذا يعني مصطلح GDP؟", a: "الناتج المحلي الإجمالي", wrong: ["معدل التضخم السنوي", "حجم الصادرات", "الدين العام"], topic: "الاقتصاد" },
    { q: "من رسم لوحة الموناليزا؟", a: "ليوناردو دا فينشي", wrong: ["مايكل أنجلو", "فينسنت فان جوخ", "بابلو بيكاسو"], topic: "الفن" },
    { q: "ما الرقم الهيدروجيني (pH) للماء النقي في درجة حرارة الغرفة؟", a: "7", wrong: ["0", "10", "14"], topic: "الكيمياء" },
    { q: "أيّ عنصر عدده الذرّي 1؟", a: "الهيدروجين", wrong: ["الهيليوم", "الأكسجين", "الكربون"], topic: "الكيمياء" },
  ],
};

export function makeQuizRound(age: AgeId, rng: Rng, count = 8, lang: Lang = "en"): Choice[] {
  const bank = lang === "ar" ? AR_QUIZ : QUIZ;
  return shuffle(rng, bank[age]).slice(0, count).map(item =>
    makeChoice(rng, item.q, item.a, item.wrong, { topic: item.topic, explain: item.explain ?? tr(lang, `The answer is ${item.a}.`, `الإجابة الصحيحة: ${item.a}.`) })
  );
}
export const quizBankSize = (age: AgeId, lang: Lang = "en") => (lang === "ar" ? AR_QUIZ : QUIZ)[age].length;
/** Exposed for tests: every quiz item with its right answer. */
export const quizBank = (age: AgeId, lang: Lang = "en") => (lang === "ar" ? AR_QUIZ : QUIZ)[age].map(({ q, a, wrong }) => ({ q, a, wrong }));

/* ---------------------------------------------------------------- Memory */

const MEMORY_EMOJI = ["🐶", "🐱", "🐸", "🦊", "🐼", "🦁", "🐵", "🐙", "🦄", "🐢", "🐝", "🦋", "🍎", "🍌", "🍓", "🚀", "⭐", "🌈"];
const MEMORY_PAIRS: Record<AgeId, [number, number, number]> = { kids: [3, 4, 6], tweens: [4, 6, 8], teens: [6, 8, 10] };

export type MemoryCard = { id: number; pairId: number; emoji: string };

export function makeMemoryDeck(age: AgeId, level: Level, rng: Rng): MemoryCard[] {
  const pairs = MEMORY_PAIRS[age][level - 1];
  const faces = shuffle(rng, MEMORY_EMOJI).slice(0, pairs);
  const cards = faces.flatMap((emoji, pairId) => [{ pairId, emoji }, { pairId, emoji }]);
  return shuffle(rng, cards).map((c, id) => ({ id, ...c }));
}

/** Turn a finished memory game into correct/total for XP: finishing in about 1.5 moves per pair counts as perfect. */
export function memoryScore(pairs: number, moves: number): { correct: number; total: number } {
  const par = Math.ceil(pairs * 1.5);
  if (moves <= par) return { correct: pairs, total: pairs };
  return { correct: Math.max(1, Math.min(pairs, Math.round((pairs * par) / moves))), total: pairs };
}

/* -------------------------------------------------------------- Patterns */

const SHAPES = ["🔴", "🔵", "🟢", "🟡", "🟣", "🟠", "⭐", "🔺", "🟦"];

export function makePatternQuestion(age: AgeId, level: Level, rng: Rng, lang: Lang = "en"): Choice {
  if (age === "kids") {
    const [a, b, c, d] = shuffle(rng, SHAPES);
    const templates = level === 1 ? [[a, b, a, b, a, b], [a, a, b, a, a, b]] : level === 2 ? [[a, b, c, a, b, c], [a, a, b, b, a, a]] : [[a, b, c, d, a, b, c], [a, b, b, a, b, b, a]];
    const seq = pick(rng, templates);
    const full = seq;
    // next item continues the repeating unit
    const period = (() => { for (let p = 2; p <= 4; p++) if (full.every((x, i) => x === full[i % p])) return p; return 3; })();
    const next = full[full.length % period];
    return makeChoice(rng, `${full.join(" ")} ${tr(lang, "?", "؟")}`, next, [a, b, c, d].filter(s => s !== next), { topic: tr(lang, "What comes next?", "ماذا يأتي بعد ذلك؟"), explain: tr(lang, `The pattern repeats, so ${next} comes next.`, `النمط يتكرّر، لذا يأتي ${next} بعد ذلك.`) });
  }
  const qm = tr(lang, "?", "؟");
  if (age === "tweens") {
    const step = randInt(rng, 2, level === 1 ? 5 : level === 2 ? 9 : 15);
    const down = level >= 2 && rng() < 0.4;
    const start = randInt(rng, 1, 20) + (down ? step * 5 : 0);
    const seq = Array.from({ length: 5 }, (_, i) => start + (down ? -step : step) * i);
    const next = start + (down ? -step : step) * 5;
    return makeChoice(rng, `${seq.join(", ")}, ${qm}`, String(next), nearNumbers(rng, next, 4, true), {
      topic: tr(lang, "Number patterns", "أنماط الأعداد"),
      explain: tr(lang, `It goes ${down ? "down" : "up"} by ${step} each time, so the next number is ${next}.`, `العدد ${down ? "ينقص" : "يزيد"} بمقدار ${step} في كل مرة، فالعدد التالي هو ${next}.`),
    });
  }
  if (level === 1) {
    const m = pick(rng, [2, 3]), start = randInt(rng, 1, 4);
    const seq = Array.from({ length: 5 }, (_, i) => start * m ** i);
    const next = start * m ** 5;
    return makeChoice(rng, `${seq.join(", ")}, ${qm}`, String(next), [String(next + m), String(next - m), String(next + start)], { topic: tr(lang, "Growing patterns", "الأنماط المتزايدة"), explain: tr(lang, `Each number is ${m} times the one before, so the next is ${next}.`, `كل عدد يساوي ${m} أمثال العدد الذي قبله، فالعدد التالي هو ${next}.`) });
  }
  if (level === 2) {
    const offset = randInt(rng, 0, 3);
    const seq = Array.from({ length: 5 }, (_, i) => (i + 1 + offset) ** 2);
    const next = (6 + offset) ** 2;
    return makeChoice(rng, `${seq.join(", ")}, ${qm}`, String(next), nearNumbers(rng, next, 8, false), { topic: tr(lang, "Square numbers", "الأعداد المربّعة"), explain: tr(lang, `These are square numbers, so the next is ${6 + offset} × ${6 + offset} = ${next}.`, `هذه أعداد مربّعة، فالعدد التالي هو ${6 + offset} × ${6 + offset} = ${next}.`) });
  }
  const a = randInt(rng, 1, 4), b = randInt(rng, 2, 6);
  const seq = [a, b];
  while (seq.length < 6) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
  const next = seq[4] + seq[5];
  return makeChoice(rng, `${seq.join(", ")}, ${qm}`, String(next), nearNumbers(rng, next, 5, false), { topic: tr(lang, "Fibonacci-style", "نمط شبيه بفيبوناتشي"), explain: tr(lang, `Add the last two numbers: ${seq[4]} + ${seq[5]} = ${next}.`, `اجمع آخر عددين: ${seq[4]} + ${seq[5]} = ${next}.`) });
}

export const makePatternRound = (age: AgeId, level: Level, rng: Rng, count = 8, lang: Lang = "en"): Choice[] =>
  Array.from({ length: count }, () => makePatternQuestion(age, level, rng, lang));
