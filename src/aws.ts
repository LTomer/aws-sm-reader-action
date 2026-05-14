import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager'

export async function getSecret(name: string, region: string): Promise<string> {
  const client = new SecretsManagerClient({ region })
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: name })
  )
  if (response.SecretString === undefined) {
    throw new Error(
      `Secret "${name}" has no SecretString (binary secrets not supported)`
    )
  }
  return response.SecretString
}

export function parseSecretValue(raw: string): Record<string, string> | string {
  try {
    const parsed = JSON.parse(raw)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, string>
    }
  } catch {
    // not JSON
  }
  return raw
}
