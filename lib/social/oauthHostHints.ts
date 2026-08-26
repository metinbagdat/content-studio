/** Where OAuth / publish works: local Docker vs studio.egitim.today (separate DBs). */

export type OauthHostKind = 'local_ok' | 'local_limited' | 'prod_only'

export type OauthHostHint = {
  kind: OauthHostKind
  badge: string
  local: string
  prod: string
}

export const OAUTH_HOST_HINTS: Record<string, OauthHostHint> = {
  TWITTER: {
    kind: 'local_ok',
    badge: 'Local OAuth: evet',
    local: 'Localhost callback ile bağlanır ve yayınlanır.',
    prod: 'Prod’da da bağlanır. Local Docker ayrı DB — burada görünen hesap localhost’ta yok.',
  },
  LINKEDIN: {
    kind: 'local_limited',
    badge: 'Local OAuth: kişisel',
    local:
      'Kişisel profil bağlanır (LINKEDIN_ORG_POST=false). Şirket sayfası izni (w_organization_social) local’de unauthorized_scope_error verir.',
    prod: 'Prod’da şirket sayfası token’ı varsa oradan yayınla. Local Docker bu hesabı göstermez.',
  },
  YOUTUBE: {
    kind: 'local_ok',
    badge: 'Local OAuth: evet',
    local: 'Localhost callback ile bağlanır; MP4 dosyadan yüklenir.',
    prod: 'Prod’da da bağlanır. Local Docker ayrı DB.',
  },
  TIKTOK: {
    kind: 'local_ok',
    badge: 'Local OAuth: evet',
    local: 'Login Kit Desktop/PKCE + localhost redirect. Web (https-only) tab client_key hatası verir.',
    prod: 'Prod Web redirect: https://studio.egitim.today/api/social/callback/tiktok/',
  },
  FACEBOOK: {
    kind: 'prod_only',
    badge: 'Local OAuth: hayır — prod',
    local:
      'Meta Login for Business localhost http kaydetmez (Enforce HTTPS). OAuth ve sayfa yayını: https://studio.egitim.today/admin/social',
    prod: 'Bu ortamda bağlanır. Localhost’tan OAuth deneme.',
  },
  INSTAGRAM: {
    kind: 'prod_only',
    badge: 'Local OAuth: hayır — prod',
    local:
      'Aynı Meta kısıtı. Ayrıca Meta localhost görsel URL’sine erişemez — IG yayını yalnızca prod’dan.',
    prod: 'Bu ortamda bağlanır. Localhost’tan OAuth / yayın deneme.',
  },
  PINTEREST: {
    kind: 'local_limited',
    badge: 'Local OAuth: evet · Pin: prod URL',
    local:
      'OAuth localhost callback ile bağlanır. Pin için herkese açık HTTPS image URL gerekir — gerçek yayın genelde prod.',
    prod: 'Bu ortamda OAuth + Pin (studio.egitim.today image URL). Board OAuth sırasında seçilir/oluşturulur.',
  },
}

export function isLocalOauthHost(callbackUrl?: string | null): boolean {
  if (!callbackUrl) return false
  return /localhost|127\.0\.0\.1/i.test(callbackUrl)
}
