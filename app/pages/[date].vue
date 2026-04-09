<template>
  <div class="container">
    <div v-if="showDatePicker" class="picker-backdrop" @click="showDatePicker = false"/>
    <div class="header">
      <div class="header-top">
        <div class="logo">
          <img :src="isDark ? logoDark : logoLight" alt="Happened.info"/>
          <h1>Happened.info</h1>
        </div>
        <div class="header-controls">
          <div class="lang-switcher">
            <!--            <NuxtLink :class="{ active: lang === 'zh-Hans' }" :to="`/${paramDate}?translation=zh-Hans`"-->
            <!--                      class="lang-button">中文-->
            <!--            </NuxtLink>-->
            <NuxtLink :class="{ active: lang === 'en' }" :to="`/${paramDate}`" class="lang-button">English
            </NuxtLink>
          </div>
          <button :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
                  :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" class="theme-toggle" @click="toggle">
            <Icon :name="isDark ? 'lucide:sun' : 'lucide:moon'" size="18"/>
          </button>
        </div>
      </div>

      <div class="date-navigation">
        <NuxtLink :to="previousDateLink" class="nav-button nav-button--prev">
          <Icon class="nav-icon" name="lucide:chevron-left" size="18"/>
          <span>{{ lang === 'en' ? 'Previous Day' : '前一天' }}</span>
        </NuxtLink>

        <div class="center-group">
          <button
              :aria-expanded="showDatePicker"
              :title="lang === 'en' ? 'Pick a date' : '选择日期'"
              aria-haspopup="dialog"
              class="current-date"
              @click="toggleDatePicker"
          >
            <span>{{ formattedCurrentDate }}</span>
            <Icon class="date-cal-icon" name="lucide:calendar" size="15"/>
          </button>

          <Transition name="picker-pop">
            <div v-if="showDatePicker" class="date-picker-popover" role="dialog">
              <div class="date-picker-label">
                <Icon name="lucide:calendar-days" size="13"/>
                {{
                  lang === 'en' ? `Jump to date (after ${MIN_VALID_DATE})` : '跳转到日期'
                }}
              </div>
              <input
                  ref="dateInputRef"
                  :max="todayDate"
                  :min="MIN_VALID_DATE"
                  :value="paramDate"
                  class="date-picker-input"
                  type="date"
                  @change="onDatePicked"
              />
            </div>
          </Transition>

          <div class="date-timezone-hint">
            {{ lang === 'en' ? 'Date shown in UTC timezone' : '日期按 UTC 时区显示' }}
          </div>
          <NuxtLink :class="{ 'today-link--hidden': isToday }" :to="todayDateLink" class="today-link">
            <Icon class="today-icon" name="lucide:fast-forward" size="13"/>
            {{ lang === 'en' ? 'Jump to Today' : '回到今天' }}
          </NuxtLink>
        </div>

        <NuxtLink :class="{ disabled: isFuture }" :to="nextDateLink" class="nav-button nav-button--next">
          <span>{{ lang === 'en' ? 'Next Day' : '后一天' }}</span>
          <Icon class="nav-icon" name="lucide:chevron-right" size="18"/>
        </NuxtLink>
      </div>
    </div>

    <!-- Category Filter Bar -->
    <div v-if="!pending && !error && categories.length > 0" class="category-filter">
      <button :class="{ active: !selectedCategory }" class="filter-button"
              @click="selectedCategory = null">
        {{ lang === 'en' ? 'All' : '全部' }}
        <span class="count">{{ newsItems?.length || 0 }}</span>
      </button>
      <button v-for="category in categories" :key="category" :class="{ active: selectedCategory === category }"
              class="filter-button" @click="selectedCategory = category">
        {{ translateTopic(category) }}
        <span class="count">{{ getCategoryCount(category) }}</span>
      </button>
      <div class="search-box">
        <input
            v-model="searchQuery"
            :class="{ 'has-value': searchQuery.length > 0 }"
            aria-label="Search"
            class="search-input"
            placeholder="Search for this day..."
            type="text"
        />
        <button
            v-if="searchQuery.length > 0"
            aria-label="Clear search"
            class="search-clear"
            @click="searchQuery = ''"
        >&#x2715;
        </button>
      </div>
    </div>

    <div v-if="pending" class="loading">{{ lang === 'en' ? 'Loading news items...' : '加载新闻中...' }}</div>

    <div v-else-if="error" class="error">
      {{ lang === 'en' ? 'Error loading news:' : '加载新闻出错:' }} {{ error.message }}
    </div>

    <div v-else-if="filteredNewsItems && filteredNewsItems.length > 0" class="news-list">
      <NewsItem
          v-for="item in filteredNewsItems"
          :key="item.id"
          :expanded="isExpanded(item.id)"
          :item="item"
          @toggle="toggleItem"
      />
    </div>

    <div v-else class="empty">
      {{ lang === 'en' ? 'No news items found for this date.' : '当天没有新闻' }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import {useSeoHead} from '~/composables/useSeoHead'
import {useTopics} from '~/composables/useTopics'
import {useNewsUiStore} from '~/stores/newsUi'
import type {NewsItem, SupportedLang} from '~/types'
import {storeToRefs} from 'pinia'
import logoLight from '~/assets/images/logo.svg'
import logoDark from '~/assets/images/logo-dark.svg'
import {
  formatDisplayDate,
  getOffsetDateString,
  getTodayDateString,
  isValidAppDate,
  MIN_VALID_DATE
} from '~/utils/datetime'

// ─── Route & reactive state ───────────────────────────────────────────────────

const route = useRoute()
const supabase = useSupabaseClient()

const paramDate = computed(() => route.params.date as string)
const lang = computed<SupportedLang>(() => route.query.translation === 'zh-Hans' ? 'zh-Hans' : 'en')

const preferredLang = useCookie<SupportedLang>('preferred_lang', {
  path: '/',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 365,
})

watch(lang, (nextLang) => {
  preferredLang.value = nextLang
}, {immediate: true})

const {translateTopic} = useTopics(lang)
const newsUiStore = useNewsUiStore()
const {selectedCategory, searchQuery} = storeToRefs(newsUiStore)
const {toggleItem, isExpanded, resetExpanded} = newsUiStore

watch([paramDate, lang], () => {
  resetExpanded()
})

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Today's date as YYYY-MM-DD (UTC). */
const todayDate = computed(getTodayDateString)

const isToday = computed(() => paramDate.value === todayDate.value)
const isFuture = computed(() => paramDate.value >= todayDate.value)

// ─── Route guard: redirect invalid dates to today ─────────────────────────────

if (!isValidAppDate(paramDate.value)) {
  await navigateTo(`/${todayDate.value}`, {replace: true})
}

const previousDate = computed(() => getOffsetDateString(paramDate.value, -1))
const nextDate = computed(() => getOffsetDateString(paramDate.value, +1))
const formattedCurrentDate = computed(() =>
    formatDisplayDate(paramDate.value, lang.value === 'en' ? 'en-US' : 'zh-CN')
)

// ─── Navigation links with translation query param ────────────────────────────

const buildDateLink = (date: string): string => {
  return lang.value === 'zh-Hans' ? `/${date}?translation=zh-Hans` : `/${date}`
}

const previousDateLink = computed(() => buildDateLink(previousDate.value))
const nextDateLink = computed(() => buildDateLink(nextDate.value))
const todayDateLink = computed(() => buildDateLink(todayDate.value))

// ─── Data fetching ────────────────────────────────────────────────────────────

const {data: newsItems, pending, error} = await useAsyncData(
    `news-${paramDate.value}`,
    async () => {
      // Use explicit UTC boundaries so SSG output is consistent regardless of
      // the server/client timezone.
      const startOfDay = `${paramDate.value}T00:00:00.000Z`
      const endOfDay = `${paramDate.value}T23:59:59.999Z`

      const {data, error} = await supabase
          .from('google_news_rss')
          .select('*')
          .eq('language', 'en')
          .gte('pub_date', startOfDay)
          .lte('pub_date', endOfDay)
          .or('importance_score.gte.85,importance_score.is.null')
          .order('pub_date', {ascending: false})

      if (error) {
        console.error('Failed to fetch news:', error)
        throw error
      }
      return data as NewsItem[]
    },
    {watch: [paramDate]}
)

const categories = computed<string[]>(() => {
  if (!newsItems.value) return []
  return [...new Set(
      newsItems.value
          .map(item => item.topic)
          .filter((t): t is string => Boolean(t))
  )].sort()
})

const filteredNewsItems = computed<NewsItem[]>(() => {
  let items = newsItems.value ?? []

  if (selectedCategory.value !== null) {
    items = items.filter(item => item.topic === selectedCategory.value)
  }

  const query = searchQuery.value.trim().toLowerCase()
  if (query.length >= 3) {
    items = items.filter(item => item.title.toLowerCase().includes(query))
  }

  return items
})

const getCategoryCount = (category: string): number =>
    newsItems.value?.filter(item => item.topic === category).length ?? 0

// ─── Theme ───────────────────────────────────────────────────────────────────

const {isDark, toggle} = useTheme()

// ─── Date picker popover ──────────────────────────────────────────────────────

const router = useRouter()
const showDatePicker = ref(false)
const dateInputRef = ref<HTMLInputElement | null>(null)

const toggleDatePicker = async () => {
  showDatePicker.value = !showDatePicker.value
  if (showDatePicker.value) {
    await nextTick()
    dateInputRef.value?.focus()
    dateInputRef.value?.showPicker?.()
  }
}

const onDatePicked = (e: Event) => {
  const date = (e.target as HTMLInputElement).value
  const isValid = isValidAppDate(date)

  if (!isValid) return

  showDatePicker.value = false
  if (date !== paramDate.value) {
    router.push(buildDateLink(date))
  }
}

// Close picker on Escape key
watch(showDatePicker, (val) => {
  if (val) {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') showDatePicker.value = false
    }
    document.addEventListener('keydown', onKey)
    const stop = watch(showDatePicker, (v) => {
      if (!v) {
        document.removeEventListener('keydown', onKey)
        stop()
      }
    })
  }
})

// ─── SEO / hreflang ───────────────────────────────────────────────────────────

useSeoHead(paramDate, lang, formattedCurrentDate)

</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, -apple-system, sans-serif;
}

.header {
  margin-bottom: 2rem;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.logo img {
  height: 48px;
  width: auto;
}

h1 {
  color: var(--color-text-primary);
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.lang-switcher {
  display: flex;
  gap: 0.5rem;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: var(--transition-fast);
  flex-shrink: 0;
}

.theme-toggle:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-primary-light);
  color: var(--color-text-primary);
}

.lang-button {
  padding: var(--spacing-sm) var(--spacing-md);
  text-decoration: none;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  transition: var(--transition-fast);
}

.lang-button:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-primary);
}

.lang-button.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.date-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--gradient-bg);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-md);
}

.current-date {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
  font-family: inherit;
}

.current-date:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-primary);
}

.current-date:active {
  transform: scale(0.97);
}

.current-date:focus-visible {
  outline: 2px solid var(--color-primary-light);
  outline-offset: 2px;
}

.date-cal-icon {
  opacity: 0.45;
  flex-shrink: 0;
  transition: opacity 0.18s ease;
}

.current-date:hover .date-cal-icon {
  opacity: 0.85;
}

.center-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  position: relative;
}

/* ── Date picker popover ────────────────────────────────────────────────────── */

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.date-picker-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 220px;
}

.date-picker-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.date-picker-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 0.95rem;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
  color-scheme: light dark;
}

.date-picker-input:focus {
  outline: none;
  border-color: var(--color-primary-light);
  box-shadow: var(--shadow-sm);
}

/* ── Popover enter/leave transition ─────────────────────────────────────────── */

.picker-pop-enter-active,
.picker-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.picker-pop-enter-from,
.picker-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px) scale(0.97);
}

.today-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-weight: 500;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-full);
  background: var(--color-bg-secondary);
  opacity: 1;
  visibility: visible;
  transition: opacity 0.3s ease, visibility 0.3s ease, background 0.18s ease,
  border-color 0.18s ease, color 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease;
  cursor: pointer;
  user-select: none;
}

.today-link:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-primary-light);
  color: var(--color-text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.today-link:active {
  transform: scale(0.96);
  box-shadow: none;
}

.today-link:focus-visible {
  outline: 2px solid var(--color-primary-light);
  outline-offset: 2px;
}

.today-link--hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.date-timezone-hint {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  text-align: center;
}

.nav-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem var(--spacing-md);
  background: var(--gradient-primary);
  color: white;
  text-decoration: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.9rem;
  transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  user-select: none;
  border: 1px solid transparent;
}

.nav-button:hover:not(.disabled) {
  background: var(--gradient-primary-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.nav-button:active:not(.disabled) {
  transform: translateY(0) scale(0.97);
  box-shadow: var(--shadow-sm);
  opacity: 0.9;
}

.nav-button:focus-visible {
  outline: 2px solid var(--color-primary-light);
  outline-offset: 3px;
}

.nav-button .nav-icon {
  flex-shrink: 0;
  transition: transform 0.18s ease;
}


.nav-button--prev:hover:not(.disabled) .nav-icon {
  transform: translateX(-3px);
}

.nav-button--next:hover:not(.disabled) .nav-icon {
  transform: translateX(3px);
}

.nav-button.disabled {
  background: var(--color-disabled);
  cursor: not-allowed;
  pointer-events: none;
  box-shadow: none;
  opacity: 0.6;
}

.loading,
.error,
.empty {
  padding: var(--spacing-xl);
  text-align: center;
  font-size: 1.2rem;
}

.error {
  color: var(--color-error);
  background: var(--color-error-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-error-border);
}

.news-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.category-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: var(--spacing-lg);
  background: var(--color-bg-primary);
  border: none;
  border-bottom: 3px solid var(--color-secondary);
  margin-bottom: var(--spacing-xl);
}

.filter-button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: var(--transition-fast);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.filter-button:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.filter-button.active {
  background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-dark) 100%);
  color: white;
  border-color: var(--color-secondary-dark);
  box-shadow: var(--shadow-sm);
}

.filter-button .count {
  background: var(--opacity-overlay);
  padding: 0.125rem var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
}

.filter-button.active .count {
  background: var(--opacity-overlay-light);
}

.search-box {
  margin-left: auto;
  flex-shrink: 0;
  width: 200px;
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  transition: var(--transition-fast);
}

.search-input.has-value {
  padding-right: 2rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
  background: var(--color-bg-primary);
}

.search-input::placeholder {
  color: var(--color-text-muted);
  font-weight: 400;
}

.search-clear {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  transition: var(--transition-fast);
}

.search-clear:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  .header-top {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .header-controls {
    width: 100%;
    justify-content: center;
  }

  .logo {
    width: 100%;
    justify-content: center;
  }

  .logo img {
    height: 36px;
  }

  h1 {
    font-size: 1.5rem;
  }

  .lang-switcher {
    width: 100%;
    justify-content: center;
  }

  .lang-button {
    flex: 1;
    text-align: center;
  }

  .date-navigation {
    flex-direction: column;
    gap: 0.75rem;
    padding: var(--spacing-md);
  }

  .nav-button {
    width: 100%;
    justify-content: center;
    padding: 0.65rem var(--spacing-md);
  }

  .center-group {
    order: -1;
    width: 100%;
  }

  .current-date {
    font-size: 1.1rem;
  }

  .category-filter {
    gap: 0.5rem;
    padding: var(--spacing-md);
  }

  .filter-button {
    font-size: 0.85rem;
    padding: 0.4rem 0.75rem;
  }

  .search-box {
    width: 100%;
    flex-shrink: 1;
    margin-left: 0;
  }

}

@media (max-width: 480px) {
  .container {
    padding: 0.75rem;
  }

  h1 {
    font-size: 1.25rem;
  }

  .logo img {
    height: 32px;
  }

  .current-date {
    font-size: 1rem;
  }

  .filter-button {
    font-size: 0.8rem;
    padding: 0.35rem 0.6rem;
  }

  .filter-button .count {
    font-size: 0.75rem;
  }

  .search-input {
    font-size: 0.8rem;
    padding: 0.35rem 0.6rem;
  }
}
</style>

