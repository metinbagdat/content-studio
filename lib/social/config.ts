/** Which OAuth platforms have client credentials in env (no secrets exposed). */
import { metaConfigured, metaCallbackUrl, metaOAuthScopes, metaAppId } from './metaApi'

export function oauthPlatformStatus() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'
  return {
    twitter: {
      configured: Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET),
      callbackUrl: process.env.X_CALLBACK_URL || `${appUrl}/api/social/callback/twitter`,
      clientIdSet: Boolean(process.env.X_CLIENT_ID),
      clientSecretSet: Boolean(process.env.X_CLIENT_SECRET),
    },
    linkedin: {
      configured: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
      callbackUrl: process.env.LINKEDIN_CALLBACK_URL || `${appUrl}/api/social/callback/linkedin`,
      organizationId: process.env.LINKEDIN_ORGANIZATION_ID || null,
      orgPostEnabled: process.env.LINKEDIN_ORG_POST === 'true',
      scopes: linkedinOAuthScopes(),
      clientIdSet: Boolean(process.env.LINKEDIN_CLIENT_ID),
      clientSecretSet: Boolean(process.env.LINKEDIN_CLIENT_SECRET),
    },
    youtube: {
      configured: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET),
      callbackUrl: process.env.YOUTUBE_CALLBACK_URL || `${appUrl}/api/social/callback/youtube`,
      clientIdSet: Boolean(process.env.YOUTUBE_CLIENT_ID),
      clientSecretSet: Boolean(process.env.YOUTUBE_CLIENT_SECRET),
      scopes: youtubeOAuthScopes(),
    },
    facebook: {
      configured: metaConfigured(),
      callbackUrl: metaCallbackUrl('FACEBOOK', appUrl),
      clientIdSet: Boolean(metaAppId()),
      clientSecretSet: metaConfigured(),
      scopes: metaOAuthScopes(),
    },
    instagram: {
      configured: metaConfigured(),
      callbackUrl: metaCallbackUrl('INSTAGRAM', appUrl),
      clientIdSet: Boolean(metaAppId()),
      clientSecretSet: metaConfigured(),
      scopes: metaOAuthScopes(),
    },
  }
}

export function youtubeOAuthScopes(): string {
  if (process.env.YOUTUBE_OAUTH_SCOPES?.trim()) {
    return process.env.YOUTUBE_OAUTH_SCOPES.trim()
  }
  return [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
  ].join(' ')
}

/** Masked env presence check for admin UI (never exposes secret values). */
export function oauthEnvCheck() {
  return {
    X_CLIENT_ID: Boolean(process.env.X_CLIENT_ID?.trim()),
    X_CLIENT_SECRET: Boolean(process.env.X_CLIENT_SECRET?.trim()),
    LINKEDIN_CLIENT_ID: Boolean(process.env.LINKEDIN_CLIENT_ID?.trim()),
    LINKEDIN_CLIENT_SECRET: Boolean(process.env.LINKEDIN_CLIENT_SECRET?.trim()),
    YOUTUBE_CLIENT_ID: Boolean(process.env.YOUTUBE_CLIENT_ID?.trim()),
    YOUTUBE_CLIENT_SECRET: Boolean(process.env.YOUTUBE_CLIENT_SECRET?.trim()),
    META_APP_ID: Boolean(metaAppId()),
    META_APP_SECRET: metaConfigured(),
    ready:
      Boolean(process.env.X_CLIENT_ID?.trim() && process.env.X_CLIENT_SECRET?.trim()) &&
      Boolean(process.env.LINKEDIN_CLIENT_ID?.trim() && process.env.LINKEDIN_CLIENT_SECRET?.trim()),
  }
}

/**
 * LinkedIn OAuth scopes.
 * w_organization_social often fails authorize until Marketing/ org post approved —
 * enable only with LINKEDIN_ORG_POST=true after LinkedIn grants it.
 */
export function linkedinOAuthScopes(): string {
  if (process.env.LINKEDIN_OAUTH_SCOPES?.trim()) {
    return process.env.LINKEDIN_OAUTH_SCOPES.trim()
  }
  const scopes = ['openid', 'profile', 'email', 'w_member_social']
  if (process.env.LINKEDIN_ORG_POST === 'true' && process.env.LINKEDIN_ORGANIZATION_ID) {
    scopes.push('w_organization_social')
  }
  return scopes.join(' ')
}

export function linkedinAuthorUrn(accountId: string, config: unknown): string {
  const cfg = config && typeof config === 'object' ? (config as Record<string, unknown>) : {}
  if (typeof cfg.linkedinAuthorUrn === 'string') return cfg.linkedinAuthorUrn
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID
  if (orgId && process.env.LINKEDIN_ORG_POST === 'true') {
    return `urn:li:organization:${orgId}`
  }
  return accountId.startsWith('urn:') ? accountId : `urn:li:person:${accountId}`
}
