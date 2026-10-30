/**
 * Minimal OpenCode types - shim for plugin development
 */

export interface Response {
  ok: boolean
  json(): Promise<any>
}

export interface ToolContext {
  directory: string
  api: {
    get: (path: string) => Promise<Response>
    post: (path: string, options: { body: string }) => Promise<Response>
    delete: (path: string, options: { body: string }) => Promise<Response>
  }
  metadata?: (value: unknown) => void
}

export interface PluginContext {
  client?: FormatterClient
}

export interface FormatterClient {
  api: {
    post: (path: string, data: unknown) => Promise<unknown>
  }
}

export interface StringSchema {
  describe(desc: string): StringSchema
  optional(): StringSchema
}

export interface BooleanSchema {
  describe(desc: string): BooleanSchema
  optional(): BooleanSchema
}

export interface NumberSchema {
  describe(desc: string): NumberSchema
  optional(): NumberSchema
}

export interface ArraySchema<T extends ToolSchema = ToolSchema> {
  describe(desc: string): ArraySchema<T>
  optional(): ArraySchema<T>
}

export interface ObjectSchema<T extends Record<string, ToolSchema> = Record<string, ToolSchema>> {
  describe(desc: string): ObjectSchema<T>
  optional(): ObjectSchema<T>
}

export interface UnionSchema<T extends ToolSchema[] = ToolSchema[]> {
  describe(desc: string): UnionSchema<T>
  optional(): UnionSchema<T>
}

export interface LiteralSchema<T extends string | number | boolean = string | number | boolean> {
  describe(desc: string): LiteralSchema<T>
}

export type ToolSchema = StringSchema | BooleanSchema | NumberSchema | ArraySchema | ObjectSchema | UnionSchema | LiteralSchema

export interface ToolDefinition {
  description: string
  args: Record<string, ToolSchema>
  execute: (args: any, context: ToolContext, pluginCtx?: PluginContext) => Promise<string>
}

// Minimal tool factory
const self = {
  schema: {
    string: (): StringSchema => {
      const schema: StringSchema = {
        describe: (desc: string) => self.schema.string(),
        optional: () => self.schema.string(),
      }
      return schema
    },
    boolean: (): BooleanSchema => {
      const schema: BooleanSchema = {
        describe: (desc: string) => self.schema.boolean(),
        optional: () => self.schema.boolean(),
      }
      return schema
    },
    number: (): NumberSchema => {
      const schema: NumberSchema = {
        describe: (desc: string) => self.schema.number(),
        optional: () => self.schema.number(),
      }
      return schema
    },
    array: <T extends ToolSchema>(schema: T): ArraySchema<T> => ({
      describe: (desc: string) => self.schema.array(schema),
      optional: () => self.schema.array(schema),
    }),
    object: <T extends Record<string, ToolSchema>>(shape: T): ObjectSchema<T> => ({
      describe: (desc: string) => self.schema.object(shape),
      optional: () => self.schema.object(shape),
    }),
    union: <T extends ToolSchema[]>(schemas: T): UnionSchema<T> => ({
      describe: (desc: string) => self.schema.union(schemas),
      optional: () => self.schema.union(schemas),
    }),
    literal: <T extends string | number | boolean>(value: T): LiteralSchema<T> => ({
      describe: (desc: string) => self.schema.literal(value),
    }),
  },
  tool: <TArgs extends Record<string, ToolSchema>>(config: {
    description: string
    args: TArgs
    execute: (args: any, context: ToolContext, pluginCtx?: PluginContext) => Promise<string>
  }): ToolDefinition => config,
} as const

export interface ToolDefinition {
  description: string
  args: Record<string, ToolSchema>
  execute: (args: any, context: ToolContext, pluginCtx?: PluginContext) => Promise<string>
}

export const tool = self