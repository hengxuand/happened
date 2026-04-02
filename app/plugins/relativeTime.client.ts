/**
 * Client-only plugin that converts `<time data-utc-time="..." data-lang="...">` elements
 * into human-readable relative timestamps (e.g. "2 hours ago" / "2小时前").
 *
 * Conversion runs after each page finishes loading (via the `page:finish` hook) so it
 * always fires after Vue has fully rendered and hydrated the page — matching the original
 * `onMounted` timing that the inline `app.vue` logic relied on.
 *
 * The plugin also periodically updates relative times so they stay current while the user
 * is on the page (e.g., "2 hours ago" becomes "3 hours ago" over time).
 *
 * Additionally, it updates immediately when the route changes (e.g., language switch).
 */
import {formatRelativeTime} from '~/utils/datetime'

export default defineNuxtPlugin((nuxtApp) => {
    const router = useRouter()
    const route = useRoute()

    function convertAllTimeElements(): void {
        const lang = route.query.translation === 'zh-Hans' ? 'zh-Hans' : 'en'
        document.querySelectorAll<HTMLElement>('time[data-utc-time]').forEach((el) => {
            const utcTime = el.getAttribute('data-utc-time')
            if (utcTime) el.textContent = formatRelativeTime(utcTime, lang)
        })
    }

    // Run after the initial app mount (covers first page load / SSR hydration).
    nuxtApp.hook('app:mounted', convertAllTimeElements)

    // Run after every client-side navigation so newly rendered items are converted.
    nuxtApp.hook('page:finish', convertAllTimeElements)

    // Update immediately when the route changes (e.g., language query param changes).
    router.afterEach(() => {
        convertAllTimeElements()
    })

    // Periodically update relative times every 10 minutes to keep them current.
    setInterval(convertAllTimeElements, 600_000)
})
