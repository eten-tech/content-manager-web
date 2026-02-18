<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import Select from '$lib/components/Select.svelte';
    import ArrowLeftSmall from '$lib/icons/ArrowLeftSmall.svelte';
    import ArrowRightSmall from '$lib/icons/ArrowRightSmall.svelte';
    import { enterKeyHandler } from '$lib/utils/enter-key-action';
    import { getFromApi } from '$lib/utils/http-service';
    import { parseNumbersListFromString } from '$lib/utils/number-list-parser';
    import { sortByKeys } from '$lib/utils/sorting';
    import type { PageData } from './$types';
    import ProjectContentSelectorTable from './ProjectContentSelectorTable.svelte';
    import type { ResourceContentForSelection } from './types';

    interface Props {
        data: PageData;
        disabled: boolean;
        sourceLanguageId: number | null;
        targetLanguageId: number | null;
        finalizedResourceIds: number[];
        isForAquiferization: boolean;
        isAlreadyTranslated: boolean;
    }

    let {
        data,
        disabled,
        sourceLanguageId,
        targetLanguageId,
        finalizedResourceIds = $bindable(),
        isForAquiferization,
        isAlreadyTranslated,
    }: Props = $props();

    const { parentResources } = $derived(data);

    let bibleBooks = $derived(data.bibleBooks);
    let resourceTypeId: string | null = $state(null);
    let bookCode: string | null = $state(null);
    let chaptersString = $state('');
    let searchQuery = $state('');
    let fetchedContentCache: Record<number, ResourceContentForSelection> = $state({});
    let allContentIdsOnRight: number[] = $state([]);
    let idsSelectedOnLeft: number[] = $state([]);
    let idsSelectedOnRight: number[] = $state([]);
    let fetchedContentForLeft: ResourceContentForSelection[] | null = $state(null);
    let allContentOnRight: ResourceContentForSelection[] = $state([]);
    let isFetching = $state(false);

    let showingAquiferizeEditorReviewModal = $state(false);

    let chapters = $derived(
        parseNumbersListFromString(
            chaptersString ? chaptersString : 'all',
            1,
            bibleBooks?.find((b) => b.code === bookCode)?.totalChapters ?? 0
        )
    );

    $effect(() => {
        // reset chapters if book code changes
        bookCode && (chaptersString = '');
    });
    $effect(() => {
        allContentIdsOnRight = allContentOnRight.map((c) => c.resourceId);
    });
    $effect(() => {
        finalizedResourceIds = [...allContentIdsOnRight];
    });
    let selectedOnLeftBeingAquiferized = $derived(
        [...idsSelectedOnLeft].map((id) => fetchedContentCache[id]!).filter((r) => r.isBeingAquiferized)
    );

    function moveToRight(force: boolean) {
        if (selectedOnLeftBeingAquiferized.length > 0 && !force) {
            showingAquiferizeEditorReviewModal = true;
        } else {
            allContentOnRight = sortByKeys(
                allContentOnRight.concat([...idsSelectedOnLeft].map((id) => fetchedContentCache[id]!)),
                ['sortOrder', 'title']
            )!;
            idsSelectedOnLeft = [];
        }
    }

    function moveToLeft() {
        allContentOnRight = allContentOnRight.filter((c) => !idsSelectedOnRight.some((id) => id === c.resourceId));
        idsSelectedOnRight = [];
    }

    async function fetchContent() {
        if (chapters.length === 0 && !searchQuery) return;

        isFetching = true;

        const searchParams = new URLSearchParams();
        searchParams.set('searchQuery', searchQuery);
        !!resourceTypeId && searchParams.set('parentResourceId', resourceTypeId);
        !!bookCode && searchParams.set('bookCode', bookCode);
        chapters.forEach((c) => searchParams.append('chapters', c.toString()));

        try {
            if (isForAquiferization) {
                !!targetLanguageId && searchParams.set('languageId', targetLanguageId.toString());
                fetchedContentForLeft =
                    (await getFromApi<ResourceContentForSelection[]>(
                        `/resources/unaquiferized?${searchParams.toString()}`
                    )) ?? [];
            } else if (isAlreadyTranslated) {
                !!sourceLanguageId && searchParams.set('languageId', sourceLanguageId.toString());
                fetchedContentForLeft =
                    (await getFromApi<ResourceContentForSelection[]>(
                        `/resources/translated?${searchParams.toString()}`
                    )) ?? [];
            } else {
                !!sourceLanguageId && searchParams.set('sourceLanguageId', sourceLanguageId.toString());
                !!targetLanguageId && searchParams.set('targetLanguageId', targetLanguageId.toString());
                fetchedContentForLeft =
                    (await getFromApi<ResourceContentForSelection[]>(
                        `/resources/untranslated?${searchParams.toString()}`
                    )) ?? [];
            }
            fetchedContentForLeft.forEach((c) => (fetchedContentCache[c.resourceId] = c));
        } finally {
            isFetching = false;
        }
    }
</script>

<div class="flex flex-col overflow-hidden">
    <div class="flex flex-row space-x-4">
        <label class="form-control flex flex-col" for="resource-select">
            <div class="label">
                <span class="label-text">Resource</span>
            </div>
            <Select
                bind:value={resourceTypeId}
                class="select select-bordered"
                disabled={disabled || allContentOnRight.length > 0}
                isNumber={true}
                options={[
                    { value: null, label: 'Select Resource' },
                    ...(parentResources || []).map((r) => ({ value: r.id, label: r.displayName })),
                ]}
            />
        </label>
        <label class="form-control" for="book-select">
            <div class="label">
                <span class="label-text">Book</span>
            </div>
            <Select
                bind:value={bookCode}
                class="select select-bordered"
                disabled={!resourceTypeId}
                options={[
                    { value: null, label: 'Select Book' },
                    ...(bibleBooks?.map((b) => ({ value: b.code, label: b.localizedName })) ?? []),
                ]}
            />
        </label>
        <label class="form-control">
            <div class="label">
                <span class="label-text">Chapters</span>
            </div>
            <input
                bind:value={chaptersString}
                class="input input-bordered"
                disabled={!bookCode}
                placeholder="all, or 1-5, or 3,7"
                use:enterKeyHandler={fetchContent}
            />
        </label>
        <label class="form-control flex flex-col">
            <div class="label">
                <span class="label-text">&nbsp;</span>
            </div>
            <input
                bind:value={searchQuery}
                class="input input-bordered"
                disabled={!resourceTypeId}
                placeholder="Search"
                use:enterKeyHandler={fetchContent}
            />
        </label>
        <label class="form-control flex flex-col">
            <div class="label">
                <span class="label-text">&nbsp;</span>
            </div>
            <button class="btn btn-primary" disabled={!searchQuery && chapters.length === 0} onclick={fetchContent}>
                {#if isFetching}
                    <span class="loading loading-spinner"></span>
                {:else}
                    Search
                {/if}
            </button>
        </label>
    </div>
    <div class="mb-16 flex flex-row space-x-2 overflow-hidden pt-2">
        <div class="flex flex-1 flex-col">
            <div class="text-md font-semibold">
                {isForAquiferization
                    ? 'Unaquiferized Content'
                    : isAlreadyTranslated
                      ? 'Translated Content'
                      : 'Untranslated Content'}
            </div>
            <div class="overflow-auto">
                <ProjectContentSelectorTable
                    allContent={(fetchedContentForLeft ?? []).filter(
                        (c) => !allContentIdsOnRight.some((id) => id === c.resourceId)
                    )}
                    bind:selectedIds={idsSelectedOnLeft}
                    hasSearched={fetchedContentForLeft !== null}
                    isLoading={isFetching}
                />
            </div>
        </div>
        <div class="flex flex-col space-y-2 pt-6">
            <button
                class="btn btn-primary btn-sm"
                disabled={idsSelectedOnLeft.length === 0}
                onclick={() => moveToRight(false)}
            >
                <ArrowRightSmall />
            </button>
            <button class="btn btn-primary btn-sm" disabled={idsSelectedOnRight.length === 0} onclick={moveToLeft}>
                <ArrowLeftSmall />
            </button>
        </div>
        <div class="flex flex-1 flex-col">
            <div class="text-md font-semibold">Project Content</div>
            <div class="overflow-auto">
                <ProjectContentSelectorTable allContent={allContentOnRight} bind:selectedIds={idsSelectedOnRight} />
            </div>
        </div>
    </div>
</div>

<Modal
    bind:open={showingAquiferizeEditorReviewModal}
    description={`The following resource items are not in a Complete status:\n\n${selectedOnLeftBeingAquiferized
        .map((r) => r.title)
        .join('\n')}\n\nIf new items are created, the published version will be used and any changes being made will not
be reflected. Are you sure you want to add them to this project?`}
    header="Not in Complete Status"
    primaryButtonOnClick={() => moveToRight(true)}
    primaryButtonText="Add Anyway"
/>
