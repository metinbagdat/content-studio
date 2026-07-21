/** Which OAuth platforms have client credentials in env (no secrets exposed). */
export function oauthPlatformStatus() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'
  return {
    twitter: {
      configured: Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET),
      callbackUrl: process.env.X_CALLBACK_URL || `${appUrl}/api/social/callback/twitter`,
    },
    linkedin: {
      configured: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
      callbackUrl: process.env.LINKEDIN_CALLBACK_URL || `${appUrl}/api/social/callback/linkedin`,
      organizationId: process.env.LINKEDIN_ORGANIZATION_ID || null,
    },
  }
}

export function linkedinOAuthScopes(): string {
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID
  if (orgId) {
    return 'openid profile w_member_social w_organization_social'
  }
  return 'openid profile w_member_social'
}

export function linkedinAuthorUrn(accountId: string, config: unknown): string {
  const cfg = config && typeof config === 'object' ? (config as Record<string, unknown>) : {}
  if (typeof cfg.linkedinAuthorUrn === 'string') return cfg.linkedinAuthorUrn
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID
  if (orgId) return `urn:li:organization:${orgId}`
  return accountId.startsWith('urn:') ? accountId : `urn:li:person:${accountId}`
}
