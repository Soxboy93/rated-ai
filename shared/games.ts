/**
 * Question generators for the five mini-games. Pure and seedable so they can be unit-tested.
 * Every question is a multiple choice: options are shuffled, `answer` is the index of the right one.
 */
import { type Rng, pick, randInt, shuffle } from "./rng";

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
};

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

export function makeMathQuestion(age: AgeId, level: Level, rng: Rng): Choice {
  if (age === "kids") {
    const max = [10, 20, 50][level - 1];
    if (rng() < 0.55) {
      const a = randInt(rng, 1, max - 1), b = randInt(rng, 1, max - a);
      return makeChoice(rng, `${a} + ${b} = ?`, String(a + b), nearNumbers(rng, a + b, 3, false), { topic: "Adding", explain: `${a} + ${b} = ${a + b}` });
    }
    const a = randInt(rng, 2, max), b = randInt(rng, 1, a);
    return makeChoice(rng, `${a} − ${b} = ?`, String(a - b), nearNumbers(rng, a - b, 3, false), { topic: "Taking away", explain: `${a} − ${b} = ${a - b}` });
  }
  if (age === "tweens") {
    if (level < 3) {
      const maxT = level === 1 ? 5 : 10;
      const a = randInt(rng, 2, maxT), b = randInt(rng, 2, 10);
      if (rng() < 0.6) {
        return makeChoice(rng, `${a} × ${b} = ?`, String(a * b), [String(a * (b + 1)), String(a * (b - 1)), String((a + 1) * b), String(a * b + a + 1)], { topic: "Times tables", explain: `${a} × ${b} = ${a * b}` });
      }
      return makeChoice(rng, `${a * b} ÷ ${a} = ?`, String(b), nearNumbers(rng, b, 3, false), { topic: "Dividing", explain: `${a} × ${b} = ${a * b}, so ${a * b} ÷ ${a} = ${b}` });
    }
    const kind = randInt(rng, 0, 2);
    if (kind === 0) {
      const a = randInt(rng, 40, 150), b = randInt(rng, 25, 90);
      return makeChoice(rng, `${a} + ${b} = ?`, String(a + b), nearNumbers(rng, a + b, 10, false), { topic: "Big adding", explain: `${a} + ${b} = ${a + b}` });
    }
    if (kind === 1) {
      const a = randInt(rng, 80, 200), b = randInt(rng, 20, 79);
      return makeChoice(rng, `${a} − ${b} = ?`, String(a - b), nearNumbers(rng, a - b, 10, false), { topic: "Big taking away", explain: `${a} − ${b} = ${a - b}` });
    }
    const a = randInt(rng, 11, 25), b = randInt(rng, 3, 9);
    return makeChoice(rng, `${a} × ${b} = ?`, String(a * b), nearNumbers(rng, a * b, 12, false), { topic: "Big times", explain: `${a} × ${b} = ${a * b}` });
  }
  // teens
  if (level === 1) {
    const p = pick(rng, [10, 20, 25, 50]);
    const n = pick(rng, [40, 60, 80, 100, 120, 200]);
    const ans = (n * p) / 100;
    return makeChoice(rng, `What is ${p}% of ${n}?`, String(ans), nearNumbers(rng, ans, Math.max(3, Math.round(ans / 4)), false), { topic: "Percentages", explain: `${p}% of ${n} = ${n} × ${p} ÷ 100 = ${ans}` });
  }
  if (level === 2) {
    const a = randInt(rng, -12, 12), b = randInt(rng, -12, 12);
    if (rng() < 0.6) {
      const sign = b < 0 ? `(${b})` : String(b);
      return makeChoice(rng, `${a} + ${sign} = ?`, String(a + b), nearNumbers(rng, a + b, 4, true), { topic: "Negative numbers", explain: `${a} + ${sign} = ${a + b}` });
    }
    const c = randInt(rng, 2, 9), d = randInt(rng, -9, 9);
    const dd = d < 0 ? `(${d})` : String(d);
    return makeChoice(rng, `${c} × ${dd} = ?`, String(c * d), nearNumbers(rng, c * d, 5, true), { topic: "Negative numbers", explain: `${c} × ${dd} = ${c * d}` });
  }
  const x = randInt(rng, 2, 12), a = randInt(rng, 2, 9), b = randInt(rng, 1, 15);
  return makeChoice(rng, `Solve for x:  ${a}x + ${b} = ${a * x + b}`, String(x), nearNumbers(rng, x, 3, false), { topic: "Algebra", explain: `${a * x + b} − ${b} = ${a * x}, then ${a * x} ÷ ${a} = ${x}` });
}

export const makeMathRound = (age: AgeId, level: Level, rng: Rng, count = 10): Choice[] =>
  Array.from({ length: count }, () => makeMathQuestion(age, level, rng));

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

export function makeSpellingRound(age: AgeId, level: Level, rng: Rng, count = 8): Choice[] {
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

export function makeQuizRound(age: AgeId, rng: Rng, count = 8): Choice[] {
  return shuffle(rng, QUIZ[age]).slice(0, count).map(item => makeChoice(rng, item.q, item.a, item.wrong, { topic: item.topic, explain: item.explain ?? `The answer is ${item.a}.` }));
}
export const quizBankSize = (age: AgeId) => QUIZ[age].length;
/** Exposed for tests: every quiz item with its right answer. */
export const quizBank = (age: AgeId) => QUIZ[age].map(({ q, a, wrong }) => ({ q, a, wrong }));

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

export function makePatternQuestion(age: AgeId, level: Level, rng: Rng): Choice {
  if (age === "kids") {
    const [a, b, c, d] = shuffle(rng, SHAPES);
    const templates = level === 1 ? [[a, b, a, b, a, b], [a, a, b, a, a, b]] : level === 2 ? [[a, b, c, a, b, c], [a, a, b, b, a, a]] : [[a, b, c, d, a, b, c], [a, b, b, a, b, b, a]];
    const seq = pick(rng, templates);
    const unit = (s: string[]) => s;
    const full = unit(seq);
    // next item continues the repeating unit
    const period = (() => { for (let p = 2; p <= 4; p++) if (full.every((x, i) => x === full[i % p])) return p; return 3; })();
    const next = full[full.length % period];
    return makeChoice(rng, `${full.join(" ")} ?`, next, [a, b, c, d].filter(s => s !== next), { topic: "What comes next?", explain: `The pattern repeats, so ${next} comes next.` });
  }
  if (age === "tweens") {
    const step = randInt(rng, 2, level === 1 ? 5 : level === 2 ? 9 : 15);
    const down = level >= 2 && rng() < 0.4;
    const start = randInt(rng, 1, 20) + (down ? step * 5 : 0);
    const seq = Array.from({ length: 5 }, (_, i) => start + (down ? -step : step) * i);
    const next = start + (down ? -step : step) * 5;
    return makeChoice(rng, `${seq.join(", ")}, ?`, String(next), nearNumbers(rng, next, 4, true), { topic: "Number patterns", explain: `It goes ${down ? "down" : "up"} by ${step} each time, so the next number is ${next}.` });
  }
  if (level === 1) {
    const m = pick(rng, [2, 3]), start = randInt(rng, 1, 4);
    const seq = Array.from({ length: 5 }, (_, i) => start * m ** i);
    const next = start * m ** 5;
    return makeChoice(rng, `${seq.join(", ")}, ?`, String(next), [String(next + m), String(next - m), String(next + start)], { topic: "Growing patterns", explain: `Each number is ${m} times the one before, so the next is ${next}.` });
  }
  if (level === 2) {
    const offset = randInt(rng, 0, 3);
    const seq = Array.from({ length: 5 }, (_, i) => (i + 1 + offset) ** 2);
    const next = (6 + offset) ** 2;
    return makeChoice(rng, `${seq.join(", ")}, ?`, String(next), nearNumbers(rng, next, 8, false), { topic: "Square numbers", explain: `These are square numbers, so the next is ${6 + offset} × ${6 + offset} = ${next}.` });
  }
  const a = randInt(rng, 1, 4), b = randInt(rng, 2, 6);
  const seq = [a, b];
  while (seq.length < 6) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
  const next = seq[4] + seq[5];
  return makeChoice(rng, `${seq.join(", ")}, ?`, String(next), nearNumbers(rng, next, 5, false), { topic: "Fibonacci-style", explain: `Add the last two numbers: ${seq[4]} + ${seq[5]} = ${next}.` });
}

export const makePatternRound = (age: AgeId, level: Level, rng: Rng, count = 8): Choice[] =>
  Array.from({ length: count }, () => makePatternQuestion(age, level, rng));
