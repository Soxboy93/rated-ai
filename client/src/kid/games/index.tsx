import { useCallback } from "react";
import { makeMathRound, makePatternRound, makeQuizRound, makeSpellingRound, type AgeId, type Level } from "@shared/games";
import { makeRng } from "@shared/rng";
import RoundGame from "./RoundGame";
import Memory from "./Memory";

type Rng = ReturnType<typeof makeRng>;

export const MathGame = () => <RoundGame game="math" makeRound={useCallback((a: AgeId, l: Level, r: Rng) => makeMathRound(a, l, r, 10), [])} levelNames={["Easy", "Medium", "Tricky"]} />;
export const SpellingGame = () => <RoundGame game="spelling" autoSpeak needsSpeech makeRound={useCallback((a: AgeId, l: Level, r: Rng) => makeSpellingRound(a, l, r, 8), [])} levelNames={["Short words", "Medium words", "Long words"]} />;
export const QuizGame = () => <RoundGame game="quiz" makeRound={useCallback((a: AgeId, _l: Level, r: Rng) => makeQuizRound(a, r, 8), [])} levelNames={["Round 1", "Round 2", "Round 3"]} />;
export const PatternGame = () => <RoundGame game="patterns" makeRound={useCallback((a: AgeId, l: Level, r: Rng) => makePatternRound(a, l, r, 8), [])} levelNames={["Easy", "Medium", "Tricky"]} />;
export { Memory as MemoryGame };
