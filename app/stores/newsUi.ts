import { defineStore } from 'pinia'

export const useNewsUiStore = defineStore('news-ui', () => {
    const selectedCategory = ref<string | null>(null)
    const searchQuery = ref('')
    const expandedItemIds = ref<string[]>([])

    const toggleItem = (id: string) => {
        if (expandedItemIds.value.includes(id)) {
            expandedItemIds.value = expandedItemIds.value.filter(itemId => itemId !== id)
            return
        }

        expandedItemIds.value = [...expandedItemIds.value, id]
    }

    const isExpanded = (id: string) => expandedItemIds.value.includes(id)

    const resetExpanded = () => {
        expandedItemIds.value = []
    }

    return {
        selectedCategory,
        searchQuery,
        toggleItem,
        isExpanded,
        resetExpanded,
    }
})
