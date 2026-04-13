<script lang="ts" setup>
// Relative time conversion for <time data-utc-time="..."> elements is handled
// by the relativeTime.client plugin (app/plugins/relativeTime.client.ts).
import { SpeedInsights } from '@vercel/speed-insights/nuxt'
import { Analytics } from '@vercel/analytics/nuxt'
import {useTheme} from './composables/useTheme'

const {init} = useTheme()

// Prevent flash of wrong theme: inject a synchronous inline script that reads
// localStorage / prefers-color-scheme and sets data-theme before first paint.
useHead({
  script: [
    {
      innerHTML: `(function(){var t=localStorage.getItem('color-theme');var d=t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')})()`,
      tagPosition: 'head',
    },
  ],
})

onMounted(() => {
  init()
})
</script>

<template>
  <div class="app-shell">
    <FeedbackBanner/>
    <main class="app-main">
      <NuxtPage/>
    </main>
    <Footer/>
    <CookieBanner/>
    <SpeedInsights/>
    <Analytics/>
  </div>
</template>
