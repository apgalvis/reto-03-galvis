export type ToolSuccess<T> = { ok: true; data: T }
export type ToolFailure = { ok: false; error: string }
export type ToolResult<T> = ToolSuccess<T> | ToolFailure

export function ok<T>(data: T): ToolSuccess<T> {
  return { ok: true, data }
}

export function fail(error: string): ToolFailure {
  return { ok: false, error }
}
