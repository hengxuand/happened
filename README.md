# Happened

A minimalist, fast, and privacy-focused news aggregation service built with Nuxt 4. It fetches daily headlines from Google News RSS feeds and presents them in a clean, distraction-free interface.

## Features

- **Daily Snapshots:** Pre-rendered daily news pages for fast loading.
- **Bilingual Support:** Automatically detects browser language (English/Chinese) and routes accordingly.
- **Minimalist Design:** Black and white theme focused purely on content readability.
- **Privacy First:** No cross-site tracking cookies, no invasive ads.

## Tech Stack

- **Framework:** [Nuxt 4](https://nuxt.com/) (Vue 3)
- **Database/Backend:** [Supabase](https://supabase.com/)
- **Analytics:** Vercel Analytics & SpeedInsights
- **Deployment:** Vercel

## Privacy & Compliance

Happened.info is designed to respect user privacy and comply with modern web standards (GDPR, CCPA):

- **Cookies:** We use a single essential `localStorage` item (`cookie-consent`) to remember if a user has dismissed the cookie banner.
- **Analytics:** We use Vercel Analytics to collect anonymized, aggregated usage data (page views, session duration). This data cannot be used to identify individual users.
- **Data Collection:** We do not collect personal information. The only data stored is the user's language preference and anonymized technical logs.
- **External Links:** All news headlines link directly to the original publisher's website. We do not host full articles.

For full details, see our [Privacy Policy](https://happened.info/privacy-policy) and [Terms of Service](https://happened.info/terms-of-service).

## Setup & Development

### Prerequisites

- Node.js (v18+)
- A Supabase project

### Environment Variables

Create a `.env.local` file in the root directory with your Supabase credentials:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

### Installation

```bash
npm install
```

### Development Server

Start the development server on `http://localhost:3000`:

```bash
npm run dev
```

### Production Build

Build the application for production:

```bash
npm run build
```

Locally preview the production build:

```bash
npm run preview
```

## License

This project is open-source and available under the MIT License. News content and headlines belong to their respective publishers.
