# AWS Secrets Manager Reader

GitHub Action that reads secrets from AWS Secrets Manager and exposes them as
masked environment variables in subsequent steps.

Inspired by the
[vault-reader](https://marketplace.visualstudio.com/items?itemName=tomer-l.vault-reader)
Azure DevOps task.

---

## Prerequisites

Configure AWS credentials before this action using
[aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials):

```yaml
- uses: aws-actions/configure-aws-credentials@v6
  with:
    role-to-assume: arn:aws:iam::123456789012:role/my-role
    aws-region: us-east-1
```

---

## Inputs

| Input         | Required     | Description                                     |
| ------------- | ------------ | ----------------------------------------------- |
| `source-type` | yes          | `inline` or `file-path`                         |
| `data`        | if inline    | Multiline instructions                          |
| `data-file`   | if file-path | Path to instructions file                       |
| `region`      | no           | Default AWS region. Can be overridden per-line. |

---

## Instructions DSL

The `data` / `data-file` input is a text file where each line is an instruction.

### Line types

| Syntax                                                    | Description                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `# comment`                                               | Ignored                                                         |
| `@ message`                                               | Print message to the Actions log                                |
| `region <= eu-west-1`                                     | Set default region for all subsequent lines                     |
| `myVar <= some-value`                                     | Set a user variable (usable as `{myVar}` in secret name or key) |
| `actionType => secret-name[@region] => key => OUTPUT_VAR` | Read a secret                                                   |

### Secret name format

```
secret-name[@region]
```

The `@region` suffix is optional. Region resolution order:

1. `@region` suffix on the line
2. `region <=` variable set earlier in the instructions
3. `region` action input
4. `AWS_DEFAULT_REGION` environment variable

### Variable substitution

Use `{varName}` in secret name or key fields to substitute values defined with
`<=`.

```
env <= prod
var => myapp/{env}/db => password => DB_PASSWORD
```

### Secret formats

AWS Secrets Manager stores secrets as either:

- **JSON secret** — the secret value is a JSON object with named keys, e.g.
  `{"username":"admin","password":"s3cr3t"}`. Created in the AWS console as
  "Other type of secret → Key/value pairs".
- **Plaintext secret** — the secret value is a raw string (certificate PEM,
  token, connection string, etc.). Created in the AWS console as "Other type of
  secret → Plaintext".

The action auto-detects the format: if the value parses as a JSON object it is
treated as a JSON secret; otherwise it is treated as plaintext.

### Action types

#### `var` — read one field into an environment variable

Reads a single key from a **JSON secret** and sets it as a masked environment
variable available to all subsequent steps.

**Syntax:** `var => secret-name[@region] => key => OUTPUT_VAR`

**Example** — secret `myapp/prod/db` contains
`{"username":"admin","password":"s3cr3t"}`:

```
var => myapp/prod/db => username => DB_USER
var => myapp/prod/db => password => DB_PASSWORD
```

After this, `$DB_USER` and `$DB_PASSWORD` are available as masked env vars.

---

#### `pre` — expand all fields into prefixed environment variables

Reads **all keys** from a **JSON secret** and sets one masked environment
variable per key, named `PREFIX_keyname`. Useful when a secret has many fields
and you want them all without listing each one.

**Syntax:** `pre => secret-name[@region] => * => PREFIX`

**Example** — secret `myapp/prod/db` contains
`{"host":"db.example.com","port":"5432","password":"s3cr3t"}`:

```
pre => myapp/prod/db => * => DB
```

Sets `$DB_host`, `$DB_port`, and `$DB_password`, all masked.

---

#### `raw` — write a secret value to a temp file

Writes the secret value to a temporary file and sets the env var to the **file
path**. Useful when the consuming tool reads from a file rather than an env var
(e.g. SSH keys, kubeconfig, certificates).

- **JSON secret**: the specified key's value is written to the file.
- **Plaintext secret**: the full secret string is written to the file (key field
  is ignored, use `*` or leave it empty).

The file path is **not** masked (it is not sensitive), but the file contents
are. The file has `400` permissions on Linux/macOS.

**Syntax:** `raw => secret-name[@region] => key => OUTPUT_VAR`

**Examples:**

```
# JSON secret — write one field to file
raw => myapp/prod/tls => private_key => TLS_KEY_FILE

# Plaintext secret — write full value to file
raw => myapp/prod/ssh-key => * => SSH_KEY_FILE
```

After this, `$TLS_KEY_FILE` and `$SSH_KEY_FILE` contain file paths.

---

#### `base64` — decode a base64-encoded value and write to a temp file

Decodes a base64-encoded secret value and writes the **decoded binary/text** to
a temp file. Sets the env var to the file path. Useful for binary blobs
(certificates, keystores, etc.) stored as base64 in Secrets Manager.

- **JSON secret**: the specified key's value is decoded.
- **Plaintext secret**: the entire secret string is decoded (key field is
  ignored, use `*`).

**Syntax:** `base64 => secret-name[@region] => key => OUTPUT_VAR`

**Examples:**

```
# JSON secret — decode one field
base64 => myapp/prod/tls => cert => TLS_CERT_FILE

# Plaintext secret — the whole secret is a base64-encoded blob
base64 => myapp/prod/keystore => * => KEYSTORE_FILE
```

`$TLS_CERT_FILE` and `$KEYSTORE_FILE` contain paths to the decoded files.

---

#### `b64var` — decode a base64-encoded field into an environment variable

Like `base64`, but stores the **decoded string** directly as a masked
environment variable instead of writing to a file. Useful when the consuming
tool reads from an env var and the value happens to be base64-encoded in Secrets
Manager.

**Syntax:** `b64var => secret-name[@region] => key => OUTPUT_VAR`

**Example** — secret `myapp/prod/api` contains
`{"token":"bXlzZWNyZXR0b2tlbg=="}`:

```
b64var => myapp/prod/api => token => API_TOKEN
```

`$API_TOKEN` contains the decoded token string, masked in logs.

---

#### `rep` — render a template file with secret values

Reads a **JSON secret** and uses its key-value pairs to render a template file.
Any `__KEYNAME__` placeholder in the template is replaced with the corresponding
secret value. The rendered output is written to a temp file and the env var is
set to the file path.

Useful for generating config files (database connection strings, app configs,
etc.) without hardcoding secret values in the repository.

**Syntax:** `rep => secret-name[@region] => path/to/template => OUTPUT_VAR`

**Example** — secret `myapp/prod/db` contains
`{"host":"db.example.com","port":"5432","password":"s3cr3t"}`, template file
`config/db.tmpl`:

```
[database]
host=__host__
port=__port__
password=__password__
```

Instruction:

```
rep => myapp/prod/db => config/db.tmpl => DB_CONFIG_FILE
```

`$DB_CONFIG_FILE` contains the path to the rendered config file.

---

### Temp files

File-based actions (`raw`, `base64`, `rep`) write to `$RUNNER_TEMP` with a
random filename. The env var is set to the file path (not masked). Files have
`400` permissions on Linux/macOS.

---

## Examples

### OIDC authentication (recommended)

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::[aws-account-number]:role/[your-role]
          aws-region: us-east-1

      - uses: LTomer/aws-sm-reader-action@v1
        with:
          source-type: inline
          region: us-east-1
          data: |
            # Database credentials
            var => myapp/prod/db => username => DB_USER
            var => myapp/prod/db => password => DB_PASSWORD

            # TLS certificate (base64-encoded in SM)
            base64 => myapp/prod/tls => cert => TLS_CERT_FILE
```

### Access key authentication

```yaml
- uses: aws-actions/configure-aws-credentials@v6
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: eu-west-1
```

### Multi-region with variable substitution

```yaml
- uses: LTomer/aws-sm-reader-action@v1
  with:
    source-type: inline
    data: |
      env <= prod
      region <= eu-west-1

      var => myapp/{env}/db => password => DB_PASSWORD
      var => myapp/{env}/api@us-east-1 => key => API_KEY
```

### Read all keys from a secret

```yaml
data: |
  # Sets DB_username and DB_password
  pre => myapp/prod/db => * => DB
```

### Template file replacement

Given a template file `config.tmpl`:

```
database_url=postgres://__username__:__password__@__host__/mydb
```

```yaml
data: |
  rep => myapp/prod/db => config.tmpl => DB_CONFIG_FILE
```

The `DB_CONFIG_FILE` env var will contain the path to the rendered file.

### Read from a file-path

```yaml
- uses: LTomer/aws-sm-reader-action@v1
  with:
    source-type: file-path
    data-file: .github/secrets.txt
    region: us-east-1
```

---

## Notes

- All values read from Secrets Manager are masked in the Actions log via
  `core.setSecret()`.
- File paths set by file-based actions (`raw`, `base64`, `rep`) are **not**
  masked — only the content is sensitive.
- Binary secrets (non-`SecretString`) are not supported.
