<script lang="ts">
    import { Icon } from 'svelte-awesome';
    import fileTextO from 'svelte-awesome/icons/fileTextO';
    import fileImageO from 'svelte-awesome/icons/fileImageO';
    import fileVideoO from 'svelte-awesome/icons/fileVideoO';
    import fileAudioO from 'svelte-awesome/icons/fileAudioO';
    import { type AssociatedResource, MediaTypeEnum } from '$lib/types/resources';
    import EmptyMessage from '../EmptyMessage.svelte';
    import { getFromApi } from '$lib/utils/http-service';
    import { log } from '$lib/logger';
    import CenteredSpinner from '$lib/components/CenteredSpinner.svelte';

    interface WorksCitedResponse {
        associatedResources: AssociatedResource[];
    }

    interface Props {
        currentResourceId: number;
    }

    let { currentResourceId }: Props = $props();

    let isLoading = $state(false);
    let contentLoaded = $state(false);
    let relatedContent: AssociatedResource[] = $state([]);

    function getIcon(type: string | undefined) {
        switch (type) {
            case MediaTypeEnum.image:
                return fileImageO;
            case MediaTypeEnum.video:
                return fileVideoO;
            case MediaTypeEnum.audio:
                return fileAudioO;
            default:
                return fileTextO;
        }
    }

    async function lazyLoadWorksCited() {
        if (contentLoaded) return;

        isLoading = true;

        try {
            const response = await getFromApi<WorksCitedResponse>(
                `/resources/content/${currentResourceId}/works-cited`
            );
            relatedContent = response.associatedResources;
        } catch (error) {
            log.exception(error);
        } finally {
            isLoading = false;
            contentLoaded = true;
        }
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="dropdown ms-1" data-app-insights-event-name="works-cited-menu-click" onclick={lazyLoadWorksCited}>
    <button tabindex="0" class="btn btn-ghost hover:bg-primary hover:text-primary-content ms-2 px-1 whitespace-nowrap">
        Works Cited
    </button>
    <div
        role="button"
        tabindex="0"
        class="menu dropdown-content rounded-box bg-base-100 z-1 mt-4 max-h-72 w-auto border pt-4 shadow-sm"
    >
        {#if isLoading}
            <div class="p-16">
                <CenteredSpinner />
            </div>
        {:else}
            <div class="flex flex-col overflow-y-auto px-8">
                {#each relatedContent as resource, i (i)}
                    <div class="me-2 mb-4 flex">
                        <div class="flex items-center">
                            <Icon data={getIcon(resource.mediaTypes[0])} scale={2} />
                        </div>
                        <div class="ms-4 flex flex-col">
                            {#if resource.contentId}
                                <a
                                    href={`/resources/${resource.contentId}`}
                                    class="text-primary text-lg font-bold whitespace-nowrap">{resource.englishLabel}</a
                                >
                            {:else}
                                <span class="text-lg font-bold whitespace-nowrap">{resource.englishLabel}</span>
                            {/if}
                            <span class="whitespace-nowrap">{resource.parentResourceName}</span>
                        </div>
                    </div>
                {:else}
                    <EmptyMessage message="No related content" />
                {/each}
            </div>
        {/if}
    </div>
</div>
