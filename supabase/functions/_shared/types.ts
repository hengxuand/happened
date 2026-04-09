/* =======================
   google_news_rss
   ======================= */

/** Full row returned by SELECT * FROM google_news_rss */
export interface GoogleNewsRss {
    id: string;
    topic: string;
    language: string;
    title: string;
    source: string | null;
    pub_date: string;
    guid: string;
    link: string | null;
    description: string | null;
    importance_score: number | null;
    importance_scored_at: string | null;
    updated_at: string | null;
    created_at: string;
}
