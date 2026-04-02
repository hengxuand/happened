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
 */
import {formatRelativeTime} from '~/utils/datetime'

export default defineNuxtPlugin((nuxtApp) => {

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

    // Periodically update relative times every 60 seconds to keep them current.
    setInterval(convertAllTimeElements, 10_000)
})
