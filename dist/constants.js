/**
 * Hashline constants - ported from @oh-my-opencode/hashline-core
 * LINE#ID format: line number + 2-char content hash (configurable 2-4)
 */
export const NIBBLE_STR = "ZPMQVRWSNKTXJBYH";
export const DEFAULT_HASH_LENGTH = 2;
export const MIN_HASH_LENGTH = 2;
export const MAX_HASH_LENGTH = 4;
export function buildHashDict(hashLength) {
    const dict = [];
    const combinations = Math.pow(16, hashLength);
    for (let i = 0; i < combinations; i++) {
        let hash = "";
        let value = i;
        for (let j = 0; j < hashLength; j++) {
            hash = NIBBLE_STR[value & 0x0f] + hash;
            value >>>= 4;
        }
        dict.push(hash);
    }
    return dict;
}
export const HASHLINE_DICT_2 = buildHashDict(2);
export function buildRefPattern(hashLength) {
    return new RegExp(`^([0-9]+)#([${NIBBLE_STR}]{${hashLength}})$`);
}
export function buildOutputPattern(hashLength) {
    return new RegExp(`^([0-9]+)#([${NIBBLE_STR}]{${hashLength}})\\|(.*)$`);
}
export const HASHLINE_REF_PATTERN = buildRefPattern(DEFAULT_HASH_LENGTH);
export const HASHLINE_OUTPUT_PATTERN = buildOutputPattern(DEFAULT_HASH_LENGTH);
export const DEFAULT_CONFIG = {
    hashLength: DEFAULT_HASH_LENGTH,
    grep: false,
    replaceText: true,
};
//# sourceMappingURL=constants.js.map