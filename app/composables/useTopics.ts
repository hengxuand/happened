import type {ComputedRef} from 'vue'
import type {SupportedLang} from '~/types'

/** Maps English topic keys to their Chinese display labels. */
const TOPIC_LABELS_ZH: Record<string, string> = {
    WORLD: '世界',
    NATION: '国家',
    BUSINESS: '商业',
    TECHNOLOGY: '科技',
    ENTERTAINMENT: '娱乐',
    SCIENCE: '科学',
    SPORTS: '体育',
    HEALTH: '健康',
    POLITICS: '政治',
}

/**
 * Provides topic translation helpers for the given reactive language.
 */
export function useTopics(lang: ComputedRef<SupportedLang>) {
    const translateTopic = (topic: string): string => {
        if (lang.value === 'zh-Hans') return TOPIC_LABELS_ZH[topic] ?? topic
        return topic
    }

    return {translateTopic}
}
