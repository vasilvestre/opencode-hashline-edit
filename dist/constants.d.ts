/**
 * Hashline constants - ported from @oh-my-opencode/hashline-core
 * LINE#ID format: line number + 2-char content hash (configurable 2-4)
 */
export declare const NIBBLE_STR = "ZPMQVRWSNKTXJBYH";
export declare const DEFAULT_HASH_LENGTH = 2;
export declare const MIN_HASH_LENGTH = 2;
export declare const MAX_HASH_LENGTH = 4;
export declare function buildHashDict(hashLength: number): string[];
export declare const HASHLINE_DICT_2: string[];
export declare function buildRefPattern(hashLength: number): RegExp;
export declare function buildOutputPattern(hashLength: number): RegExp;
export declare const HASHLINE_REF_PATTERN: RegExp;
export declare const HASHLINE_OUTPUT_PATTERN: RegExp;
export interface HashlineConfig {
    hashLength: number;
    grep: boolean;
    replaceText: boolean;
}
export declare const DEFAULT_CONFIG: HashlineConfig;
//# sourceMappingURL=constants.d.ts.map