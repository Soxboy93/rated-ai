import { useCallback } from "react";
import { makeMathRound, makeQuizRound, makeSpellingRound, type AgeId, type Level } from "@shared/games";
import { makeRng } from "@shared/rng";
import RoundGame from "./RoundGame";
import { currentLang, T } from "@/i18n";

type Rng = ReturnType<typeof makeRng>;

export const MathGame = () => <RoundGame game="math" makeRound={useCallback((a: AgeId, l: Level, r: Rng) => makeMathRound(a, l, r, 10, currentLang()), [])} levelNames={[T("Easy"), T("Medium"), T("Tricky")]} />;
export const SpellingGame = () => <RoundGame game="spelling" autoSpeak needsSpeech makeRound={useCallback((a: AgeId, l: Level, r: Rng) => makeSpellingRound(a, l, r, 8, currentLang()), [])} levelNames={[T("Short words"), T("Medium words"), T("Long words")]} />;
export const QuizGame = () => <RoundGame game="quiz" makeRound={useCallback((a: AgeId, _l: Level, r: Rng) => makeQuizRound(a, r, 8, currentLang()), [])} levelNames={[T("Round 1"), T("Round 2"), T("Round 3")]} />;
