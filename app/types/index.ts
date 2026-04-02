export type SupportedLang = 'en' | 'zh-Hans'

export interface NewsItem {
    id: string
    topic: string
    language: string
    title: string
    source: string
    pub_date: string
    guid: string
    link: string | null
    description: string | null
    created_at: string
}
