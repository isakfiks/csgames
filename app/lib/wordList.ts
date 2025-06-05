import { promises as fs } from 'fs';
import path from 'path';

let VALID_GUESSES: Set<string>;

export async function initializeWordList() {
    if (VALID_GUESSES) return VALID_GUESSES;
    try {
        let text;
        if (typeof window === 'undefined') {
            const filePath = path.join(process.cwd(), 'public', 'words.txt');
            text = await fs.readFile(filePath, 'utf-8');
        } else {
            const response = await fetch('/words.txt', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Failed to fetch words.txt: ${response.status} ${response.statusText}`);
            }
            text = await response.text();
        }
        VALID_GUESSES = new Set(text.split('\n').filter(word => word.trim()).map(word => word.trim()));
    } catch (error) {
        console.error('Failed to load word list:', error);
        // Fallback (it will likely never get here tho)
        VALID_GUESSES = new Set([
            "about", "above", "abuse", "actor", "acute",
            "admit", "adopt", "adult", "after", "again",
            "agent", "agree", "ahead", "alarm", "album",
            "alert", "alike", "alive", "allow", "alone",
            "along", "alter", "among", "anger", "angle",
            "angry", "apart", "apple", "apply", "arena",
            "argue", "arise", "array", "aside", "asset",
            "audio", "audit", "avoid", "award", "aware",
            "badly", "baker", "bases", "basic", "basis",
            "beach", "began", "begin", "begun", "being",
            "below", "bench", "billy", "birth", "black",
            "blame", "blind", "block", "blood", "board",
            "boost", "booth", "bound", "brain", "brand",
            "bread", "break", "breed", "brief", "bring",
            "broad", "broke", "brown", "build", "built",
            "buyer", "cable", "calif", "carry", "catch",
            "cause", "chain", "chair", "chart", "chase",
            "cheap", "check", "chest", "chief", "child",
            "china", "chose", "civil", "claim", "class",
            "clean", "clear", "click", "clock", "close",
        ]);
    }
    return VALID_GUESSES;
}

export function getValidGuesses() {
    if (!VALID_GUESSES) {
        throw new Error('Word list not initialized.');
    }
    return VALID_GUESSES;
}

