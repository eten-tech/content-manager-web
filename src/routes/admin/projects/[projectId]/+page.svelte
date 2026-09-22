<script lang="ts">
    import type { PageData } from './$types';
    import BackButton from '$lib/components/BackButton.svelte';
    import { log } from '$lib/logger';
    import { formatDate, requeueProjectPreTranslation } from '$lib/utils/projects';
    import { parseResourceContentIds } from '$lib/utils/resource-content-ids';
    import { isAuthorizationError } from '$lib/utils/http-errors';

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();

    const project = data.projectResponse;

    let shouldForceRetranslation = $state(false);
    let shouldSkipCompanyLeadAssignment = $state(false);
    let shouldSkipProjectStartedNotification = $state(false);
    let resourceContentIdsInput = $state('');

    let isConfirming = $state(false);
    let isSaving = $state(false);
    let errorMessage: string | null = $state(null);
    let hasQueued = $state(false);

    let parsedResourceContentIds = $derived(parseResourceContentIds(resourceContentIdsInput));
    let canQueue = $derived(parsedResourceContentIds.invalid.length === 0);

    async function queuePreTranslation() {
        if (!canQueue) return;
        isSaving = true;
        errorMessage = null;
        try {
            await requeueProjectPreTranslation(project.id, {
                shouldForceRetranslation,
                shouldSkipCompanyLeadAssignment,
                shouldSkipProjectStartedNotification,
                resourceContentIds: parsedResourceContentIds.ids.length > 0 ? parsedResourceContentIds.ids : null,
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
                <div class="text-md">Resource Content IDs</div>
                <div class="pb-1 text-sm">Leave blank to re-run the whole project.</div>
                <input
                    class="input input-bordered w-full"
                    placeholder="e.g. 1890, 1891"
                    bind:value={resourceContentIdsInput}
                />
                {#if parsedResourceContentIds.invalid.length > 0}
                    <div class="text-error pt-1 text-sm">
                        Not valid resource content IDs: {parsedResourceContentIds.invalid.join(', ')}
                    </div>
                {:else if parsedResourceContentIds.ids.length > 0}
                    <div class="pt-1 text-sm">
                        {parsedResourceContentIds.ids.length} resource{parsedResourceContentIds.ids.length === 1
                            ? ''
                            : 's'} will be re-run.
                    </div>
                {/if}
            </div>

            <div class="flex w-full flex-row items-center justify-end pt-4">
                {#if errorMessage}
                    <div class="text-error pr-2">{errorMessage}</div>
                {/if}
                {#if isConfirming}
                    <div class="flex flex-col items-end gap-2">
                        <div class="text-sm">
                            Re-run pre-translation for <span class="font-bold">{project.name}</span>?
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
                    <button class="btn btn-primary" onclick={() => (isConfirming = true)} disabled={!canQueue}>
                        Re-run Pre-Translation
                    </button>
                {/if}
            </div>
        {/if}
    </div>
</div>
