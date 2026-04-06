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
  pub_date: string;           // TIMESTAMPTZ → ISO string
  guid: string;
  link: string | null;
  description: string | null;
  importance_score: number | null;
  importance_scored_at: string | null;
  updated_at: string | null;
  created_at: string;
}

/** Columns required / accepted on INSERT */
export type GoogleNewsRssInsert = Pick<
  GoogleNewsRss,
  "topic" | "language" | "title" | "guid"
> &
  Partial<
    Pick<
      GoogleNewsRss,
      "source" | "pub_date" | "link" | "description" | "importance_score" | "importance_scored_at"
    >
  >;

/** Columns accepted on UPDATE / UPSERT (id required to target the row) */
export type GoogleNewsRssUpdate = Pick<GoogleNewsRss, "id"> &
  Partial<
    Omit<GoogleNewsRss, "id" | "created_at">
  >;

