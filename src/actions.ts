import * as core from '@actions/core'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { randomUUID } from 'crypto'

function tempFile(varName: string): string {
  const dir = process.env.RUNNER_TEMP ?? os.tmpdir()
  return path.join(dir, `aws-sm-${varName}-${randomUUID()}`)
}

function writeTemp(filePath: string, content: string | Buffer): void {
  fs.writeFileSync(filePath, content)
  if (process.platform !== 'win32') {
    fs.chmodSync(filePath, 0o400)
  }
}

function requireKV(
  secret: Record<string, string> | string,
  type: string
): Record<string, string> {
  if (typeof secret === 'string') {
    throw new Error(`Action "${type}" requires a KV secret but got plain text`)
  }
  return secret
}

function requireField(
  kv: Record<string, string>,
  field: string,
  type: string
): string {
  const val = kv[field]
  if (val === undefined) {
    throw new Error(`Field "${field}" not found in secret (action: ${type})`)
  }
  return String(val)
}

export function actionVar(
  secret: Record<string, string> | string,
  field: string,
  outputVar: string
): void {
  const kv = requireKV(secret, 'var')
  const value = requireField(kv, field, 'var')
  core.setSecret(value)
  core.exportVariable(outputVar, value)
}

export function actionPre(
  secret: Record<string, string> | string,
  outputVar: string
): void {
  const kv = requireKV(secret, 'pre')
  for (const [k, v] of Object.entries(kv)) {
    const value = String(v)
    core.setSecret(value)
    core.exportVariable(`${outputVar}_${k}`, value)
  }
}

export function actionRaw(
  secret: Record<string, string> | string,
  field: string,
  outputVar: string
): void {
  let content: string
  if (typeof secret === 'string') {
    content = secret
  } else {
    content = requireField(secret, field, 'raw')
  }
  const filePath = tempFile(outputVar)
  writeTemp(filePath, content)
  core.exportVariable(outputVar, filePath)
}

export function actionBase64(
  secret: Record<string, string> | string,
  field: string,
  outputVar: string
): void {
  let encoded: string
  if (typeof secret === 'string') {
    encoded = secret
  } else {
    encoded = requireField(secret, field, 'base64')
  }
  const decoded = Buffer.from(encoded, 'base64')
  const filePath = tempFile(outputVar)
  writeTemp(filePath, decoded)
  core.exportVariable(outputVar, filePath)
}

export function actionB64Var(
  secret: Record<string, string> | string,
  field: string,
  outputVar: string
): void {
  const kv = requireKV(secret, 'b64var')
  const encoded = requireField(kv, field, 'b64var')
  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  core.setSecret(decoded)
  core.exportVariable(outputVar, decoded)
}

export function actionRep(
  secret: Record<string, string> | string,
  templateFile: string,
  outputVar: string
): void {
  const kv = requireKV(secret, 'rep')
  if (!fs.existsSync(templateFile)) {
    throw new Error(`Template file not found: ${templateFile}`)
  }
  let content = fs.readFileSync(templateFile, 'utf8')
  for (const [k, v] of Object.entries(kv)) {
    const re = new RegExp(`__${k}__`, 'g')
    content = content.replace(re, String(v))
  }
  const filePath = tempFile(outputVar)
  writeTemp(filePath, content)
  core.exportVariable(outputVar, filePath)
}
