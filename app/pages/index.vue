<script setup lang="ts">
import { getTodayDateString } from '~/utils/date';
import { detectBrowserLanguage } from '~/utils/language';

const detectRequestLanguage = (): 'en' | 'zh' => {
    const headers = useRequestHeaders(['accept-language'])
    const acceptLanguage = headers['accept-language']?.toLowerCase() ?? ''
    return acceptLanguage.includes('zh') ? 'zh' : 'en'
}

const preferredLang = useCookie<'en' | 'zh'>('preferred_lang')
const savedLang = preferredLang.value === 'zh' || preferredLang.value === 'en'
    ? preferredLang.value
    : null

const lang = savedLang ?? (import.meta.server ? detectRequestLanguage() : detectBrowserLanguage())

// Redirect before paint to avoid transient layout flashes.
await navigateTo(`/${lang}/${getTodayDateString()}`, { replace: true })
</script>

<template>
    <div class="loading">Redirecting to today's news...</div>
</template>

<style scoped>
.loading {
    padding: 2rem;
    text-align: center;
    font-size: 1.2rem;
}
</style>
