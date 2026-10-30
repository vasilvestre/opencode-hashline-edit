# @vasilvestre/opencode-hashline-edit

LINE#ID edit tool for OpenCode v2 — safe, hash-validated line-based file editing.

## Features

- **LINE#ID addressing**: Each line identified by `line#hash` (e.g., `42#ZP`)
- **Hash validation**: Prevents editing stale content — rejects if file changed
- **Three operations**: `replace` (single/range), `append`, `prepend`
- **Atomic batching**: Multiple edits sorted bottom-up, applied atomically
- **Safety**: Overlap detection, no-op detection, deduplication
- **Formatters**: Auto-runs configured formatters after write
- **OpenCode v2 native**: Uses `/api/fs/read` and `/api/experimental/fs/write`

## Installation

```bash
npm install @vasilvestre/opencode-hashline-edit
```

## Usage

```typescript
// In your OpenCode plugin
import { createHashlineEditTool } from "@vasilvestre/opencode-hashline-edit"

const plugin = definePlugin({
  name: "my-plugin",
  tools: {
    hashline_edit: createHashlineEditTool(),
  },
})
```

## LINE#ID Format

When you read a file, each line shows its LINE#ID:
```
const x = 1          1#ZP
function foo() {     2#AB
  return x + 1       3#CD
}                    4#EF
```

## Edit Examples

### Replace single line
```json
{ "op": "replace", "pos": "2#AB", "lines": "function bar() {" }
```

### Replace range
```json
{ "op": "replace", "pos": "2#AB", "end": "3#CD", "lines": ["function bar() {", "  return 42", "}"] }
```

### Append after line
```json
{ "op": "append", "pos": "4#EF", "lines": "// new comment" }
```

### Prepend before line
```json
{ "op": "prepend", "pos": "1#ZP", "lines": "// header comment" }
```

### Delete file
```json
{ "delete": true, "edits": [] }
```

## Safety Features

- **Hash validation**: Content hash verified before every edit
- **Overlap detection**: Rejects overlapping ranges
- **Deduplication**: Removes duplicate edits automatically
- **No-op detection**: Reports edits that produce no changes
- **Bottom-up application**: Line numbers stay valid during batch edits

## API

### `createHashlineEditTool(pluginCtx?)`
Creates the tool definition for OpenCode plugin system.

```typescript
import { createHashlineEditTool } from "@vasilvestre/opencode-hashline-edit"

const tool = createHashlineEditTool({
  client: opencodeApiClient, // for formatters
})
```

### Types
```typescript
import type { RawHashlineEdit, HashlineEdit, HashlineApplyReport } from "@vasilvestre/opencode-hashline-edit"
```

## License

MIT