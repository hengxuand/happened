// https://nuxt.com/docs/api/configuration/nuxt-config

/**
 * Generates prerender routes for the last `days` days in all supported languages.
 * Pages beyond this window are generated on-demand via ISR.
 */
function getPrerenderRoutes(days = 7): string[] {
  const routes: string[] = []
  const today = new Date()
  for (let i = 1; i <= days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    routes.push(`/zh/${dateStr}`, `/en/${dateStr}`)
  }
  return routes
}

/**
 * Generates sitemap URLs for the last `days` days in all supported languages.
 * Includes lastmod, changefreq and priority hints for crawlers.
 */
function getSitemapUrls(days = 30) {
  const urls = []
  const today = new Date()
  for (let i = 0; i <= days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const priority = i === 0 ? 1.0 : i <= 7 ? 0.8 : 0.5
    const changefreq = i === 0 ? 'hourly' : i <= 7 ? 'daily' : 'weekly'
    for (const lang of ['zh', 'en']) {
      urls.push({
        loc: `/${lang}/${dateStr}`,
        lastmod: dateStr,
        changefreq,
        priority,
        // hreflang alternates so the sitemap itself is bilingual-aware
        alternatives: [
          { hreflang: 'zh', href: `/zh/${dateStr}` },
          { hreflang: 'zh-Hans', href: `/zh/${dateStr}` },
          { hreflang: 'en', href: `/en/${dateStr}` },
          { hreflang: 'x-default', href: `/en/${dateStr}` },
        ]
      })
    }
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
    // Today's page: always fresh (SSR on every request)
    '/:lang(en|zh)/:date(\\d{4}-\\d{2}-\\d{2})': {
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
