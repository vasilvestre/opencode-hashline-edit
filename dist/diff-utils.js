/**
 * Diff utilities - generates unified diff and counts line changes
 */
export function countLineDiffs(before, after) {
    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");
    // Simple LCS-based diff
    const dp = Array(beforeLines.length + 1)
        .fill(null)
        .map(() => Array(afterLines.length + 1).fill(0));
    for (let i = 1; i <= beforeLines.length; i++) {
        for (let j = 1; j <= afterLines.length; j++) {
            if (beforeLines[i - 1] === afterLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    let additions = 0;
    let deletions = 0;
    let i = beforeLines.length;
    let j = afterLines.length;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
            i--;
            j--;
        }
        else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            additions++;
            j--;
        }
        else {
            deletions++;
            i--;
        }
    }
    return { additions, deletions };
}
export function generateUnifiedDiff(before, after, filePath) {
    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");
    const diffLines = [];
    diffLines.push(`--- a/${filePath}`);
    diffLines.push(`+++ b/${filePath}`);
    // Simple unified diff generation
    let i = 0;
    let j = 0;
    while (i < beforeLines.length || j < afterLines.length) {
        if (i < beforeLines.length && j < afterLines.length && beforeLines[i] === afterLines[j]) {
            i++;
            j++;
            continue;
        }
        // Find matching lines ahead
        let matchFound = false;
        for (let lookahead = 1; lookahead <= 3 && !matchFound; lookahead++) {
            if (i + lookahead <= beforeLines.length && j + lookahead <= afterLines.length) {
                let match = true;
                for (let k = 0; k < lookahead; k++) {
                    if (beforeLines[i + k] !== afterLines[j + k]) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    matchFound = true;
                    // Output changes before the match
                    if (i < beforeLines.length || j < afterLines.length) {
                        const startBefore = i + 1;
                        const endBefore = i;
                        const startAfter = j + 1;
                        const endAfter = j + lookahead - 1;
                        diffLines.push(`@@ -${startBefore},${endBefore - startBefore + 1} +${startAfter},${endAfter - startAfter + 1} @@`);
                        for (let k = i; k < i + lookahead; k++) {
                            if (k < beforeLines.length && (j + k - i) >= afterLines.length || beforeLines[k] !== afterLines[j + k - i]) {
                                diffLines.push(`-${beforeLines[k]}`);
                            }
                        }
                        for (let k = j; k < j + lookahead; k++) {
                            if (k < afterLines.length && (i + k - j) >= beforeLines.length || afterLines[k] !== beforeLines[i + k - j]) {
                                diffLines.push(`+${afterLines[k]}`);
                            }
                        }
                    }
                    i += lookahead;
                    j += lookahead;
                    break;
                }
            }
        }
        if (!matchFound) {
            // Output remaining as changes
            if (i < beforeLines.length) {
                diffLines.push(`@@ -${i + 1},${beforeLines.length - i} +${j + 1},${afterLines.length - j} @@`);
                while (i < beforeLines.length) {
                    diffLines.push(`-${beforeLines[i]}`);
                    i++;
                }
                while (j < afterLines.length) {
                    diffLines.push(`+${afterLines[j]}`);
                    j++;
                }
            }
            break;
        }
    }
    return diffLines.join("\n");
}
//# sourceMappingURL=diff-utils.js.map