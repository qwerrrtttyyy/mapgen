/**
 * High-performance connected components labeling using Two-Pass algorithm
 * with Union-Find (Disjoint Set Union) with path compression and union by rank.
 *
 * Reference: "A linear-time component-labeling algorithm using contour tracing technique"
 * and the standard Rosenfeld-Pfaltz two-pass algorithm optimized with DSU.
 */
export interface ComponentStats {
    id: number;
    area: number;
    sumX: number;
    sumY: number;
    label: number;
}
/**
 * Label connected components using Two-Pass algorithm with Union-Find.
 * 4-connectivity (up, down, left, right).
 *
 * @param width - image width in pixels
 * @param height - image height in pixels
 * @param shouldLabel - predicate function(i) returning true if pixel i is foreground
 * @param areConnected - predicate function(i, j) returning true if pixels i and j should be in the same component
 * @returns Int32Array of component labels (0 = background/unlabeled), and number of unique components
 */
export declare function labelComponents(width: number, height: number, shouldLabel: (i: number) => boolean, areConnected: (i: number, j: number) => boolean): {
    labels: Int32Array;
    count: number;
};
/**
 * Compute per-component statistics (area, centroid numerators) from a label array.
 * Returns a map from component ID to stats, plus the background label (0) is skipped.
 */
export declare function computeComponentStats(width: number, height: number, labels: Int32Array): Map<number, ComponentStats>;
/**
 * High-performance flood fill using a pre-allocated typed-array stack.
 * Significantly faster than JS Array push/pop for large regions.
 *
 * @param startIdx starting pixel index
 * @param width image width
 * @param height image height
 * @param visited Uint8Array marking visited pixels (modified in-place)
 * @param shouldVisit predicate(i) returning true if pixel i should be included
 * @param onVisit callback(i, x, y) called for each visited pixel
 */
export declare function fastFloodFill(startIdx: number, width: number, height: number, visited: Uint8Array, shouldVisit: (i: number) => boolean, onVisit: (i: number, x: number, y: number) => void): number;
