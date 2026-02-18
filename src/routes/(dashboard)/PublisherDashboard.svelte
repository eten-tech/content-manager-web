<script lang="ts">
    import type { PageData } from './$types';
    import { searchParameters, ssp } from '$lib/utils/sveltekit-search-params';
    import type { Project, ResourceAssignedToSelf, ResourcePendingReview } from './+page';
    import { ResourceContentStatusEnum, UserRole } from '$lib/types/base';
    import { postToApi } from '$lib/utils/http-service';
    import Select from '$lib/components/Select.svelte';
    import Modal from '$lib/components/Modal.svelte';
    import UserSelector from '../resources/[resourceContentId]/UserSelector.svelte';
    import Tooltip from '$lib/components/Tooltip.svelte';
    import {
        SortName,
        createPublisherDashboardMyWorkSorter,
        createPublisherDashboardProjectsSorter,
        createPublisherDashboardReviewPendingSorter,
    } from './dashboard-table-sorters';
    import Table from '$lib/components/Table.svelte';
    import {
        assignedContentsColumns,
        reviewPendingContentsColumns,
        projectColumns,
        communityPendingContentsColumns,
        notApplicableContentsColumns,
    } from './publisher-dashboard-columns';
    import { formatSimpleDaysAgo } from '$lib/utils/date-time';
    import LinkedTableCell from '$lib/components/LinkedTableCell.svelte';
    import TableCell from '$lib/components/TableCell.svelte';
    import ProjectProgressBar from '$lib/components/ProjectProgressBar.svelte';
    import { filterBoolean } from '$lib/utils/array';
    import { ResourceContentVersionReviewLevel } from '$lib/types/resources';
    import type { NotApplicableContent } from './+page';
    import { _PublisherTab as Tab } from './+page';
    import { untrack } from 'svelte';
    import { parseApiValidatorErrorMessage } from '$lib/utils/http-errors';
    import { Icon } from 'svelte-awesome';
    import volumeUp from 'svelte-awesome/icons/volumeUp';
    import {
        notificationsContentColumns,
        markAllSelectedNotificationsAsRead,
        markNotificationAsReadAndGoToResourcePage,
    } from './notifications-helpers';
    import type { FlattenedNotificationsContent } from './proxy+page';

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();

    let currentAssignedContents: ResourceAssignedToSelf[] = $state([]);
    let currentReviewPendingContents: ResourcePendingReview[] = $state([]);
    let currentAssignedProjects: Project[] = $state([]);
    let currentCommunityPendingContents: ResourcePendingReview[] = $state([]);
    let currentNotifications: FlattenedNotificationsContent[] = $state([]);
    let currentNotApplicableContent: NotApplicableContent[] = $state([]);
    let selectedMyWorkTableItems: ResourceAssignedToSelf[] = $state([]);
    let selectedReviewPendingTableItems: ResourcePendingReview[] = $state([]);
    let selectedCommunityPendingTableItems: ResourcePendingReview[] = $state([]);
    let selectedNotifications: FlattenedNotificationsContent[] = $state([]);
    let assignToUserId: number | null = $state(null);
    let isAssignContentModalOpen = $state(false);
    let isConfirmPublishModalOpen = $state(false);
    let isCreateNewResourceItemModalOpen = $state(false);
    let errorModalText: string | null = $state(null);
    let isTransacting = $state(false);

    const sortAssignedResourceData = createPublisherDashboardMyWorkSorter();
    const sortPendingData = createPublisherDashboardReviewPendingSorter();
    const sortAssignedProjectData = createPublisherDashboardProjectsSorter();

    let assignedContents = $derived(data.publisherDashboard!.assignedResourceContent);
    let allReviewPendingContents = $derived(data.publisherDashboard!.reviewPendingResourceContent);
    let assignedProjects = $derived(data.publisherDashboard!.assignedProjects);
    let notApplicableContent = $derived(data.publisherDashboard!.notApplicableContent);
    let flattenedNotificationContent = $derived(data.publisherDashboard!.flattenedNotificationsContent);
    let communityPendingContents = $derived.by(() => {
        return allReviewPendingContents.filter((item) => {
            return item.reviewLevel === ResourceContentVersionReviewLevel.community;
        });
    });
    let reviewPendingContents = $derived.by(() => {
        return allReviewPendingContents.filter((item) => {
            return item.reviewLevel !== ResourceContentVersionReviewLevel.community;
        });
    });

    let search = $state('');

    let createNewResourceLanguage: number = $state(1);
    let createNewResourceEnglishLabel: string = $state('');
    let createNewResourceLanguageTitle: string = $state('');
    let parentResourceIdForNewResource: number = $state(0);

    const searchParams = searchParameters(
        {
            sort: ssp.string('-' + SortName.Days),
            tab: ssp.string(Tab.myWork),
            project: ssp.string(''),
            status: ssp.string(''),
            language: ssp.string(''),
            isFilteringUnresolved: ssp.boolean(false),
            isShowingOnlyUnread: ssp.boolean(false),
        },
        { runLoadAgainWhenParamsChange: false }
    );

    $effect(() => {
        if ($searchParams.tab) {
            resetSelection();
        }
    });

    function resetSelection() {
        selectedMyWorkTableItems = [];
        selectedReviewPendingTableItems = [];
        selectedCommunityPendingTableItems = [];
        selectedNotifications = [];
    }

    function shouldAssignAsEditorReview(status: ResourceContentStatusEnum | null) {
        return (
            status === ResourceContentStatusEnum.New ||
            status === ResourceContentStatusEnum.AquiferizeAwaitingAiDraft ||
            status === ResourceContentStatusEnum.AquiferizeAiDraftComplete ||
            status === ResourceContentStatusEnum.TranslationAwaitingAiDraft ||
            status === ResourceContentStatusEnum.TranslationAiDraftComplete ||
            status === ResourceContentStatusEnum.AquiferizeEditorReview ||
            status === ResourceContentStatusEnum.TranslationEditorReview
        );
    }

    async function assignContent() {
        let selectedReviewContentIds: number[] = [];
        let selectedEditorReviewContentIds: number[] = [];

        isTransacting = true;

        selectedMyWorkTableItems.forEach((item) => {
            if (shouldAssignAsEditorReview(item.statusValue)) {
                selectedEditorReviewContentIds.push(item.id);
            } else {
                selectedReviewContentIds.push(item.id);
            }
        });

        selectedReviewPendingTableItems.forEach((item) => {
            selectedReviewContentIds.push(item.id);
        });

        selectedCommunityPendingTableItems.forEach((item) => {
            selectedReviewContentIds.push(item.id);
        });

        const inProgressAssignments =
            selectedEditorReviewContentIds.length > 0
                ? postToApi<null>('/resources/content/send-for-editor-review', {
                      assignedUserId: assignToUserId,
                      contentIds: selectedEditorReviewContentIds,
                  })
                : Promise.resolve(null);
        const inReviewAssignments =
            selectedReviewContentIds.length > 0
                ? postToApi<null>('/resources/content/send-for-publisher-review', {
                      assignedUserId: assignToUserId,
                      contentIds: selectedReviewContentIds,
                  })
                : Promise.resolve(null);

        try {
            await Promise.all([inProgressAssignments, inReviewAssignments]);
            isTransacting = false;
            window.location.reload();
        } catch {
            errorModalText = 'Error while assigning content.';
            isTransacting = false;
        }
    }

    async function bulkPublish() {
        isTransacting = true;

        try {
            await postToApi(`/resources/content/publish`, { contentIds: selectedMyWorkTableItems.map((i) => i.id) });
            isTransacting = false;
            window.location.reload();
        } catch {
            errorModalText = 'Error while publishing content.';
            isTransacting = false;
        }
    }

    async function createResourceItem() {
        isTransacting = true;

        try {
            await postToApi<{ resourceContentId: number }>(`/resources/content`, {
                languageId: createNewResourceLanguage,
                englishLabel: createNewResourceEnglishLabel,
                parentResourceId: parentResourceIdForNewResource,
                languageTitle:
                    createNewResourceLanguageTitle.length > 0
                        ? createNewResourceLanguageTitle
                        : createNewResourceEnglishLabel,
            });
            isTransacting = false;
            window.location.reload();
        } catch (e) {
            createNewResourceLanguage = 1;
            createNewResourceEnglishLabel = '';
            parentResourceIdForNewResource = 0;

            const validatorError = parseApiValidatorErrorMessage(e, [
                'languageId',
                'englishLabel',
                'parentResourceId',
                'languageTitle',
            ]);

            if (validatorError && typeof validatorError === 'string') {
                errorModalText = validatorError;
            } else if (e instanceof Error) {
                const match = e.message.match(/Body: "(.*)"/);
                errorModalText = match ? (match[1] ?? null) : 'An error occurred while creating the resource item.';
            } else {
                errorModalText = 'An error occurred while creating the resource item.';
            }

            isTransacting = false;
        }
    }

    function projectNamesForContents(
        contents: ResourceAssignedToSelf[] | ResourcePendingReview[] | NotApplicableContent[]
    ) {
        return Array.from(new Set(filterBoolean(contents.map((c) => c.projectName)))).sort();
    }

    function statusesForContents(contents: ResourceAssignedToSelf[]) {
        return Array.from(new Set(filterBoolean(contents.map((c) => c.statusDisplayName)))).sort();
    }

    let nonPublisherReviewSelected = $derived.by(() => {
        return selectedMyWorkTableItems.some(
            (i) =>
                ![
                    ResourceContentStatusEnum.AquiferizePublisherReview,
                    ResourceContentStatusEnum.TranslationPublisherReview,
                ].includes(i.statusValue)
        );
    });

    let completeSelected = $derived.by(() => {
        return selectedMyWorkTableItems.some((i) => i.statusValue === ResourceContentStatusEnum.Complete);
    });

    let table:
        | Table<ResourceAssignedToSelf>
        | Table<Project>
        | Table<ResourcePendingReview>
        | Table<NotApplicableContent>
        | Table<FlattenedNotificationsContent>
        | undefined = $state(undefined);

    $effect(() => {
        if ($searchParams.sort && table) {
            untrack(() => table?.resetScroll());
        }
    });

    $effect(() => {
        clearStaleSearchParams($searchParams.tab, assignedContents, reviewPendingContents);
    });

    // Handle situation where project/status is set in the searchParams but is no longer valid. E.g. saved bookmark
    // or forced refresh after assign that removed all of them.
    function clearStaleSearchParams(
        tab: string,
        assignedContents: ResourceAssignedToSelf[],
        reviewPendingContents: ResourcePendingReview[]
    ) {
        if (!assignedContents.length || !reviewPendingContents.length) {
            return;
        }

        const projectNames =
            tab === Tab.myWork
                ? projectNamesForContents(assignedContents)
                : tab === Tab.reviewPending
                  ? projectNamesForContents(reviewPendingContents)
                  : tab === Tab.notApplicable
                    ? projectNamesForContents(notApplicableContent)
                    : [];
        if (
            $searchParams.project &&
            ((tab !== Tab.myWork && tab !== Tab.reviewPending && tab !== Tab.notApplicable) ||
                !projectNames.includes($searchParams.project))
        ) {
            $searchParams.project = '';
        }
        if (
            $searchParams.status &&
            (tab !== Tab.myWork || !statusesForContents(assignedContents).includes($searchParams.status))
        ) {
            $searchParams.status = '';
        }
        if ($searchParams.language && tab !== Tab.myProjects && tab !== Tab.notApplicable) {
            $searchParams.language = '';
        }
    }

    function selectTab(tab: Tab) {
        return () => {
            $searchParams.tab = tab;
            $searchParams.sort = tab === Tab.myProjects ? SortName.Days : '-' + SortName.Days;
        };
    }

    const setTabContents = (
        tab: string,
        search: string,
        status: string,
        project: string,
        isFilteringUnresolved: boolean,
        isShowingOnlyUnread: boolean
    ) => {
        if (tab === Tab.myWork) {
            currentAssignedContents = assignedContents.filter(
                (ac) =>
                    ac.englishLabel.toLowerCase().includes(search.toLowerCase()) &&
                    (!status || ac.statusDisplayName === status) &&
                    (!project || ac.projectName === project) &&
                    (!isFilteringUnresolved || ac.hasUnresolvedCommentThreads === true)
            );
        } else if (tab === Tab.reviewPending) {
            currentReviewPendingContents = reviewPendingContents.filter(
                (rpc) =>
                    rpc.englishLabel.toLowerCase().includes(search.toLowerCase()) &&
                    (!project || rpc.projectName === project)
            );
        } else if (tab === Tab.myProjects) {
            currentAssignedProjects = assignedProjects.filter(
                (ap) =>
                    ap.name.toLowerCase().includes(search.toLowerCase()) &&
                    ($searchParams.language === '' || ap.language === $searchParams.language)
            );
        } else if (tab === Tab.community) {
            currentCommunityPendingContents = communityPendingContents.filter(
                (crpc) =>
                    crpc.englishLabel.toLowerCase().includes(search.toLowerCase()) &&
                    (!isFilteringUnresolved || crpc.hasUnresolvedCommentThreads === true)
            );
        } else if (tab === Tab.notifications) {
            currentNotifications = flattenedNotificationContent.filter((n) => {
                if (isShowingOnlyUnread) {
                    return !n.isRead;
                } else {
                    return true;
                }
            });
        } else if (tab === Tab.notApplicable) {
            currentNotApplicableContent = notApplicableContent.filter((nac) => {
                return (
                    ($searchParams.project === '' || nac.projectName === $searchParams.project) &&
                    ($searchParams.language === '' || nac.language === $searchParams.language)
                );
            });
        }
    };

    $effect(() => {
        setTabContents(
            $searchParams.tab,
            search,
            $searchParams.status,
            $searchParams.project,
            $searchParams.isFilteringUnresolved,
            $searchParams.isShowingOnlyUnread
        );
    });

    let sortedCurrentAssignedContents = $derived(sortAssignedResourceData(currentAssignedContents, $searchParams.sort));
    let sortedCurrentReviewPendingContents = $derived(
        sortPendingData(currentReviewPendingContents, $searchParams.sort)
    );
    let sortedCurrentCommunityPendingContents = $derived(
        sortPendingData(currentCommunityPendingContents, $searchParams.sort)
    );
    let sortedCurrentAssignedProjects = $derived(sortAssignedProjectData(currentAssignedProjects, $searchParams.sort));

    $effect(() => {
        if (!isCreateNewResourceItemModalOpen) {
            createNewResourceLanguage = 1;
            createNewResourceEnglishLabel = '';
            createNewResourceLanguageTitle = '';
            parentResourceIdForNewResource = 0;
        }
    });
</script>

<div class="flex flex-col overflow-y-hidden px-4">
    <h1 class="pt-4 text-3xl">Dashboard</h1>
    <div class="flex flex-row items-center pt-4">
        <div role="tablist" class="tabs tabs-border w-fit">
            <button
                onclick={selectTab(Tab.myWork)}
                role="tab"
                class="tab {$searchParams.tab === Tab.myWork && 'tab-active'}"
                >My Work ({assignedContents.length})</button
            >
            <button
                onclick={selectTab(Tab.reviewPending)}
                role="tab"
                class="tab {$searchParams.tab === Tab.reviewPending && 'tab-active'}"
                >Review Pending ({reviewPendingContents.length})</button
            >
            <button
                onclick={selectTab(Tab.myProjects)}
                role="tab"
                class="tab {$searchParams.tab === Tab.myProjects && 'tab-active'}"
                >My Projects ({assignedProjects.length})</button
            >
            <button
                onclick={selectTab(Tab.community)}
                role="tab"
                class="tab {$searchParams.tab === Tab.community && 'tab-active'}"
            >
                Community Pending ({communityPendingContents.length})
            </button>
            <button
                onclick={selectTab(Tab.notApplicable)}
                role="tab"
                class="tab {$searchParams.tab === Tab.notApplicable && 'tab-active'}"
            >
                Not Applicable ({notApplicableContent.length})
            </button>
            <button
                onclick={selectTab(Tab.notifications)}
                role="tab"
                class="tab {$searchParams.tab === Tab.notifications && 'tab-active'}"
                >Notifications ({flattenedNotificationContent.filter((n) => !n.isRead).length})</button
            >
        </div>
    </div>
    {#if $searchParams.tab === Tab.myWork || $searchParams.tab === Tab.reviewPending || $searchParams.tab === Tab.community}
        <div class="mt-4 flex space-x-4">
            <input
                class="input input-bordered max-w-xs focus:outline-hidden"
                bind:value={search}
                placeholder="Search"
            />
            {#if $searchParams.tab === Tab.myWork}
                <Select
                    class="select select-bordered max-w-[14rem] grow"
                    bind:value={$searchParams.status}
                    onChange={resetSelection}
                    options={[
                        { value: '', label: 'Status' },
                        ...statusesForContents(assignedContents).map((p) => ({ value: p, label: p })),
                    ]}
                />
            {/if}
            {#if $searchParams.tab !== Tab.community}
                <Select
                    class="select select-bordered max-w-[14rem] grow"
                    bind:value={$searchParams.project}
                    onChange={resetSelection}
                    options={[
                        { value: '', label: 'Project' },
                        ...projectNamesForContents(
                            $searchParams.tab === Tab.myWork ? assignedContents : reviewPendingContents
                        ).map((p) => ({ value: p, label: p })),
                    ]}
                />
            {/if}
            {#if $searchParams.tab === Tab.myWork || $searchParams.tab === Tab.community}
                <label class="label cursor-pointer py-0 opacity-70">
                    <input
                        type="checkbox"
                        bind:checked={$searchParams.isFilteringUnresolved}
                        data-app-insights-event-name="publisher-dashboard-has-unresolved-comments-toggle-{$searchParams.isFilteringUnresolved
                            ? 'off'
                            : 'on'}"
                        class="checkbox no-animation checkbox-sm me-2"
                    />
                    <span class="label-text text-xs">Has Unresolved Comments</span>
                </label>
            {/if}
            <button
                data-app-insights-event-name="publisher-dashboard-bulk-assign-click"
                class="btn btn-primary me-0"
                onclick={() => (isAssignContentModalOpen = true)}
                disabled={(selectedReviewPendingTableItems.length === 0 &&
                    selectedMyWorkTableItems.length === 0 &&
                    selectedCommunityPendingTableItems.length === 0) ||
                    completeSelected}
                >Assign
            </button>
            {#if $searchParams.tab === Tab.myWork}
                <Tooltip
                    position={{ left: '7rem' }}
                    text={nonPublisherReviewSelected ? 'Publisher Review status only' : null}
                >
                    <button
                        data-app-insights-event-name="publisher-dashboard-bulk-publish-click"
                        class="btn btn-primary ms-4 me-0"
                        onclick={() => (isConfirmPublishModalOpen = true)}
                        disabled={selectedMyWorkTableItems.length === 0 || nonPublisherReviewSelected}
                        >Publish
                    </button>
                </Tooltip>
            {/if}
            {#if $searchParams.tab === Tab.myWork}
                <button
                    data-app-insights-event-name="publisher-dashboard-create-resource-item-click"
                    class="btn btn-outline btn-primary ms-4"
                    onclick={() => (isCreateNewResourceItemModalOpen = true)}
                    disabled={false}
                    >Create Resource Item
                </button>
            {/if}
        </div>
    {/if}
    {#if $searchParams.tab === Tab.notifications}
        <div class="mt-4 flex space-x-4">
            <button
                data-app-insights-event-name="publisher-dashboard-mark-read-click"
                class="btn btn-primary"
                onclick={async () => {
                    await markAllSelectedNotificationsAsRead(selectedNotifications);
                    selectedNotifications = [];
                }}
                disabled={selectedNotifications.length === 0 || selectedNotifications.every((n) => n.isRead)}
                >Mark Read
            </button>
            <label class="label cursor-pointer py-0 opacity-70">
                <input
                    type="checkbox"
                    bind:checked={$searchParams.isShowingOnlyUnread}
                    data-app-insights-event-name="publisher-dashboard-show-only-unread-toggle"
                    class="checkbox no-animation checkbox-sm me-2"
                />
                <span class="label-text text-xs">Show Only Unread</span>
            </label>
        </div>
    {/if}
    {#if $searchParams.tab === Tab.myProjects}
        <div class="mt-4 flex flex-row">
            <input
                class="input input-bordered me-4 max-w-xs focus:outline-hidden"
                bind:value={search}
                placeholder="Search"
            />
            <Select
                class="select select-bordered max-w-[14rem] grow"
                bind:value={$searchParams.language}
                onChange={resetSelection}
                options={[
                    { value: '', label: 'Language' },
                    ...data.languages.map((l) => ({ value: l.englishDisplay, label: l.englishDisplay })),
                ]}
            />
            <a class="btn btn-primary ms-4" href="/projects/new">Create Project</a>
        </div>
    {/if}
    {#if $searchParams.tab === Tab.notApplicable}
        <div class="mt-4 flex flex-row">
            <Select
                class="select select-bordered me-4 max-w-[14rem] grow"
                bind:value={$searchParams.project}
                onChange={resetSelection}
                options={[
                    { value: '', label: 'Project' },
                    ...projectNamesForContents(notApplicableContent).map((p) => ({ value: p, label: p })),
                ]}
            />
            <Select
                class="select select-bordered max-w-[14rem] grow"
                bind:value={$searchParams.language}
                onChange={resetSelection}
                options={[
                    { value: '', label: 'Language' },
                    ...data.languages.map((l) => ({ value: l.englishDisplay, label: l.englishDisplay })),
                ]}
            />
        </div>
    {/if}
    <div class="flex flex-row space-x-4 overflow-y-hidden">
        {#if $searchParams.tab === Tab.myWork}
            <Table
                bind:this={table}
                class="my-4"
                enableSelectAll={true}
                columns={assignedContentsColumns}
                items={sortedCurrentAssignedContents}
                idColumn="id"
                itemUrlPrefix="/resources/"
                bind:searchParams={$searchParams}
                bind:selectedItems={selectedMyWorkTableItems}
                noItemsText="Your work is all done!"
                searchable={true}
                bind:searchText={search}
            >
                {#snippet tableCells(item, href, itemKey)}
                    {#if itemKey === 'daysSinceContentUpdated' && item[itemKey] !== null}
                        <LinkedTableCell {href}>{formatSimpleDaysAgo(item[itemKey])}</LinkedTableCell>
                    {:else if itemKey === 'hasAudio'}
                        <TableCell>
                            {#if item.hasAudio}
                                <Icon data={volumeUp} class="h-4 w-4" />
                            {/if}
                        </TableCell>
                    {:else if href !== undefined && itemKey}
                        <LinkedTableCell {href}>{item[itemKey] ?? ''}</LinkedTableCell>
                    {:else if itemKey}
                        <TableCell>{item[itemKey] ?? ''}</TableCell>
                    {/if}
                {/snippet}
            </Table>
        {:else if $searchParams.tab === Tab.reviewPending}
            <Table
                bind:this={table}
                class="my-4"
                enableSelectAll={true}
                columns={reviewPendingContentsColumns}
                items={sortedCurrentReviewPendingContents}
                idColumn="id"
                itemUrlPrefix="/resources/"
                bind:searchParams={$searchParams}
                bind:selectedItems={selectedReviewPendingTableItems}
                noItemsText="No items pending review."
                searchable={true}
                bind:searchText={search}
            >
                {#snippet tableCells(item, href, itemKey)}
                    {#if itemKey === 'daysSinceContentUpdated' && item[itemKey] !== null}
                        <LinkedTableCell {href}>{formatSimpleDaysAgo(item[itemKey])}</LinkedTableCell>
                    {:else if itemKey === 'hasAudio'}
                        <TableCell>
                            {#if item.hasAudio}
                                <Icon data={volumeUp} class="h-4 w-4" />
                            {/if}
                        </TableCell>
                    {:else if href !== undefined && itemKey}
                        <LinkedTableCell {href}>{item[itemKey] ?? ''}</LinkedTableCell>
                    {:else if itemKey}
                        <TableCell>{item[itemKey] ?? ''}</TableCell>
                    {/if}
                {/snippet}
            </Table>
        {:else if $searchParams.tab === Tab.myProjects}
            <Table
                bind:this={table}
                class="my-4"
                enableSelectAll={false}
                columns={projectColumns}
                items={sortedCurrentAssignedProjects}
                idColumn="id"
                itemUrlPrefix="/projects/"
                bind:searchParams={$searchParams}
                noItemsText="No projects assigned to you."
                searchable={true}
            >
                {#snippet tableCells(item, href, itemKey, columnText)}
                    {#if columnText === 'Progress'}
                        <td>
                            <ProjectProgressBar
                                notStartedCount={item?.counts?.notStarted ?? 0}
                                editorReviewCount={item?.counts?.editorReview ?? 0}
                                inCompanyReviewCount={item?.counts?.inCompanyReview ?? 0}
                                inPublisherReviewCount={item?.counts?.inPublisherReview ?? 0}
                                completeCount={item?.counts?.completed ?? 0}
                                showLegend={false}
                            />
                        </td>
                    {:else if href !== undefined && itemKey && itemKey === 'days'}
                        <LinkedTableCell {href} class={(item[itemKey] ?? 0) < 0 ? 'text-error' : ''}
                            >{item[itemKey] ?? ''}</LinkedTableCell
                        >
                    {:else if href !== undefined && itemKey}
                        <LinkedTableCell {href}>{item[itemKey] ?? ''}</LinkedTableCell>
                    {:else if itemKey}
                        <TableCell>{item[itemKey] ?? ''}</TableCell>
                    {/if}
                {/snippet}
            </Table>
        {:else if $searchParams.tab === Tab.community}
            <Table
                bind:this={table}
                class="my-4"
                enableSelectAll={true}
                columns={communityPendingContentsColumns}
                items={sortedCurrentCommunityPendingContents}
                idColumn="id"
                itemUrlPrefix="/resources/"
                bind:searchParams={$searchParams}
                bind:selectedItems={selectedCommunityPendingTableItems}
                noItemsText="No items pending review."
                searchable={true}
                bind:searchText={search}
            >
                {#snippet tableCells(item, href, itemKey)}
                    {#if itemKey === 'daysSinceContentUpdated' && item[itemKey] !== null}
                        <LinkedTableCell {href}>{formatSimpleDaysAgo(item[itemKey])}</LinkedTableCell>
                    {:else if itemKey === 'hasAudio'}
                        <TableCell>
                            {#if item.hasAudio}
                                <Icon data={volumeUp} class="h-4 w-4" />
                            {/if}
                        </TableCell>
                    {:else if href !== undefined && itemKey}
                        <LinkedTableCell {href}>{item[itemKey] ?? ''}</LinkedTableCell>
                    {:else if itemKey}
                        <TableCell>{item[itemKey] ?? ''}</TableCell>
                    {/if}
                {/snippet}
            </Table>
        {:else if $searchParams.tab === Tab.notApplicable}
            <Table
                bind:this={table}
                class="my-4"
                enableSelectAll={false}
                columns={notApplicableContentsColumns}
                items={currentNotApplicableContent}
                idColumn="id"
                itemUrlPrefix="/resources/"
                noItemsText="No items pending review."
            />
        {:else if $searchParams.tab === Tab.notifications}
            <Table
                bind:this={table}
                class="my-4"
                idColumn="id"
                enableSelectAll={true}
                columns={notificationsContentColumns}
                items={currentNotifications}
                noItemsText="No notifications."
                bind:selectedItems={selectedNotifications}
            >
                {#snippet customTbody(rowItems, selectedItems, onSelectItem)}
                    <tbody>
                        {#each rowItems as notificationItem (notificationItem.id)}
                            <tr
                                class={notificationItem.isRead ? 'cursor-pointer' : 'cursor-pointer font-bold'}
                                onclick={() => markNotificationAsReadAndGoToResourcePage(notificationItem)}
                            >
                                <TableCell class="w-4" stopPropagation={true}>
                                    <input
                                        type="checkbox"
                                        class="checkbox checkbox-sm"
                                        onchange={() => onSelectItem(notificationItem)}
                                        checked={selectedItems?.includes(notificationItem)}
                                    />
                                </TableCell>
                                <TableCell>{notificationItem['time']}</TableCell>
                                <TableCell>{notificationItem['name']}</TableCell>
                                <TableCell
                                    ><div class="flex flex-col">
                                        <div>
                                            {notificationItem['title']} - {notificationItem[
                                                'parentResourceDisplayName'
                                            ]}
                                        </div>
                                        <div>{@html notificationItem['notification']}</div>
                                    </div>
                                </TableCell>
                            </tr>
                        {/each}
                        {#if rowItems.length === 0}
                            <tr>
                                <td colspan="99" class="text-center"> No notifications. </td>
                            </tr>
                        {/if}
                    </tbody>
                {/snippet}
            </Table>
        {/if}
    </div>
</div>

<Modal
    {isTransacting}
    primaryButtonText={'Assign'}
    primaryButtonOnClick={assignContent}
    primaryButtonDisabled={!assignToUserId}
    bind:open={isAssignContentModalOpen}
    header="Choose a publisher"
>
    <UserSelector
        users={data.users?.filter((u) => u.role === UserRole.Publisher) ?? []}
        defaultLabel="Select User"
        bind:selectedUserId={assignToUserId}
    />
</Modal>

<Modal
    header="Confirm Publish"
    bind:open={isConfirmPublishModalOpen}
    primaryButtonText="Publish"
    primaryButtonOnClick={bulkPublish}
    description="The {selectedMyWorkTableItems.length} selected resource items will be published immediately."
    {isTransacting}
/>

<Modal
    header="Create Resource Item"
    bind:open={isCreateNewResourceItemModalOpen}
    primaryButtonText="Create"
    primaryButtonOnClick={createResourceItem}
    primaryButtonDisabled={!createNewResourceLanguage ||
        createNewResourceEnglishLabel.length < 2 ||
        !parentResourceIdForNewResource ||
        (createNewResourceLanguage > 1 && createNewResourceLanguageTitle.length < 2)}
    {isTransacting}
>
    <h3 class="mb-4 text-xl">Language</h3>
    <Select
        class="select select-bordered mb-4 w-full min-w-[14rem] grow"
        bind:value={createNewResourceLanguage}
        isNumber={true}
        options={[...data.languages.map((l) => ({ value: l.id, label: l.englishDisplay }))]}
    />
    <h3 class="my-4 text-xl">Resource Information</h3>
    <Select
        appInsightsEventName="resources-resources-filter-selection"
        bind:value={parentResourceIdForNewResource}
        isNumber={true}
        class="select select-bordered mb-4 w-full min-w-[14rem] grow"
        options={[
            { value: 0, label: 'All Resources' },
            ...data.parentResources.map((t) => ({ value: t.id, label: t.displayName })),
        ]}
    />
    <input
        type="text"
        class="input input-bordered mb-4 w-full"
        placeholder="English Label"
        bind:value={createNewResourceEnglishLabel}
    />
    <input
        type="text"
        class="input input-bordered mb-6 w-full"
        placeholder="Language Title"
        disabled={createNewResourceLanguage === 1}
        bind:value={createNewResourceLanguageTitle}
    />
</Modal>

<Modal header="Error" bind:description={errorModalText} isError={true} />
