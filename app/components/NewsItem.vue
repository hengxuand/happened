<template>
    <article class="news-item" :class="{ expanded: expanded }">
        <div class="news-summary" @click="$emit('toggle', item.id)">
            <div class="summary-content">
                <h2>
                    <span v-if="item.topic" class="category">{{ translateTopic(item.topic) }}</span>
                    <span class="source">{{ item.source }}</span>
                </h2>
                <h2 class="title">{{ item.title }}</h2>
            </div>
            <div class="summary-meta">
                <time v-if="item.pub_date" :datetime="item.pub_date" :data-utc-time="item.pub_date" :data-lang="lang">
                    {{ displayTime(item.pub_date, lang) }}
                </time>
                <div class="chevron">
                    <svg width="28" height="28" viewBox="0 0 20 20" fill="none"
                        xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
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
const lang = computed(() => route.params.lang === 'en' ? 'en' : 'zh')
const { translateTopic } = useTopics(lang)
</script>

<style scoped>
.news-item {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: var(--transition-fast);
}

.news-item:hover {
    box-shadow: var(--shadow-lg);
    border-color: var(--color-primary-light);
}

.news-summary {
    padding: var(--spacing-lg);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-md);
}

.summary-content {
    flex: 1;
}

.summary-content h2.title {
    font-size: 1.25rem;
    line-height: 1.6;
    color: var(--color-text-primary);
    margin-top: var(--spacing-md);
}

.summary-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    color: var(--color-text-muted);
    font-size: 1.125rem;
    white-space: nowrap;
    padding-top: var(--spacing-xs);
}

.chevron {
    transition: var(--transition-smooth);
    display: flex;
    align-items: center;
    color: var(--color-text-muted);
}

.news-item.expanded .chevron {
    transform: rotate(180deg);
}

.news-details {
    padding: 0 var(--spacing-lg) var(--spacing-lg) var(--spacing-lg);
    border-top: 1px solid var(--color-border-secondary);
    background: var(--color-bg-detail);
}

.news-item h2 {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
    margin: 0;
    font-size: 1.25rem;
    line-height: 1.6;
    color: var(--color-text-primary);
}

.news-item h2 .category {
    background: var(--gradient-primary);
    color: white;
    padding: var(--spacing-xs) 0.75rem;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
}

.news-item h2 .source {
    font-weight: 400;
    font-size: 0.95rem;
    color: var(--color-text-secondary);
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
        flex-direction: column;
        gap: var(--spacing-sm);
        padding: var(--spacing-md);
    }

    .summary-meta {
        width: 100%;
        justify-content: space-between;
        padding-top: 0;
    }

    .news-item h2 {
        font-size: 1.1rem;
    }

    .news-item h2 .category {
        font-size: 0.8rem;
        padding: 0.25rem 0.5rem;
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
    .news-item h2 {
        font-size: 1rem;
    }

    .summary-meta {
        font-size: 1rem;
    }
}
</style>
