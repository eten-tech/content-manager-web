<script lang="ts">
    import { _ as translate } from 'svelte-i18n';
    import { type ResourceContentStatus, ResourceContentStatusEnum } from '$lib/types/base';
    import { MediaTypeEnum, type ResourceContent, OpenedSupplementalSideBar } from '$lib/types/resources';
    import { Icon } from 'svelte-awesome';
    import checkCircleO from 'svelte-awesome/icons/checkCircleO';
    import ban from 'svelte-awesome/icons/ban';
    import StatusColor from './StatusColor.svelte';
    import Tooltip from '../Tooltip.svelte';
    import HistoryIcon from '$lib/icons/HistoryIcon.svelte';
    import CommentSidebarIcon from '$lib/icons/CommentSidebarIcon.svelte';
    import BookSidebarIcon from '$lib/icons/BookSidebarIcon.svelte';
    import type { CommentStores } from '$lib/stores/comments';
    import { onMount } from 'svelte';
    import PersonLinesIcon from '$lib/icons/PersonLinesIcon.svelte';
    import AudioPlayerModal from '../audioPlayer/AudioPlayerModal.svelte';
    import { currentPreferredOpenedSupplementalSideBar } from '$lib/stores/preferred-opened-supplemental-sidebar';
    import { Permission, userCan } from '$lib/stores/auth';

    interface Props {
        resourceContent: ResourceContent;
        sidebarHistoryAvailable: boolean;
        historySidebarOpen: boolean;
        onToggleHistoryPane: (animateOpen?: boolean) => void;
        commentStores: CommentStores;
        resourceContentStatuses: ResourceContentStatus[];
        selectedStepNumber: number | undefined;
        isMacOS?: boolean;
    }

    let {
        resourceContent,
        sidebarHistoryAvailable,
        historySidebarOpen,
        onToggleHistoryPane,
        commentStores,
        resourceContentStatuses,
        selectedStepNumber,
        isMacOS,
    }: Props = $props();

    const commentThreads = $derived(commentStores.commentThreads);

    const audioIsAvailable = $derived(!!(
        resourceContent.hasAudio && resourceContent.status === ResourceContentStatusEnum.Complete
    ));

    onMount(() => {
        if (sidebarHistoryAvailable && resourceContent.mediaType === MediaTypeEnum.text) {
            onToggleHistoryPane(false);
        }
    });

    const toggleOpenedSupplementalSideBar = (sidebar: OpenedSupplementalSideBar) => {
        if ($currentPreferredOpenedSupplementalSideBar === sidebar) {
            $currentPreferredOpenedSupplementalSideBar = OpenedSupplementalSideBar.None;
        } else {
            $currentPreferredOpenedSupplementalSideBar = sidebar;
        }
    };
</script>

<div class="my-1 flex w-full justify-between">
    <div class="flex flex-col">
        <div class="text-md mb-1 flex">
            <h1 class="me-4 font-bold">{resourceContent.englishLabel}</h1>
            <div class="flex items-end">{resourceContent.parentResourceName}</div>
        </div>
        <div class="text-md flex">
            <div class="me-4">
                {resourceContent.language.englishDisplay}
            </div>
            <div class="me-4 flex items-center">
                <StatusColor status={resourceContent.status} />
                {resourceContentStatuses.find((x) => x.status === resourceContent.status)?.displayName ??
                    $translate('page.resources.table.statuses.none.value')}
            </div>
            <div class="relative flex items-center">
                {#if resourceContent.hasPublishedVersion}
                    <Tooltip position={{ left: '1.5rem', top: '-0.25rem' }} text="Published">
                        <Icon data={checkCircleO} style="height: 18px; width: auto; color: #17b26a;" />
                    </Tooltip>
                {:else}
                    <Tooltip position={{ left: '1.5rem', top: '-0.25rem' }} text="Not Published">
                        <Icon data={ban} style="height: 18px; width: auto; color: #485467;" />
                    </Tooltip>
                {/if}

                {#if audioIsAvailable}
                    <AudioPlayerModal resources={resourceContent.audioResources} {selectedStepNumber} />
                {/if}
            </div>
        </div>
    </div>
    <div class="flex flex-col items-end space-y-1">
        {#if $userCan(Permission.AssignContent)}
            {#if resourceContent.assignedUser}
                <div class="text-md flex">
                    Assigned: {resourceContent.assignedUser.name}
                </div>
            {:else if resourceContent.status === ResourceContentStatusEnum.AquiferizeEditorReview || resourceContent.status === ResourceContentStatusEnum.TranslationEditorReview}
                <div class="text-md flex">Assigned: External User</div>
            {/if}
        {/if}
        <div class="flex">
            {#if sidebarHistoryAvailable && resourceContent.mediaType === MediaTypeEnum.text}
                <Tooltip
                    position={{ right: '3rem', top: '0.25rem' }}
                    text={historySidebarOpen ? 'Hide Versions' : 'Show Versions'}
                >
                    <button
                        data-app-insights-event-name="toggle-history-pane-click"
                        class="btn btn-ghost btn-sm me-1 {historySidebarOpen && 'bg-primary text-primary-content'}"
                        onclick={() => onToggleHistoryPane()}
                    >
                        <HistoryIcon />
                    </button>
                </Tooltip>
            {/if}
            {#if $commentThreads?.threads.length}
                {@const active = $currentPreferredOpenedSupplementalSideBar === OpenedSupplementalSideBar.Comments}
                <Tooltip
                    position={{ right: '3rem' }}
                    text={active ? 'Hide Comments' : 'Show Comments'}
                    secondLineText={`(CTRL+${isMacOS ? 'CMD' : 'ALT'}+M)`}
                >
                    <button
                        data-app-insights-event-name="toggle-comments-pane-click"
                        class="btn btn-ghost btn-sm me-1 {active && 'bg-primary text-primary-content'}"
                        onclick={() => toggleOpenedSupplementalSideBar(OpenedSupplementalSideBar.Comments)}
                    >
                        <CommentSidebarIcon />
                    </button>
                </Tooltip>
            {/if}
            <Tooltip
                position={{ right: '3rem' }}
                text={$currentPreferredOpenedSupplementalSideBar === OpenedSupplementalSideBar.BibleReferences
                    ? 'Hide Bible References'
                    : 'Show Bible References'}
                secondLineText={`(CTRL+${isMacOS ? 'CMD' : 'ALT'}+B)`}
            >
                <button
                    data-app-insights-event-name="toggle-bible-references-pane-click"
                    class="btn btn-ghost btn-sm me-1 {$currentPreferredOpenedSupplementalSideBar ===
                        OpenedSupplementalSideBar.BibleReferences && 'bg-primary text-primary-content'}"
                    onclick={() => toggleOpenedSupplementalSideBar(OpenedSupplementalSideBar.BibleReferences)}
                >
                    <BookSidebarIcon />
                </button>
            </Tooltip>
            {#if $userCan(Permission.AssignContent)}
                <Tooltip
                    position={{ right: '3rem' }}
                    text={$currentPreferredOpenedSupplementalSideBar === OpenedSupplementalSideBar.VersionStatusHistory
                        ? 'Hide Status History'
                        : 'Show Status History'}
                    secondLineText={`(CTRL+${isMacOS ? 'CMD' : 'ALT'}+H)`}
                >
                    <button
                        data-app-insights-event-name="toggle-status-history-pane-click"
                        class="btn btn-ghost btn-sm me-1 {$currentPreferredOpenedSupplementalSideBar ===
                            OpenedSupplementalSideBar.VersionStatusHistory && 'bg-primary text-primary-content'}"
                        onclick={() => toggleOpenedSupplementalSideBar(OpenedSupplementalSideBar.VersionStatusHistory)}
                    >
                        <PersonLinesIcon />
                    </button>
                </Tooltip>
            {/if}
        </div>
    </div>
</div>
