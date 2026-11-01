// Types for uomWords.js (plain JS so the Node prerender script can import it too).

/** The singular word for a Riseller unit code ("PKT" -> "packet"), or null when none is recorded. */
export declare function unitWord(code: string | null | undefined): string | null;
/** "packet" -> "packets"; units like kg keep the same word. */
export declare function pluralUnit(word: string, count: number): string;
/** Rewrites "Sold per pkt" in generated descriptions as "Sold per packet". */
export declare function readableSoldPer(text: string | null | undefined): string;
/** "25 packets", "1 packet", "3 kg". */
export declare function countUnits(count: number | string | null | undefined, word: string): string;
