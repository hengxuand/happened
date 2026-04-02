// https://nuxt.com/docs/api/configuration/nuxt-config

/**
 * Generates prerender routes for the last `days` days.
 * Query parameters are not pre-rendered, so we only pre-render base dates.
 * Translation is handled via query parameter (?translation=zh-Hans).
 * Pages beyond this window are generated on-demand via ISR.
 */
function getPrerenderRoutes(days = 7): string[] {
  const routes: string[] = []
  const today = new Date()
  for (let i = 1; i <= days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    routes.push(`/${dateStr}`)
  }
  return routes
}

/**
 * Generates sitemap URLs for the last `days` days.
 * Base URL (without query params) is canonical.
 * Translation version via query parameter is marked as alternate.
 * Includes lastmod, changefreq and priority hints for crawlers.
 */
function getSitemapUrls(days = 30): any {
  const urls: any[] = []
  const today = new Date()
  for (let i = 0; i <= days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const priority = i === 0 ? 1.0 : i <= 7 ? 0.8 : 0.5
    const changefreq = i === 0 ? 'hourly' : i <= 7 ? 'daily' : 'weekly'
    // Base URL (default English)
    urls.push({
      loc: `/${dateStr}`,
      lastmod: dateStr,
      changefreq,
      priority,
      alternatives: [
        { hreflang: 'en', href: `/${dateStr}` },
        { hreflang: 'zh', href: `/${dateStr}?translation=zh-Hans` },
        { hreflang: 'zh-Hans', href: `/${dateStr}?translation=zh-Hans` },
        { hreflang: 'x-default', href: `/${dateStr}` },
      ]
    })
  }
  return urls
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@nuxt/icon', '@nuxtjs/sitemap'],
  css: ['~/assets/css/theme.css'],
  runtimeConfig: {
    public: {
      siteUrl: 'https://happened.info',
      // NOTE: Update this date whenever terms-of-service.vue or privacy-policy.vue are modified.
      legalLastUpdated: 'February 21, 2026',
      // Override with NUXT_PUBLIC_DEV_MODE=false to disable dev mode behaviour in staging/prod.
      devMode: process.env.NODE_ENV !== 'production'
    }
  },
  // Required by @nuxtjs/sitemap to build absolute URLs
  site: {
    url: 'https://happened.info'
  },

  sitemap: {
    // Provide the last 30 days of bilingual news pages
    urls: getSitemapUrls(30),
    // Also include static pages
    includeAppSources: true,
  },

  app: {
    head: {
      title: 'Happened.info',
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' }
      ]
    }
  },
  supabase: {
    redirect: false,
    // Prefer Nuxt public env vars; keep legacy names as fallback.
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY
  },
  routeRules: {
    // All date pages: always fresh (SSR on every request)
    '/:date(\\d{4}-\\d{2}-\\d{2})': {
      isr: 3600 // Revalidate every hour (3600 seconds)
    }
  },
  nitro: {
    prerender: {
      crawlLinks: false,
      routes: getPrerenderRoutes()
    }
  }
})
