import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const {
  actionVar,
  actionPre,
  actionRaw,
  actionBase64,
  actionB64Var,
  actionRep
} = await import('../src/actions.js')

afterEach(() => jest.resetAllMocks())

const KV: Record<string, string> = { password: 'secret123', user: 'admin' }

describe('actionVar', () => {
  it('exports masked variable', () => {
    actionVar(KV, 'password', 'DB_PASS')
    expect(core.setSecret).toHaveBeenCalledWith('secret123')
    expect(core.exportVariable).toHaveBeenCalledWith('DB_PASS', 'secret123')
  })

  it('throws on missing field', () => {
    expect(() => actionVar(KV, 'missing', 'OUT')).toThrow('Field "missing"')
  })

  it('throws on plain text secret', () => {
    expect(() => actionVar('plain text', 'key', 'OUT')).toThrow('KV secret')
  })
})

describe('actionPre', () => {
  it('exports all KV keys with prefix', () => {
    actionPre(KV, 'DB')
    expect(core.exportVariable).toHaveBeenCalledWith('DB_password', 'secret123')
    expect(core.exportVariable).toHaveBeenCalledWith('DB_user', 'admin')
    expect(core.setSecret).toHaveBeenCalledTimes(2)
  })

  it('throws on plain text secret', () => {
    expect(() => actionPre('plain', 'PREFIX')).toThrow('KV secret')
  })
})

describe('actionRaw', () => {
  it('writes KV field to temp file', () => {
    actionRaw(KV, 'password', 'OUT')
    const calls = (core.exportVariable as jest.Mock).mock.calls as [
      string,
      string
    ][]
    const [varName, filePath] = calls[0]
    expect(varName).toBe('OUT')
    expect(fs.existsSync(filePath)).toBe(true)
    expect(fs.readFileSync(filePath, 'utf8')).toBe('secret123')
    fs.unlinkSync(filePath)
  })

  it('writes plain text to temp file', () => {
    actionRaw('plain secret', '', 'OUT')
    const calls = (core.exportVariable as jest.Mock).mock.calls as [
      string,
      string
    ][]
    const [, filePath] = calls[0]
    expect(fs.readFileSync(filePath, 'utf8')).toBe('plain secret')
    fs.unlinkSync(filePath)
  })
})

describe('actionBase64', () => {
  it('decodes base64 JSON field and writes to temp file', () => {
    const encoded = Buffer.from('decoded content').toString('base64')
    actionBase64({ data: encoded }, 'data', 'OUT')
    const calls = (core.exportVariable as jest.Mock).mock.calls as [
      string,
      string
    ][]
    const [, filePath] = calls[0]
    expect(fs.readFileSync(filePath, 'utf8')).toBe('decoded content')
    fs.unlinkSync(filePath)
  })

  it('decodes plaintext base64 secret and writes to temp file', () => {
    const encoded = Buffer.from('plain decoded').toString('base64')
    actionBase64(encoded, '*', 'OUT')
    const calls = (core.exportVariable as jest.Mock).mock.calls as [
      string,
      string
    ][]
    const [, filePath] = calls[0]
    expect(fs.readFileSync(filePath, 'utf8')).toBe('plain decoded')
    fs.unlinkSync(filePath)
  })
})

describe('actionB64Var', () => {
  it('decodes base64 and exports masked variable', () => {
    const encoded = Buffer.from('my-secret').toString('base64')
    actionB64Var({ token: encoded }, 'token', 'TOKEN')
    expect(core.setSecret).toHaveBeenCalledWith('my-secret')
    expect(core.exportVariable).toHaveBeenCalledWith('TOKEN', 'my-secret')
  })
})

describe('actionRep', () => {
  it('replaces __KEY__ placeholders in template', () => {
    const tplPath = path.join(os.tmpdir(), `test-tpl-${Date.now()}.txt`)
    fs.writeFileSync(tplPath, 'host=__host__ pass=__password__')
    actionRep({ host: 'localhost', password: 'abc' }, tplPath, 'OUT')
    const calls = (core.exportVariable as jest.Mock).mock.calls as [
      string,
      string
    ][]
    const [, outPath] = calls[0]
    expect(fs.readFileSync(outPath, 'utf8')).toBe('host=localhost pass=abc')
    fs.unlinkSync(tplPath)
    fs.unlinkSync(outPath)
  })

  it('throws when template file missing', () => {
    expect(() => actionRep(KV, '/nonexistent/file.txt', 'OUT')).toThrow(
      'Template file not found'
    )
  })

  it('throws on plain text secret', () => {
    expect(() => actionRep('plain', '/some/file', 'OUT')).toThrow('KV secret')
  })
})
