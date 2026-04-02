/**
 * useBrowserTranslation - Sets up browser translation trigger for non-English languages
 *
 * When a user is viewing the Chinese translation (?translation=zh-Hans), we set the document's
 * lang attribute to 'zh-Hans' to signal to the browser that automatic translation might be helpful,
 * even though the actual content is in English.
 */

export function useBrowserTranslation(lang: ComputedRef<'en' | 'zh'>) {
    useHead(
        computed(() => ({
            htmlAttrs: {
                lang: lang.value === 'en' ? 'en' : 'zh-Hans',
            },
        }))
    )
}

