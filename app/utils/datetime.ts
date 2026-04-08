export const MIN_VALID_DATE = '2025-12-03'

/**
 * Returns true if `date` is a valid YYYY-MM-DD string within the
 * supported range [MIN_VALID_DATE, today (UTC)].
 */
export function isValidAppDate(date: string): boolean {
    return (
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        date >= MIN_VALID_DATE &&
        date <= getTodayDateString()
    )
}

/** Returns today's date as a YYYY-MM-DD string in UTC. */
export function getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10)
}

/** Returns a new YYYY-MM-DD date string offset by `days` from the given date string. */
export function getOffsetDateString(date: string, days: number): string {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
}

/** Formats a YYYY-MM-DD date string as a full localized display string (e.g. Monday, February 22, 2026). */
export function formatDisplayDate(date: string, locale: string): string {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC', // Force UTC so the displayed day always matches the canonical date
    })
}

export function formatRelativeTime(utcDateString: string, lang: string): string {
    const seconds = Math.floor((Date.now() - new Date(utcDateString).getTime()) / 1000)

    for (const {divisor, en, zh} of TIME_UNITS) {
        const count = Math.floor(seconds / divisor)
        if (count >= 1) {
            return lang === 'zh-Hans'
                ? `${count}${zh}前`
                : `${count} ${en}${count > 1 ? 's' : ''} ago`
        }
    }

    return lang === 'zh-Hans' ? '刚刚' : 'just now'
}

type TimeUnit = { divisor: number; en: string; zh: string }


const TIME_UNITS: TimeUnit[] = [
    {divisor: 31_536_000, en: 'year', zh: '年'},
    {divisor: 2_592_000, en: 'month', zh: '个月'},
    {divisor: 86_400, en: 'day', zh: '天'},
    {divisor: 3_600, en: 'hour', zh: '小时'},
    {divisor: 60, en: 'minute', zh: '分钟'},
]
