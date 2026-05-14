# Developer Guide

How to build, test, run, and validate the `aws-sm-reader-action` locally.

---

## Prerequisites

- **Node.js** 24.x (version pinned in `.node-version`). Use `fnm` or `nodenv` to auto-switch.
- **npm** (bundled with Node)
- AWS credentials with `secretsmanager:GetSecretValue` for end-to-end local testing (optional)

---

## Setup

```bash
npm install
```

---

## Project structure

```
src/
  index.ts       entry point — calls run()
  main.ts        orchestrator — reads inputs, parses instructions, dispatches actions
  parser.ts      DSL line parser (comments, messages, <=, action lines)
  actions.ts     action implementations (var, pre, raw, base64, b64var, rep)
  aws.ts         AWS Secrets Manager client wrapper
__tests__/
  parser.test.ts unit tests for parser
  actions.test.ts unit tests for each action
  main.test.ts   integration-style tests for the orchestrator
__fixtures__/
  core.ts        jest mock for @actions/core
action.yml       action metadata (inputs, node version)
rollup.config.ts bundle config
```

---

## Development workflow

### 1. Type check

```bash
npx tsc --noEmit
```

Compiles all TypeScript source files and reports type errors without producing any output files. Run this after any source change to catch type mismatches early. Zero output means no errors.

### 2. Lint

```bash
npm run lint
```

Runs ESLint across all source, test, and config files. Catches code style violations, unused variables, unsafe patterns, and Prettier formatting issues.

To auto-fix formatting issues:

```bash
npm run format:write
```

Rewrites files in-place to match Prettier rules (indentation, quotes, trailing commas, line length, etc.).

To check formatting without writing:

```bash
npm run format:check
```

Same as above but exits with an error if any file would be changed — useful in CI.

### 3. Unit tests

```bash
npm test
```

Runs the full Jest test suite across all `__tests__/*.test.ts` files. Tests are isolated — `@actions/core` is mocked via `__fixtures__/core.ts` and the AWS SDK is mocked in `main.test.ts`, so no AWS credentials are needed.

Watch mode — re-runs affected tests on every file save:

```bash
npm run test -- --watch
```

Coverage report is written to `coverage/` and printed to the terminal after each run.

### 4. Build

```bash
npm run package
```

Deletes `dist/` and re-bundles `src/index.ts` and all its dependencies into a single `dist/index.js` file using Rollup. This is the file GitHub Actions executes — it must be committed alongside the source.

Format + build in one step:

```bash
npm run bundle
```

Runs `format:write` then `package`. Use this before committing to ensure `dist/index.js` is in sync with the source.

### 5. Full validation

```bash
npm run all
```

Runs the complete pipeline in sequence: `format:write` → `lint` → `test` → `coverage` (updates `badges/coverage.svg`) → `package`. Use this before opening a pull request or cutting a release to confirm everything passes end-to-end.

---

## Local end-to-end testing

Use the [`@github/local-action`](https://github.com/github/local-action) CLI to simulate a GitHub Actions run on your machine.

### 1. Create a `.env` file

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` to configure action inputs and AWS credentials:

```dotenv
ACTIONS_STEP_DEBUG=true

# Action inputs — format is INPUT_<name> (hyphens preserved, case-sensitive)
INPUT_SOURCE-TYPE=inline
INPUT_DATA=var => myapp/test/db => password => DB_PASSWORD
INPUT_REGION=us-east-1

# AWS credentials (or use OIDC via environment — see below)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
```

> Do not commit `.env` — it is in `.gitignore`.

### 2. Run locally

```bash
npm run local-action
```

This runs `npx @github/local-action . src/main.ts .env` and prints the action output to your terminal.

### 3. VS Code debugger

Open the Run & Debug panel and select **Debug Action**. This uses the same `local-action` invocation with the VS Code integrated terminal, so you can set breakpoints in `src/`.

---

## Testing with real AWS secrets

To test a specific action type end-to-end, create a test secret in AWS Secrets Manager and reference it in `.env`:

```dotenv
# JSON secret test
INPUT_DATA=var => myapp/test/db => password => TEST_PASS

# Plaintext secret test
INPUT_DATA=raw => myapp/test/token => * => TEST_TOKEN_FILE
```

Make sure your AWS credentials have `secretsmanager:GetSecretValue` on the target secret.

---

## Adding a new action type

1. Add the new type to the `ActionType` union in `src/parser.ts`
2. Add it to the regex in `parseActionLine` in `src/parser.ts`
3. Implement `actionXxx(secret, field, outputVar)` in `src/actions.ts`
4. Add the `case` to the `switch` in `src/main.ts`
5. Add unit tests in `__tests__/actions.test.ts`
6. Document in `README.md` under "Action types"

---

## Releasing

Run the release script to tag and push a new version:

```bash
./script/release
```

The script prompts for a version tag (`vX.Y.Z`), creates the tag, and syncs the major tag (e.g. `v1`). After pushing, create a GitHub Release from the tag.

Always run `npm run bundle` before releasing to ensure `dist/index.js` is up to date.
