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

/** Formats a UTC ISO date string as a localized HH:MM time string. */
export function formatTimeUTC(dateString: string, locale: string): string {
    return new Date(dateString).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
    })
}

/** Convenience wrapper: formats a UTC ISO date string using a language code ('en' | 'zh'). */
export function displayTime(dateString: string, lang: string): string {
    return formatTimeUTC(dateString, lang === 'en' ? 'en-US' : 'zh-CN')
}
