/**
 * Read-side anchors: the tool description promises that every line the model
 * reads carries its LINE#ID, so the anchors must be added to the read output.
 * The hash covers the line and its neighbours, so it is computed against the
 * whole file, not against the window the read returned.
 */
export declare function tagReadContent(readContent: string, fileContent: string, hashLength?: number): string;
//# sourceMappingURL=read-anchors.d.ts.map