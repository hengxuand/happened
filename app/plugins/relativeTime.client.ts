/**
 * Client-only plugin that converts `<time data-utc-time="..." data-lang="...">` elements
 * into human-readable relative timestamps (e.g. "2 hours ago" / "2小时前").
 *
 * Conversion runs after each page finishes loading (via the `page:finish` hook) so it
 * always fires after Vue has fully rendered and hydrated the page — matching the original
 * `onMounted` timing that the inline `app.vue` logic relied on.
 */
export default defineNuxtPlugin((nuxtApp) => {
    type TimeUnit = { divisor: number; en: string; zh: string }

    const TIME_UNITS: TimeUnit[] = [
        { divisor: 31_536_000, en: 'year', zh: '年' },
        { divisor: 2_592_000, en: 'month', zh: '个月' },
        { divisor: 86_400, en: 'day', zh: '天' },
        { divisor: 3_600, en: 'hour', zh: '小时' },
        { divisor: 60, en: 'minute', zh: '分钟' },
    ]

    function formatRelativeTime(utcDateString: string, lang: string): string {
        const seconds = Math.floor((Date.now() - new Date(utcDateString).getTime()) / 1000)

        for (const { divisor, en, zh } of TIME_UNITS) {
            const count = Math.floor(seconds / divisor)
            if (count >= 1) {
                return lang === 'zh-Hans'
                    ? `${count}${zh}前`
                    : `${count} ${en}${count > 1 ? 's' : ''} ago`
            }
        }

        return lang === 'zh-Hans' ? '刚刚' : 'just now'
    }

    function convertAllTimeElements(): void {
        document.querySelectorAll<HTMLElement>('time[data-utc-time]').forEach((el) => {
            const utcTime = el.getAttribute('data-utc-time')
            const lang = el.getAttribute('data-lang') ?? 'en'
            if (utcTime) el.textContent = formatRelativeTime(utcTime, lang)
        })
    }

    // Run after the initial app mount (covers first page load / SSR hydration).
    nuxtApp.hook('app:mounted', convertAllTimeElements)

    // Run after every client-side navigation so newly rendered items are converted.
    nuxtApp.hook('page:finish', convertAllTimeElements)
})
