import * as core from '@actions/core'
import * as fs from 'fs'
import {
  isComment,
  isMessage,
  parseVarAssign,
  parseActionLine,
  parseSecretRef,
  substituteVars
} from './parser.js'
import { getSecret, parseSecretValue } from './aws.js'
import {
  actionVar,
  actionPre,
  actionRaw,
  actionBase64,
  actionB64Var,
  actionRep
} from './actions.js'

export async function run(): Promise<void> {
  try {
    const sourceType = core.getInput('source-type', { required: true })
    const defaultRegion = core.getInput('region') || undefined

    let instructions: string
    if (sourceType === 'inline') {
      instructions = core.getInput('data', { required: true })
    } else if (sourceType === 'file-path') {
      const filePath = core.getInput('data-file', { required: true })
      if (!fs.existsSync(filePath)) {
        core.setFailed(`data-file not found: ${filePath}`)
        return
      }
      instructions = fs.readFileSync(filePath, 'utf8')
    } else {
      core.setFailed(
        `Invalid source-type: "${sourceType}". Use "inline" or "file-path".`
      )
      return
    }

    const vars: Record<string, string> = {}
    let currentRegion: string | undefined = defaultRegion

    const lines = instructions.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const line = raw.trim()
      const lineNum = i + 1

      if (!line || isComment(line)) continue

      if (isMessage(line)) {
        core.info(line.slice(1).trim())
        continue
      }

      const varAssign = parseVarAssign(line)
      if (varAssign) {
        if (varAssign.key === 'region') {
          currentRegion = varAssign.value
          core.debug(`region set to ${currentRegion}`)
        } else {
          // ISSUE: Hardcoded Secrets in Logs
          // Mask the variable value just in case it contains sensitive information,
          // preventing it from appearing in any subsequent logs.
          core.setSecret(varAssign.value)
          vars[varAssign.key] = varAssign.value
          core.debug(`var set: ${varAssign.key}`)
        }
        continue
      } else if (line.includes('<=')) {
        core.setFailed(
          `Line ${lineNum}: Invalid variable assignment syntax. Variable names must start with a letter and contain only alphanumeric characters or underscores.`
        )
        continue
      }

      const action = parseActionLine(line)
      if (!action) {
        core.warning(`Line ${lineNum}: unrecognised — skipped`)
        continue
      }

      const secretRefStr = substituteVars(action.secretRef, vars)
      const keyStr = substituteVars(action.key, vars)
      const ref = parseSecretRef(secretRefStr)
      const region = ref.region ?? currentRegion

      if (!region) {
        core.setFailed(
          `Line ${lineNum}: no region set. Provide the "region" input, set "region <= <value>" before this line, or use "@region" suffix on the secret name.`
        )
        return
      }

      core.debug(
        `Line ${lineNum}: ${action.type} ${ref.name}@${region} => ${action.outputVar}`
      )

      let rawSecret: string
      try {
        rawSecret = await getSecret(ref.name, region)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        core.setFailed(
          `Line ${lineNum}: failed to fetch secret "${ref.name}": ${msg}`
        )
        return
      }

      const secret = parseSecretValue(rawSecret)

      try {
        switch (action.type) {
          case 'var':
            actionVar(secret, keyStr, action.outputVar)
            break
          case 'pre':
            actionPre(secret, action.outputVar)
            break
          case 'raw':
            actionRaw(secret, keyStr, action.outputVar)
            break
          case 'base64':
            actionBase64(secret, keyStr, action.outputVar)
            break
          case 'b64var':
            actionB64Var(secret, keyStr, action.outputVar)
            break
          case 'rep':
            actionRep(secret, keyStr, action.outputVar)
            break
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        core.setFailed(`Line ${lineNum}: ${action.type} failed: ${msg}`)
        return
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
