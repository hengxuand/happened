<template>
    <article class="news-item" :class="{ expanded: expanded }">
        <div class="news-summary" @click="$emit('toggle', item.id)">
            <div class="summary-content">
                <h2 class="title">{{ item.title }}</h2>
                <div class="summary-meta">
                    <div class="meta-left">
                        <span v-if="item.topic" class="category">{{ translateTopic(item.topic) }}</span>
                        <span class="source">{{ item.source }}</span>
                    </div>
                    <div class="meta-right">
                        <time v-if="item.pub_date" :datetime="item.pub_date" :data-utc-time="item.pub_date" :data-lang="lang">
                            {{ displayTime(item.pub_date, lang) }}
                        </time>
                        <div class="chevron" aria-hidden="true">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-show="expanded" class="news-details">
            <div v-if="item.description" class="related-articles">
                <h3>{{ lang === 'en' ? 'Related Articles:' : '相关报道:' }}</h3>
                <div v-html="item.description"></div>
            </div>
        </div>
    </article>
</template>

<script setup lang="ts">
import { useTopics } from '~/composables/useTopics'
import { displayTime } from '~/utils/date'
import type { NewsItem } from '~/types'

const props = defineProps<{
    item: NewsItem
    expanded: boolean
}>()

defineEmits<{
    toggle: [id: string]
}>()

const route = useRoute()
const lang = computed(() => route.params.lang === 'en' ? 'en' : 'zh-Hans')
const { translateTopic } = useTopics(lang)
</script>

<style scoped>
.news-item {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-bottom: 3px solid var(--color-primary-light);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: var(--transition-fast);
    box-shadow: var(--shadow-sm);
}

.news-item:hover {
    box-shadow: var(--shadow-lg);
}

.news-summary {
    padding: 16px 18px 10px 18px;
    cursor: pointer;
    display: block;
}

.summary-content {
    width: 100%;
}

.summary-content h2.title {
    margin: 0;
    font-family: inherit;
    font-size: clamp(1.2rem, 1.9vw, 1.7rem);
    line-height: 1.2;
    letter-spacing: -0.006em;
    color: var(--color-text-primary);
    font-weight: 700;
}

.summary-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    font-size: 0.9rem;
    color: var(--color-text-tertiary);
    gap: 0.75rem;
}

.meta-left {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.meta-right {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
}

.chevron {
    display: inline-flex;
    align-items: center;
    color: var(--color-text-tertiary);
    transition: transform 0.2s ease;
}

.news-item.expanded .chevron {
    transform: rotate(180deg);
}

.news-details {
    padding: 0 var(--spacing-lg) var(--spacing-lg) var(--spacing-lg);
    border-top: 1px solid var(--color-border-secondary);
    background: var(--color-bg-detail);
}

.category {
    background: var(--color-bg-secondary);
    color: var(--color-text-tertiary);
    padding: 0.1rem 0.4rem;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 0.75rem;
}

.source {
    font-weight: 500;
    font-size: 0.95rem;
    color: var(--color-text-tertiary);
}

time {
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--color-text-tertiary);
    white-space: nowrap;
}

.related-articles {
    margin: var(--spacing-md) 0 0 0;
    padding: var(--spacing-md);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
}

.related-articles h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    color: var(--color-text-secondary);
    font-weight: 600;
}

.related-articles :deep(ol) {
    margin: 0;
    padding-left: var(--spacing-lg);
    list-style: decimal;
}

.related-articles :deep(li) {
    margin-bottom: var(--spacing-sm);
    line-height: 1.6;
}

.related-articles :deep(a) {
    color: var(--color-link);
    text-decoration: none;
    font-weight: 500;
}

.related-articles :deep(a:hover) {
    color: var(--color-link-hover);
    text-decoration: underline;
}

.related-articles :deep(font) {
    color: var(--color-text-tertiary);
    font-size: 0.875rem;
    margin-left: var(--spacing-sm);
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
    .news-summary {
        padding: 12px 14px 9px 14px;
    }

    .summary-meta {
        margin-top: 8px;
        font-size: 0.82rem;
    }

    .summary-content h2.title {
        font-size: 1.35rem;
        line-height: 1.2;
    }

    .news-details {
        padding: 0 var(--spacing-md) var(--spacing-md) var(--spacing-md);
    }

    .related-articles {
        padding: var(--spacing-sm);
    }

    .related-articles h3 {
        font-size: 0.9rem;
    }

    .related-articles :deep(li) {
        font-size: 0.9rem;
    }
}

@media (max-width: 480px) {
    .summary-content h2.title {
        font-size: 1.15rem;
        line-height: 1.22;
    }

    .summary-meta {
        font-size: 0.78rem;
    }
}
</style>
