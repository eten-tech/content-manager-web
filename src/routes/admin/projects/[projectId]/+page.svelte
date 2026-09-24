<script lang="ts">
    import type { PageData } from './$types';
    import BackButton from '$lib/components/BackButton.svelte';
    import { log } from '$lib/logger';
    import { formatDate, requeueProjectPreTranslation } from '$lib/utils/projects';
    import {
        getSelectableProjectResources,
        filterSelectableResources,
        toResourceContentIdsPayload,
    } from '$lib/utils/project-resource-selection';
    import { isAuthorizationError } from '$lib/utils/http-errors';

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();

    const project = data.projectResponse;

    let shouldForceRetranslation = $state(false);
    let shouldSkipCompanyLeadAssignment = $state(false);
    let shouldSkipProjectStartedNotification = $state(false);
    let selectedResourceContentIds: number[] = $state([]);
    let resourceFilter = $state('');

    let isConfirming = $state(false);
    let isSaving = $state(false);
    let errorMessage: string | null = $state(null);
    let hasQueued = $state(false);

    const selectableResources = getSelectableProjectResources(project.items ?? []);

    let filteredResources = $derived(filterSelectableResources(selectableResources, resourceFilter));
    let areAllFilteredSelected = $derived(
        filteredResources.length > 0 &&
            filteredResources.every((r) => selectedResourceContentIds.includes(r.resourceContentId))
    );

    let scopeDescription = $derived(
        selectedResourceContentIds.length === 0
            ? `All ${selectableResources.length} resources in the project will be re-run.`
            : `${selectedResourceContentIds.length} selected resource${selectedResourceContentIds.length === 1 ? '' : 's'} will be re-run.`
    );

    function toggleResource(resourceContentId: number) {
        selectedResourceContentIds = selectedResourceContentIds.includes(resourceContentId)
            ? selectedResourceContentIds.filter((id) => id !== resourceContentId)
            : [...selectedResourceContentIds, resourceContentId];
    }

    function toggleAllFiltered() {
        const filteredIds = filteredResources.map((r) => r.resourceContentId);
        selectedResourceContentIds = areAllFilteredSelected
            ? selectedResourceContentIds.filter((id) => !filteredIds.includes(id))
            : [...new Set([...selectedResourceContentIds, ...filteredIds])];
    }

    async function queuePreTranslation() {
        isSaving = true;
        errorMessage = null;
        try {
            await requeueProjectPreTranslation(project.id, {
                shouldForceRetranslation,
                shouldSkipCompanyLeadAssignment,
                shouldSkipProjectStartedNotification,
                resourceContentIds: toResourceContentIdsPayload(selectedResourceContentIds),
            });
            hasQueued = true;
            isConfirming = false;
        } catch (error) {
            isConfirming = false;
            if (isAuthorizationError(error)) {
                errorMessage = 'You are not authorized';
            } else {
                log.exception(error);
                errorMessage = 'There was an error while queuing pre-translation.';
            }
        } finally {
            isSaving = false;
        }
    }

    function queueAnother() {
        hasQueued = false;
        errorMessage = null;
    }
</script>

<svelte:head>
    <title>Re-run Pre-Translation | Aquifer Admin</title>
</svelte:head>

<div class="short:h-full short:overflow-auto relative flex h-screen flex-col overflow-hidden px-8 py-4">
    <div class="mb-4 flex flex-row items-center">
        <BackButton defaultPathIfNoHistory="/projects" />
        <div class="text-3xl">Re-run Pre-Translation</div>
    </div>

    <div class="flex max-w-xl flex-col">
        <div class="flex flex-col border-b p-2">
            <div class="text-md font-bold">{project.name}</div>
            <div class="text-sm">Project ID {project.id} &middot; Started {formatDate(project.started)}</div>
        </div>

        {#if hasQueued}
            <div class="flex flex-col gap-2 p-2">
                <div class="text-md font-bold">Pre-translation queued</div>
                <div class="text-sm">
                    The run has been queued and will process in the background. Check the logs for progress.
                </div>
                <button class="btn btn-link self-start px-0" onclick={queueAnother}>Queue another run</button>
            </div>
        {:else}
            <div class="flex flex-col border-b p-2">
                <label class="flex flex-row items-start gap-2">
                    <input type="checkbox" class="checkbox mt-1" bind:checked={shouldForceRetranslation} />
                    <span>
                        <span class="text-md">Force re-translation</span>
                        <span class="block text-sm"
                            >Re-translate resources that already have an AI draft, starting from their original
                            snapshot.</span
                        >
                    </span>
                </label>
                {#if shouldForceRetranslation}
                    <div class="text-error pt-2 text-sm">
                        This overwrites current content, including edits a reviewer or editor may have in progress.
                    </div>
                {/if}
            </div>

            <div class="flex flex-col border-b p-2">
                <label class="flex flex-row items-start gap-2">
                    <input type="checkbox" class="checkbox mt-1" bind:checked={shouldSkipCompanyLeadAssignment} />
                    <span>
                        <span class="text-md">Skip company lead assignment</span>
                        <span class="block text-sm"
                            >Leave existing assignments alone instead of assigning translated resources to the company
                            lead.</span
                        >
                    </span>
                </label>
            </div>

            <div class="flex flex-col border-b p-2">
                <label class="flex flex-row items-start gap-2">
                    <input type="checkbox" class="checkbox mt-1" bind:checked={shouldSkipProjectStartedNotification} />
                    <span>
                        <span class="text-md">Skip project started notification</span>
                        <span class="block text-sm">Don't notify the company lead again when the run completes.</span>
                    </span>
                </label>
            </div>

            <div class="flex flex-col border-b p-2">
                <div class="flex flex-row items-center justify-between">
                    <div class="text-md">Resource Contents</div>
                    <div class="text-sm">
                        {selectedResourceContentIds.length} of {selectableResources.length} selected
                    </div>
                </div>
                <div class="pb-2 text-sm">Select none to re-run the whole project.</div>

                <div class="flex flex-row items-center gap-2 pb-2">
                    <input
                        class="input input-bordered input-sm w-full"
                        placeholder="Filter by title or ID"
                        bind:value={resourceFilter}
                    />
                    <button class="btn btn-sm" onclick={toggleAllFiltered} disabled={filteredResources.length === 0}>
                        {areAllFilteredSelected ? 'Clear' : 'Select all'}
                    </button>
                </div>

                <div class="max-h-72 overflow-y-auto rounded border">
                    {#each filteredResources as resource (resource.resourceContentId)}
                        <label class="flex cursor-pointer flex-row items-start gap-2 border-b p-2 last:border-b-0">
                            <input
                                type="checkbox"
                                class="checkbox checkbox-sm mt-1"
                                checked={selectedResourceContentIds.includes(resource.resourceContentId)}
                                onchange={() => toggleResource(resource.resourceContentId)}
                            />
                            <span class="flex flex-col">
                                <span class="text-sm">
                                    <span class="font-mono">{resource.resourceContentId}</span>
                                    {resource.label}
                                </span>
                                {#if resource.statusDisplayName}
                                    <span class="text-xs opacity-70">{resource.statusDisplayName}</span>
                                {/if}
                            </span>
                        </label>
                    {:else}
                        <div class="p-2 text-sm">
                            {selectableResources.length === 0
                                ? 'This project has no resources that can be re-run.'
                                : 'No resources match that filter.'}
                        </div>
                    {/each}
                </div>
            </div>

            <div class="flex w-full flex-row items-center justify-end pt-4">
                {#if errorMessage}
                    <div class="text-error pr-2">{errorMessage}</div>
                {/if}
                {#if isConfirming}
                    <div class="flex flex-col items-end gap-2">
                        <div class="text-sm">
                            Re-run pre-translation for <span class="font-bold">{project.name}</span>?
                            <span class="block">{scopeDescription}</span>
                        </div>
                        <div class="flex flex-row gap-2">
                            <button class="btn" onclick={() => (isConfirming = false)} disabled={isSaving}>
                                Cancel
                            </button>
                            <button class="btn btn-primary" onclick={queuePreTranslation} disabled={isSaving}>
                                {#if isSaving}
                                    <span class="loading loading-spinner"></span>
                                {:else}
                                    Yes, re-run
                                {/if}
                            </button>
                        </div>
                    </div>
                {:else}
                    <button class="btn btn-primary" onclick={() => (isConfirming = true)}>
                        Re-run Pre-Translation
                    </button>
                {/if}
            </div>
        {/if}
    </div>
</div>
