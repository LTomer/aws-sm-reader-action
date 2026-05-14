import { describe, it, expect } from '@jest/globals'
import {
  isComment,
  isMessage,
  parseVarAssign,
  parseActionLine,
  parseSecretRef,
  substituteVars
} from '../src/parser.js'

describe('isComment', () => {
  it('detects # lines', () => expect(isComment('# hello')).toBe(true))
  it('ignores non-comment', () =>
    expect(isComment('var => x => y => Z')).toBe(false))
  it('handles leading whitespace', () =>
    expect(isComment('  # comment')).toBe(true))
})

describe('isMessage', () => {
  it('detects @ lines', () => expect(isMessage('@hello')).toBe(true))
  it('ignores non-message', () =>
    expect(isMessage('region <= us-east-1')).toBe(false))
})

describe('parseVarAssign', () => {
  it('parses simple assignment', () => {
    expect(parseVarAssign('region <= us-east-1')).toEqual({
      key: 'region',
      value: 'us-east-1'
    })
  })
  it('parses with spaces around <=', () => {
    expect(parseVarAssign('myVar  <=  hello')).toEqual({
      key: 'myVar',
      value: 'hello'
    })
  })
  it('returns null for action lines', () => {
    expect(parseVarAssign('var => sec => key => OUT')).toBeNull()
  })
})

describe('parseActionLine', () => {
  it('parses var line', () => {
    expect(parseActionLine('var => myapp/db => password => DB_PASS')).toEqual({
      type: 'var',
      secretRef: 'myapp/db',
      key: 'password',
      outputVar: 'DB_PASS'
    })
  })
  it('parses pre line with *', () => {
    expect(parseActionLine('pre => myapp/db => * => DB')).toEqual({
      type: 'pre',
      secretRef: 'myapp/db',
      key: '*',
      outputVar: 'DB'
    })
  })
  it('parses rep line with file path', () => {
    expect(parseActionLine('rep => myapp/db => /tmp/tpl.txt => OUT')).toEqual({
      type: 'rep',
      secretRef: 'myapp/db',
      key: '/tmp/tpl.txt',
      outputVar: 'OUT'
    })
  })
  it('returns null for garbage', () => {
    expect(parseActionLine('garbage line')).toBeNull()
  })
  it('returns null for unknown action type', () => {
    expect(parseActionLine('unknown => x => y => Z')).toBeNull()
  })
})

describe('parseSecretRef', () => {
  it('parses name only', () => {
    expect(parseSecretRef('myapp/db')).toEqual({ name: 'myapp/db' })
  })
  it('parses name@region', () => {
    expect(parseSecretRef('myapp/db@us-east-1')).toEqual({
      name: 'myapp/db',
      region: 'us-east-1'
    })
  })
  it('handles multiple @ by using last one', () => {
    expect(parseSecretRef('my@app@eu-west-1')).toEqual({
      name: 'my@app',
      region: 'eu-west-1'
    })
  })
})

describe('substituteVars', () => {
  it('substitutes known vars', () => {
    expect(substituteVars('{env}/db', { env: 'prod' })).toBe('prod/db')
  })
  it('leaves unknown vars alone', () => {
    expect(substituteVars('{unknown}/db', {})).toBe('{unknown}/db')
  })
  it('substitutes multiple occurrences', () => {
    expect(substituteVars('{e}/{e}', { e: 'x' })).toBe('x/x')
  })
})
