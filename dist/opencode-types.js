/**
 * Minimal OpenCode types - shim for plugin development
 */
// Minimal tool factory
const self = {
    schema: {
        string: () => {
            const schema = {
                describe: (desc) => self.schema.string(),
                optional: () => self.schema.string(),
            };
            return schema;
        },
        boolean: () => {
            const schema = {
                describe: (desc) => self.schema.boolean(),
                optional: () => self.schema.boolean(),
            };
            return schema;
        },
        array: (schema) => ({
            describe: (desc) => self.schema.array(schema),
        }),
        object: (shape) => ({
            describe: (desc) => self.schema.object(shape),
        }),
        union: (schemas) => ({
            describe: (desc) => self.schema.union(schemas),
        }),
        literal: (value) => ({
            describe: (desc) => self.schema.literal(value),
        }),
    },
    tool: (config) => config,
};
export const tool = self;
//# sourceMappingURL=opencode-types.js.map