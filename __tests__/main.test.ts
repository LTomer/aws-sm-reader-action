import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/aws.js', () => ({
  getSecret: jest.fn<() => Promise<string>>(),
  parseSecretValue: jest.fn<(s: string) => Record<string, string> | string>()
}))

const { run } = await import('../src/main.js')
const awsMod = await import('../src/aws.js')
const getSecret = awsMod.getSecret as jest.Mock
const parseSecretValue = awsMod.parseSecretValue as jest.Mock

afterEach(() => jest.resetAllMocks())

describe('run()', () => {
  it('fails on invalid source-type', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'source-type') return 'invalid'
      return ''
    })
    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Invalid source-type')
    )
  })

  it('succeeds with empty inline data (no-op)', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'source-type') return 'inline'
      if (name === 'data') return ''
      return ''
    })
    await run()
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('processes var line end-to-end', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'source-type') return 'inline'
      if (name === 'region') return 'us-east-1'
      if (name === 'data') return 'var => myapp/db => password => DB_PASS'
      return ''
    })
    getSecret.mockResolvedValue('{"password":"s3cr3t"}')
    parseSecretValue.mockReturnValue({ password: 's3cr3t' })

    await run()

    expect(core.setFailed).not.toHaveBeenCalled()
    expect(core.setSecret).toHaveBeenCalledWith('s3cr3t')
    expect(core.exportVariable).toHaveBeenCalledWith('DB_PASS', 's3cr3t')
  })

  it('fails when no region is configured', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'source-type') return 'inline'
      if (name === 'data') return 'var => myapp/db => password => DB_PASS'
      return ''
    })
    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('no region set')
    )
  })

  it('skips comments and prints messages', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'source-type') return 'inline'
      if (name === 'data') return '# comment\n@ hello world'
      return ''
    })
    await run()
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(core.info).toHaveBeenCalledWith('hello world')
  })

  it('region <= overrides default region', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'source-type') return 'inline'
      if (name === 'region') return 'us-east-1'
      if (name === 'data')
        return 'region <= eu-west-1\nvar => myapp/db => pass => P'
      return ''
    })
    getSecret.mockResolvedValue('{"pass":"x"}')
    parseSecretValue.mockReturnValue({ pass: 'x' })

    await run()

    expect(getSecret).toHaveBeenCalledWith('myapp/db', 'eu-west-1')
  })
})
