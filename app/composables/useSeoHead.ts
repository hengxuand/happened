import type { ComputedRef } from 'vue'
import type { SupportedLang } from '~/types'

export function useSeoHead(
    paramDate: ComputedRef<string>,
    lang: ComputedRef<SupportedLang>,
    formattedCurrentDate: ComputedRef<string>,
) {
    const config = useRuntimeConfig()
    const siteUrl = config.public.siteUrl as string

    useHead(computed(() => {
        const date = paramDate.value
        const isEn = lang.value === 'en'
        const baseUrl = `${siteUrl}/${date}`
        const enUrl = baseUrl
        const zhUrl = `${baseUrl}?translation=zh-Hans`
        // Base URL (English) is always canonical
        const canonical = baseUrl

        // Always use English title and description since content is English
        const pageTitle = `World News – ${formattedCurrentDate.value} | Happened.info`
        const description = `A curated daily digest of global news headlines for ${formattedCurrentDate.value}. Read today's top stories in English.`

        const ogImage = `${siteUrl}/og-image.png`

        return {
            htmlAttrs: { lang: isEn ? 'en' : 'zh-Hans' },
            title: pageTitle,
            meta: [
                { name: 'description', content: description },
                // Open Graph
                { property: 'og:title', content: pageTitle },
                { property: 'og:description', content: description },
                { property: 'og:url', content: canonical },
                { property: 'og:type', content: 'website' },
                { property: 'og:image', content: ogImage },
                { property: 'og:locale', content: 'en_US' },
                { property: 'og:locale:alternate', content: 'zh_CN' },
                // Twitter / X Card
                { name: 'twitter:card', content: 'summary_large_image' },
                { name: 'twitter:title', content: pageTitle },
                { name: 'twitter:description', content: description },
                { name: 'twitter:image', content: ogImage },
            ],
            link: [
                // Canonical – always points to base URL (source of truth)
                { rel: 'canonical', href: canonical },
                // hreflang alternates – tell Google about both language versions
                { rel: 'alternate', hreflang: 'en', href: enUrl },
                { rel: 'alternate', hreflang: 'zh', href: zhUrl },
                { rel: 'alternate', hreflang: 'zh-Hans', href: zhUrl },
                // x-default: the fallback for users whose language is not explicitly listed
                { rel: 'alternate', hreflang: 'x-default', href: enUrl },
            ],
        }
    }))
}
