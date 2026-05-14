export type ActionType = 'var' | 'pre' | 'raw' | 'base64' | 'b64var' | 'rep'

export interface ActionLine {
  type: ActionType
  secretRef: string
  key: string
  outputVar: string
}

export interface SecretRef {
  name: string
  region?: string
}

export interface VarAssign {
  key: string
  value: string
}

export function isComment(line: string): boolean {
  return line.trimStart().startsWith('#')
}

export function isMessage(line: string): boolean {
  return line.trimStart().startsWith('@')
}

export function parseVarAssign(line: string): VarAssign | null {
  const match = line.match(/^([a-zA-Z][a-zA-Z0-9_]*)\s*<=\s*(.+)$/)
  if (!match) return null
  return { key: match[1], value: match[2].trim() }
}

export function parseActionLine(line: string): ActionLine | null {
  const match = line.match(
    /^(var|pre|raw|base64|b64var|rep)\s*=>\s*(.*?)\s*=>\s*(.*?)\s*=>\s*([a-zA-Z][a-zA-Z0-9._]*)$/
  )
  if (!match) return null
  return {
    type: match[1] as ActionType,
    secretRef: match[2].trim(),
    key: match[3].trim(),
    outputVar: match[4].trim()
  }
}

export function parseSecretRef(ref: string): SecretRef {
  const atIdx = ref.lastIndexOf('@')
  if (atIdx === -1) return { name: ref }
  return { name: ref.slice(0, atIdx), region: ref.slice(atIdx + 1) }
}

export function substituteVars(
  str: string,
  vars: Record<string, string>
): string {
  let result = str
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(`{${key}}`).join(value)
  }
  return result
}
