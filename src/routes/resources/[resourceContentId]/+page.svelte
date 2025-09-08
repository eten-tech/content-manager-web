<script lang="ts">
    import type { PageData } from './$types';
    import Content from '$lib/components/resources/Content.svelte';
    import { beforeNavigate, goto } from '$app/navigation';
    import {
        type Assignment,
        type ContentTranslation,
        MediaTypeEnum,
        OpenedSupplementalSideBar,
        type ResourceContent,
        type ResourceContentCurrentStatusId,
        type ResourceContentNextUpInfo,
        ResourceContentVersionReviewLevel,
        type TiptapContentItem,
    } from '$lib/types/resources';
    import { getFromApi, patchToApi, postToApi } from '$lib/utils/http-service';
    import CenteredSpinner from '$lib/components/CenteredSpinner.svelte';
    import { ResourceContentStatusEnum, UserRole } from '$lib/types/base';
    import UserSelector from './UserSelector.svelte';
    import NotApplicableReasonSelector from './NotApplicableReasonSelector.svelte';
    import {
        currentUser,
        isAuthenticatedStore,
        Permission,
        userCan,
        userIsEqual,
        userIsInCompany,
    } from '$lib/stores/auth';
    import { type CommentStores, createCommentStores } from '$lib/stores/comments';
    import spinner from 'svelte-awesome/icons/spinner';
    import { Icon } from 'svelte-awesome';
    import TranslationSelector from './TranslationSelector.svelte';
    import { createAutosaveStore } from '$lib/utils/auto-save-store';
    import { onDestroy, onMount, tick } from 'svelte';
    import Modal from '$lib/components/Modal.svelte';
    import createChangeTrackingStore from '$lib/utils/change-tracking-store';
    import { get, type Readable, type Writable } from 'svelte/store';
    import ExitButton from '$lib/components/ExitButton.svelte';
    import CurrentTranslations from '$lib/components/resources/menus/CurrentTranslations.svelte';
    import WorksCited from '$lib/components/resources/menus/WorksCited.svelte';
    import CitedBy from '$lib/components/resources/menus/CitedBy.svelte';
    import ContentArea from '$lib/components/resources/ContentArea.svelte';
    import Select from '$lib/components/Select.svelte';
    import InlineComment from '$lib/components/comments/InlineComment.svelte';
    import VersePopout from '$lib/components/editorMarkPopouts/VersePopout.svelte';
    import { getSortedReferences, stripOutRtlVerseReferenceMarkers } from '$lib/utils/reference';
    import LicenseInfoButton from './LicenseInfoButton.svelte';
    import type { CommentThreadsResponse } from '$lib/types/comments';
    import { createSidebarContentStore } from './sidebar-content-store';
    import CommentsSidebar from '$lib/components/comments/CommentsSidebar.svelte';
    import { createMachineTranslationStore, setMachineTranslationContext } from '$lib/stores/machineTranslation';
    import MachineTranslationRating from '$lib/components/MachineTranslationRating.svelte';
    import { fly } from 'svelte/transition';
    import BibleReferencesSidebar from './BibleReferencesSidebar.svelte';
    import { log } from '$lib/logger';
    import { createIsPageTransactingContext } from '$lib/context/is-page-transacting-context';
    import ScrollSyncLockToggle from '$lib/components/editor/ScrollSyncLockToggle.svelte';
    import { isApiErrorWithMessage } from '$lib/utils/http-errors';
    import { isEditorPaneOnLeft } from '$lib/stores/resourceEditor';
    import ContentEditorSwapButton from '$lib/components/editor/ContentEditorSwapButton.svelte';
    import VersionStatusHistorySidebar from './VersionStatusHistorySidebar.svelte';
    import ResourcePopout from '$lib/components/editorMarkPopouts/ResourcePopout.svelte';
    import type { User } from '@auth0/auth0-spa-js';
    import { bindKey, bindKeyCombo, unbindKey, unbindKeyCombo } from '@rwh/keystrokes';
    import Tooltip from '$lib/components/Tooltip.svelte';
    import { searchParameters, ssp } from '$lib/utils/sveltekit-search-params';
    import { currentPreferredOpenedSupplementalSideBar } from '$lib/stores/preferred-opened-supplemental-sidebar';

    interface PageProps {
        data: PageData;
    }

    let { data }: PageProps = $props();

    const isPageTransacting = createIsPageTransactingContext();

    // --- setup content stores ---
    const { save, resetSaveState, isSaving, showSavingFailed } = createAutosaveStore(patchData);

    let editableContentStore = createChangeTrackingStore<TiptapContentItem[]>([], {
        onChange: save,
        debounceDelay: 3000,
    });

    let editableDisplayNameStore = createChangeTrackingStore<string>('', { onChange: save, debounceDelay: 3000 });

    let resourceContent = $derived(data.resourceContent);

    // --- declare reactive content states ---
    let shouldTransition = $state(false);
    let assignToUserId: number | null = $state(null);
    let selectedNotApplicableReason: string | null = $state(null);
    let selectedStepNumber: number | undefined = $state();
    let newTranslationLanguageId: number | null = $state(null); // only community users, only when they click 'translate'

    // --- comments ---
    let commentStores: CommentStores = $state(createCommentStores());
    let commentThreads: Writable<CommentThreadsResponse | null> = commentStores.commentThreads;
    let removeAllInlineThreads: Readable<() => void> = commentStores.removeAllInlineThreads;
    let hasUnresolvedThreads = $derived($commentThreads?.threads.some((x) => !x.resolved && x.id !== -1) || false);

    // --- machine translation ---
    const machineTranslationStore = createMachineTranslationStore();
    setMachineTranslationContext(machineTranslationStore);
    const promptForMachineTranslationRating = machineTranslationStore.promptForRating;

    // --- modal states ---
    let errorModalMessage: string | null = $state(null);
    let isAddTranslationModalOpen = $state(false);
    let isPublishModalOpen = $state(false);
    let isAssignUserModalOpen = $state(false);
    let isAquiferizeModalOpen = $state(false);
    let isAssignReviewModalOpen = $state(false);
    let isNotApplicableModalOpen = $state(false);
    let sendToModalText = $state('');
    let isSendToReviewPublisherManagerModalOpen = $state(false);
    let createDraft = $state(false); // checkbox flag
    let createTranslationFromDraft = $state(false); // checkbox flag

    // --- word and character counts ---
    let draftWordCountsByStep: number[] = $state([]);
    let referenceWordCountsByStep: number[] = $state([]);
    let draftCharacterCountsByStep: number[] = $state([]);
    let referenceCharacterCountsByStep: number[] = $state([]);

    // --- side bar ---
    let isShowingSupplementalSidebar = $derived(
        $currentPreferredOpenedSupplementalSideBar !== OpenedSupplementalSideBar.None
    );

    let sidebarContentStore: ReturnType<typeof createSidebarContentStore> = $derived(
        createSidebarContentStore(resourceContent)
    );

    // --- derived resource content values ----
    let mediaType: MediaTypeEnum | undefined = $derived(resourceContent.mediaType); // ? might need a default value here
    let currentUserIsAssigned = $derived($userIsEqual(resourceContent.assignedUser?.id));
    let assignedUserIsInCompany = $derived($userIsInCompany(resourceContent.assignedUser?.companyId));
    let englishContentTranslation: ContentTranslation | undefined = $derived(
        resourceContent.contentTranslations.find((x) => x.languageId === 1)
    );

    // --- derived permissions and resource content states ---
    let isInReview = $derived(
        resourceContent.status === ResourceContentStatusEnum.TranslationPublisherReview ||
            resourceContent.status === ResourceContentStatusEnum.AquiferizePublisherReview
    );

    let isInTranslationWorkflow = $derived(
        resourceContent.status === ResourceContentStatusEnum.TranslationAwaitingAiDraft ||
            resourceContent.status === ResourceContentStatusEnum.TranslationAiDraftComplete ||
            resourceContent.status === ResourceContentStatusEnum.TranslationPublisherReview ||
            resourceContent.status === ResourceContentStatusEnum.TranslationEditorReview ||
            resourceContent.status === ResourceContentStatusEnum.TranslationReviewPending
    );

    let isStatusInAwaitingAiDraft = $derived(
        resourceContent.status === ResourceContentStatusEnum.TranslationAwaitingAiDraft ||
            resourceContent.status === ResourceContentStatusEnum.AquiferizeAwaitingAiDraft
    );

    let hasResourceAssignmentPermission = $derived(
        ($userCan(Permission.AssignOverride) &&
            ($userCan(Permission.AssignOutsideCompany) || assignedUserIsInCompany)) ||
            ($userCan(Permission.AssignContent) && currentUserIsAssigned)
    );

    let canMakeContentEdits = $derived(
        $userCan(Permission.EditContent) &&
            (resourceContent.status === ResourceContentStatusEnum.AquiferizeEditorReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationEditorReview ||
                resourceContent.status === ResourceContentStatusEnum.AquiferizePublisherReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationReviewPending ||
                resourceContent.status === ResourceContentStatusEnum.TranslationPublisherReview ||
                resourceContent.status === ResourceContentStatusEnum.AquiferizeCompanyReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationCompanyReview) &&
            currentUserIsAssigned
    );

    let canAquiferize = $derived(
        $userCan(Permission.CreateContent) &&
            !resourceContent.isDraft &&
            (resourceContent.status === ResourceContentStatusEnum.New ||
                resourceContent.status === ResourceContentStatusEnum.Complete)
    );

    let canSendForEditorReview = $derived(
        hasResourceAssignmentPermission &&
            // note: the New and isDraft combo should not exist, but this ensures that the resource
            // isn't stuck if it's in a bad state
            ((resourceContent.status === ResourceContentStatusEnum.New && resourceContent.isDraft) ||
                resourceContent.status === ResourceContentStatusEnum.AquiferizeAiDraftComplete ||
                resourceContent.status === ResourceContentStatusEnum.TranslationAiDraftComplete ||
                resourceContent.status === ResourceContentStatusEnum.AquiferizeEditorReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationEditorReview ||
                resourceContent.status === ResourceContentStatusEnum.AquiferizeCompanyReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationCompanyReview)
    );

    let inPublisherReviewAndCanSendBack = $derived(
        ($userCan(Permission.AssignContent) &&
            currentUserIsAssigned &&
            (resourceContent.status === ResourceContentStatusEnum.AquiferizePublisherReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationPublisherReview) &&
            resourceContent.reviewLevel !== ResourceContentVersionReviewLevel.community) ||
            ($userCan(Permission.SetStatusCompleteNotApplicable) &&
                resourceContent.status === ResourceContentStatusEnum.TranslationNotApplicable)
    );

    let canPublish = $derived(
        $userCan(Permission.PublishContent) &&
            ((resourceContent.status === ResourceContentStatusEnum.New && !resourceContent.hasPublishedVersion) ||
                resourceContent.status === ResourceContentStatusEnum.AquiferizePublisherReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationPublisherReview)
    );

    let canUnpublish = $derived($userCan(Permission.PublishContent) && resourceContent.hasPublishedVersion);

    let canSendForCompanyReview = $derived.by(() => {
        let hasPermissions = currentUserIsAssigned && $userCan(Permission.AssignContent);
        if (
            hasPermissions &&
            (resourceContent.status === ResourceContentStatusEnum.AquiferizeEditorReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationEditorReview)
        ) {
            return true;
        }

        if (
            hasPermissions &&
            currentUserIsEditor &&
            (resourceContent.status === ResourceContentStatusEnum.AquiferizeCompanyReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationCompanyReview)
        ) {
            return true;
        }
        return false;
    });

    let currentUserIsEditor = $derived(
        $userCan(Permission.EditContent) &&
            !$userCan(Permission.ReviewContent) &&
            !$userCan(Permission.PublishContent) &&
            !$userCan(Permission.ReadCompanyContentAssignments) &&
            !$userCan(Permission.CreateCommunityContent) &&
            !$userCan(Permission.SendReviewContent)
    );

    let canPullBackToCompanyReview = $derived(resourceContent.canPullBackToCompanyReview); // current status would be ReviewPending

    let canSendForPublisherReview = $derived(
        $userCan(Permission.SendReviewContent) &&
            currentUserIsAssigned &&
            (resourceContent.status === ResourceContentStatusEnum.AquiferizeCompanyReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationCompanyReview)
    );

    let canAssignPublisherForReview = $derived(
        $userCan(Permission.ReviewContent) &&
            (resourceContent.status === ResourceContentStatusEnum.AquiferizeReviewPending ||
                resourceContent.status === ResourceContentStatusEnum.AquiferizePublisherReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationPublisherReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationReviewPending)
    );

    let canCreateTranslation = $derived($userCan(Permission.PublishContent));

    let canCommunityTranslate = $derived(
        $userCan(Permission.CreateCommunityContent) &&
            !resourceContent.contentTranslations.find((x) => x.languageId === $currentUser?.languageId) &&
            resourceContent.hasPublishedVersion === true &&
            $currentUser?.canBeAssignedContent === true
    );

    let canCommunitySendToPublisher = $derived(
        $userCan(Permission.SendReviewCommunityContent) &&
            resourceContent.status === ResourceContentStatusEnum.TranslationEditorReview &&
            currentUserIsAssigned
    );

    let canSetStatusTransitionNotApplicable = $derived(
        $userCan(Permission.SetStatusTranslationNotApplicable) &&
            currentUserIsAssigned &&
            resourceContent.isDraft &&
            (resourceContent.status === ResourceContentStatusEnum.TranslationAiDraftComplete ||
                resourceContent.status === ResourceContentStatusEnum.TranslationEditorReview ||
                resourceContent.status === ResourceContentStatusEnum.TranslationCompanyReview)
    );

    let canSetStatusCompleteNotApplicable = $derived(
        $userCan(Permission.SetStatusCompleteNotApplicable) &&
            resourceContent.status === ResourceContentStatusEnum.TranslationNotApplicable
    );

    let isMacOS = $state(false);
    let isControlAltPressed = $state(false);

    const searchParams = searchParameters(
        {
            commentId: ssp.string(''),
        },
        { runLoadAgainWhenParamsChange: false }
    );

    beforeNavigate(async ({ to, cancel }) => {
        // beforeNavigate runs synchronously, but we can work around the limitation by always canceling the
        // navigation up front, and then conditionally doing a `goto` if the save is successful.
        // See https://github.com/sveltejs/kit/issues/4421#issuecomment-1129879937
        if (get(editableContentStore.hasChanges) || get(editableDisplayNameStore.hasChanges)) {
            if ($isAuthenticatedStore) {
                cancel();
                if (!(await save(true))) {
                    errorModalMessage =
                        'You have unsaved edits that could not be saved. Please ensure they save before navigating away.';
                } else {
                    to?.url && (await goto(to.url));
                }
            }
        }
    });

    onMount(() => {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }

        if (typeof navigator !== 'undefined' && navigator.userAgent) {
            isMacOS = navigator.userAgent.indexOf('Mac') !== -1;
        }

        bindKeyCombo(`Control+${isMacOS ? 'Meta' : 'Alt'}`, {
            onPressed: () => (isControlAltPressed = true),
            onReleased: () => (isControlAltPressed = false),
        });

        if (canSetStatusTransitionNotApplicable) {
            bindKey('n', async () => {
                if (isControlAltPressed) {
                    isNotApplicableModalOpen = true;

                    await tick();

                    focusOnButton('not-applicable-yes-button');

                    log.trackEvent('keyboard-short-cuts-not-applicable');
                }
            });
        }

        if (canSendForCompanyReview || canSendForPublisherReview) {
            bindKey('s', async () => {
                if (isControlAltPressed) {
                    if (canSendForCompanyReview) {
                        sendToModalText = 'Send to Review';

                        isSendToReviewPublisherManagerModalOpen = true;

                        await tick();

                        focusOnButton('send-to-review-yes-button');

                        log.trackEvent('keyboard-short-cuts-send-company-review');
                    } else if (canSendForPublisherReview) {
                        sendToModalText = 'Send to Publisher Review';

                        isSendToReviewPublisherManagerModalOpen = true;

                        await tick();

                        focusOnButton('send-to-review-yes-button');

                        log.trackEvent('keyboard-short-cuts-send-publisher-review');
                    }
                }
            });
        }

        if (canSendForEditorReview || inPublisherReviewAndCanSendBack) {
            bindKey('a', () => {
                if (isControlAltPressed) {
                    if (canSendForEditorReview) {
                        openAssignUserModal();
                    } else if (canAssignPublisherForReview && isInReview) {
                        openAssignReviewModal();
                    }

                    log.trackEvent('keyboard-short-cuts-assign-user');
                }
            });
        }

        bindKey('m', () => {
            if (isControlAltPressed) {
                const commentsAlreadyOpened =
                    $currentPreferredOpenedSupplementalSideBar === OpenedSupplementalSideBar.Comments;

                $currentPreferredOpenedSupplementalSideBar = commentsAlreadyOpened
                    ? OpenedSupplementalSideBar.None
                    : OpenedSupplementalSideBar.Comments;

                const eventName = commentsAlreadyOpened
                    ? 'keyboard-short-cuts-comments-sidebar-close'
                    : 'keyboard-short-cuts-comments-sidebar-open';

                log.trackEvent(eventName);
            }
        });

        bindKey('b', () => {
            if (isControlAltPressed) {
                const biblePaneAlreadyOpened =
                    $currentPreferredOpenedSupplementalSideBar === OpenedSupplementalSideBar.BibleReferences;

                $currentPreferredOpenedSupplementalSideBar = biblePaneAlreadyOpened
                    ? OpenedSupplementalSideBar.None
                    : OpenedSupplementalSideBar.BibleReferences;

                const eventName = biblePaneAlreadyOpened
                    ? 'keyboard-short-cuts-bible-pane-sidebar-close'
                    : 'keyboard-short-cuts-bible-pane-sidebar-open';

                log.trackEvent(eventName);
            }
        });

        bindKey('h', () => {
            if (isControlAltPressed) {
                const historyPaneAlreadyOpened =
                    $currentPreferredOpenedSupplementalSideBar === OpenedSupplementalSideBar.VersionStatusHistory;

                $currentPreferredOpenedSupplementalSideBar = historyPaneAlreadyOpened
                    ? OpenedSupplementalSideBar.None
                    : OpenedSupplementalSideBar.VersionStatusHistory;

                const eventName = historyPaneAlreadyOpened
                    ? 'keyboard-short-cuts-history-pane-sidebar-close'
                    : 'keyboard-short-cuts-history-pane-sidebar-open';

                log.trackEvent(eventName);
            }
        });

        if ($searchParams.commentId) {
            $currentPreferredOpenedSupplementalSideBar = OpenedSupplementalSideBar.Comments;
        }
    });

    onDestroy(() => {
        resetSaveState();
        unbindKeyCombo(`Control+${isMacOS ? 'Meta' : 'Alt'}`);
        unbindKey('n');
        unbindKey('s');
        unbindKey('a');
        unbindKey('m');
        unbindKey('b');
        unbindKey('h');
    });

    $effect(() => handleFetchedResource(resourceContent));

    function handleFetchedResource(resourceContent: ResourceContent) {
        resetSaveState();

        $isPageTransacting = false;
        selectedStepNumber = 1;

        // this ensures that the `content` is the type TiptapContentItem[]
        if (!('url' in resourceContent.content) && Array.isArray(resourceContent.content)) {
            editableContentStore.setOriginalAndCurrent(resourceContent.content);
        }
        editableDisplayNameStore.setOriginalAndCurrent(resourceContent.displayName);

        machineTranslationStore.resetStore();
        machineTranslationStore.machineTranslations.set(
            new Map(resourceContent.machineTranslations.map((mt) => [mt.contentIndex, mt]))
        );
        promptForMachineTranslationRating.set(
            resourceContent.machineTranslations.some(
                (mt) =>
                    !mt.userRating &&
                    currentUserIsAssigned &&
                    resourceContent?.status === ResourceContentStatusEnum.TranslationEditorReview
            )
        );

        if (resourceContent.commentThreads) {
            // Add a dummy thread for a new comment span to live on. If a comment is added, then create the thread
            // with the new threadId from the server.
            resourceContent.commentThreads.threads.push({
                id: -1,
                resolved: false,
                comments: [],
            });
            $commentThreads = resourceContent.commentThreads;
        } else {
            $commentThreads = null;
        }

        if (isStatusInAwaitingAiDraft) {
            startPollingForAiTranslateComplete();
        }
    }

    function openAquiferizeModal() {
        assignToUserId = null;
        isAquiferizeModalOpen = true;
    }

    function publishOrOpenModal(status: ResourceContentStatusEnum) {
        assignToUserId = null;
        createDraft = false;
        if (status === ResourceContentStatusEnum.New || hasUnresolvedThreads) {
            isPublishModalOpen = true;
        } else {
            publish();
        }
    }

    function openAssignUserModal() {
        assignToUserId = null;
        isAssignUserModalOpen = true;
    }

    function openAssignReviewModal() {
        assignToUserId = currentUserIsAssigned ? null : data.currentUser.id;
        isAssignReviewModalOpen = true;
    }

    function openAddTranslationModal() {
        createTranslationFromDraft = false;
        newTranslationLanguageId = null;
        isAddTranslationModalOpen = true;
    }

    async function callNextUpApi(resourceContentId: number) {
        let nextUpInfo: ResourceContentNextUpInfo | null = null;

        try {
            nextUpInfo = await getFromApi<ResourceContentNextUpInfo>(`/resources/content/${resourceContentId}/next-up`);
        } catch (error) {
            log.exception(error);
        }

        return nextUpInfo;
    }

    async function callNextUpCommunityApi(resourceContentId: number) {
        let nextUpInfo: ResourceContentNextUpInfo | null = null;

        try {
            nextUpInfo = await getFromApi<ResourceContentNextUpInfo>(
                `/resources/content/${resourceContentId}/next-up/community`
            );
        } catch (error) {
            log.exception(error);
        }

        return nextUpInfo;
    }

    async function handleNextUpInfo(nextUpInfo: ResourceContentNextUpInfo | null) {
        if (nextUpInfo === null) {
            return;
        }

        if (nextUpInfo.nextUpResourceContentId) {
            shouldTransition = true;
            await goto(`/resources/${nextUpInfo.nextUpResourceContentId}`);
        } else {
            await goto(`/`);
        }
    }

    async function takeActionAndCallback<T>(action: () => Promise<T>, callback: (response: T) => Promise<void>) {
        $isPageTransacting = true;
        if (get(editableDisplayNameStore.hasChanges) || get(editableContentStore.hasChanges)) {
            await patchData();
        }
        try {
            const response = await action();
            await callback(response);
            $isPageTransacting = false;
        } catch (error) {
            $isPageTransacting = false;
            if (isApiErrorWithMessage(error, 'User can only create one translation at a time')) {
                errorModalMessage = 'You can only create one translation at a time.';
                if ($currentUser) {
                    $currentUser.canBeAssignedContent = false;
                }
            } else {
                errorModalMessage = 'An error occurred while saving. Please try again.';
                throw error;
            }
        }
    }

    async function takeActionAndRefresh(action: () => Promise<unknown>) {
        // do this for now. eventually we want to have the post return the new state of the resource so we don't need to refresh
        await takeActionAndCallback(
            action,
            //eslint-disable-next-line
            async () => window.location.reload()
        );
    }

    async function unpublish() {
        await takeActionAndRefresh(() =>
            postToApi(`/resources/content/${resourceContent.resourceContentId}/unpublish`)
        );
    }

    async function sendForCompanyReview() {
        const currentResourceContentId = resourceContent.resourceContentId;
        $isPageTransacting = true;

        const nextUpInfo = await callNextUpApi(currentResourceContentId);

        if (currentResourceContentId !== resourceContent.resourceContentId) {
            return;
        }

        await takeActionAndCallback(
            async () =>
                await postToApi<{ assignments: Assignment[] }>(
                    `/resources/content/${currentResourceContentId}/send-for-company-review`
                ),
            async (response) => {
                if (
                    !nextUpInfo ||
                    response?.assignments.some(
                        (assignment) =>
                            assignment.assignedUserId === $currentUser?.id &&
                            assignment.resourceContentId === currentResourceContentId
                    )
                ) {
                    window?.location?.reload();
                } else {
                    await handleNextUpInfo(nextUpInfo);
                }
            }
        );
    }

    async function sendForPublisherReview() {
        const currentResourceContentId = resourceContent.resourceContentId;
        $isPageTransacting = true;

        const nextUpInfo = await callNextUpApi(currentResourceContentId);

        if (currentResourceContentId !== resourceContent.resourceContentId) {
            return;
        }

        await takeActionAndCallback(
            async () =>
                await postToApi<{ changedByPublisher: boolean }>(
                    `/resources/content/${currentResourceContentId}/send-for-publisher-review`
                ),
            async (response) => {
                if (!nextUpInfo || response?.changedByPublisher) {
                    window?.location?.reload();
                } else {
                    await handleNextUpInfo(nextUpInfo);
                }
            }
        );
    }

    async function assignPublisherReview() {
        await takeActionAndRefresh(() =>
            postToApi(`/resources/content/${resourceContent.resourceContentId}/assign-publisher-review`, {
                assignedUserId: assignToUserId,
            })
        );
    }

    async function aquiferize() {
        await takeActionAndRefresh(() =>
            postToApi(`/resources/content/${resourceContent.resourceContentId}/aquiferize`, {
                assignedUserId: assignToUserId,
            })
        );
    }

    async function publish() {
        $removeAllInlineThreads();
        await takeActionAndRefresh(() =>
            postToApi(`/resources/content/${resourceContent.resourceContentId}/publish`, {
                createDraft: createDraft,
                assignedUserId: assignToUserId,
            })
        );
    }

    async function pullBackToCompanyReview() {
        await takeActionAndCallback(
            async () =>
                await postToApi(`/resources/content/${resourceContent.resourceContentId}/pull-from-review-pending`, {
                    assignedUserId: $currentUser?.id,
                }),
            // eslint-disable-next-line
            async () => {
                window?.location?.reload();
            }
        );
    }

    async function sendForEditorReview() {
        const currentResourceContentId = resourceContent.resourceContentId;
        $isPageTransacting = true;

        const nextUpInfo = await callNextUpApi(currentResourceContentId);

        if (currentResourceContentId !== resourceContent.resourceContentId) {
            return;
        }

        await takeActionAndCallback(
            async () =>
                await postToApi(`/resources/content/${currentResourceContentId}/send-for-editor-review`, {
                    assignedUserId: assignToUserId,
                }),
            async () => {
                if (!nextUpInfo) {
                    window?.location?.reload();
                } else {
                    await handleNextUpInfo(nextUpInfo);
                }
            }
        );
    }

    async function pullFromPublisherReview() {
        const currentResourceContentId = resourceContent.resourceContentId;
        $isPageTransacting = true;

        const nextUpInfo = await callNextUpApi(currentResourceContentId);

        if (currentResourceContentId !== resourceContent.resourceContentId) {
            return;
        }

        await takeActionAndCallback(
            async () =>
                await postToApi(`/resources/content/${currentResourceContentId}/pull-from-publisher-review`, {
                    assignedUserId: assignToUserId,
                }),
            async () => {
                if (!nextUpInfo) {
                    window?.location?.reload();
                } else {
                    await handleNextUpInfo(nextUpInfo);
                }
            }
        );
    }

    async function createTranslation() {
        await takeActionAndCallback<{ resourceContentId: number } | null>(
            async () =>
                await postToApi<{ resourceContentId: number }>(
                    `/resources/content/${englishContentTranslation?.contentId}/create-translation`,
                    {
                        languageId: newTranslationLanguageId,
                        useDraft: createTranslationFromDraft,
                    }
                ),
            async (response) => await goto(`/resources/${response?.resourceContentId}`)
        );
    }

    function calculateWordCount(wordCounts: number[]) {
        if (wordCounts.length) {
            return wordCounts.reduce((total, current) => total + current, 0);
        }
    }

    function calculateCharacterCount(characterCounts: number[]) {
        if (characterCounts.length) {
            return characterCounts.reduce((total, current) => total + current, 0);
        }
    }

    function applyMetadataContentFields(tiptap: TiptapContentItem[]) {
        const originalContent = (resourceContent?.content ?? []) as TiptapContentItem[];
        return tiptap.map((item, index) => ({ ...originalContent[index], ...item }));
    }

    async function patchData() {
        const displayName = get(editableDisplayNameStore);
        const content = get(editableContentStore);
        await patchToApi(`/resources/content/${resourceContent.resourceContentId}`, {
            displayName,
            wordCount: calculateWordCount(draftWordCountsByStep),
            ...(mediaType === MediaTypeEnum.text
                ? { content: applyMetadataContentFields(stripOutRtlVerseReferenceMarkers(content)) }
                : null),
        });

        editableDisplayNameStore.setOriginalOnly(displayName);
        editableContentStore.setOriginalOnly(content);
    }

    function usersThatCanBeAssigned() {
        let users = data.users?.filter((u: User) => u.role !== UserRole.ReportViewer) ?? null;
        if (resourceContent.status === ResourceContentStatusEnum.TranslationNotApplicable) {
            users = users?.filter((u: User) => u.role === UserRole.Manager || u.role === UserRole.Reviewer) ?? null;
        }

        if ($userCan(Permission.AssignOutsideCompany)) {
            return users;
        }
        return users?.filter((u: User) => $userIsInCompany(u.company.id)) ?? null;
    }

    async function handleCommunityTranslate() {
        $isPageTransacting = true;

        newTranslationLanguageId = $currentUser?.languageId ?? null;

        await takeActionAndCallback<{ resourceContentId: number } | null>(
            async () =>
                await postToApi<{ resourceContentId: number }>(
                    `/resources/content/${englishContentTranslation?.contentId}/create-translation`,
                    {
                        languageId: newTranslationLanguageId,
                        useDraft: createTranslationFromDraft,
                    }
                ),
            async (response) => {
                if ($currentUser) {
                    $currentUser.canBeAssignedContent = false;
                }
                await goto(`/resources/${response?.resourceContentId}`);
            }
        );
    }

    async function handleCommunitySendToPublisher() {
        $isPageTransacting = true;

        const nextUpInfo = await callNextUpCommunityApi(resourceContent.resourceContentId);

        await takeActionAndCallback(
            async () =>
                await postToApi(
                    `/resources/content/${resourceContent.resourceContentId}/send-for-publisher-review-community`
                ),
            async () => {
                if ($currentUser) {
                    $currentUser.canBeAssignedContent = true;
                }
                await handleNextUpInfo(nextUpInfo);
            }
        );
    }

    async function handleNotApplicable() {
        $isPageTransacting = true;

        await takeActionAndCallback(
            async () =>
                await postToApi(
                    `/resources/content/${resourceContent.resourceContentId}/not-applicable?notApplicableReason=${selectedNotApplicableReason}`
                ),
            async () => {
                if (!$userCan(Permission.SetStatusCompleteNotApplicable)) {
                    await goto(`/`);
                }
                window.location.reload();
            }
        );
    }

    async function handleConfirmNotApplicable() {
        $isPageTransacting = true;

        await takeActionAndCallback(
            async () =>
                await postToApi(`/resources/content/${resourceContent.resourceContentId}/complete-not-applicable`),
            async () => {
                await goto(`/`);
            }
        );
    }

    function startPollingForAiTranslateComplete() {
        const interval = setInterval(async () => {
            if (resourceContent?.resourceContentId) {
                const response = await getFromApi<ResourceContentCurrentStatusId>(
                    `/resources/content/${resourceContent?.resourceContentId}/status`
                );
                if (
                    response &&
                    response?.status !== ResourceContentStatusEnum.TranslationAwaitingAiDraft &&
                    response?.status !== ResourceContentStatusEnum.AquiferizeAwaitingAiDraft
                ) {
                    clearInterval(interval);
                    window.location.reload();
                }
            } else {
                clearInterval(interval);
            }
        }, 5000);
    }

    function focusOnButton(buttonId: string) {
        const primaryButton = document.getElementById(buttonId);
        primaryButton?.focus();
    }

    function handleShortCutsSendToReview() {
        if (canSendForCompanyReview) {
            sendForCompanyReview();
        } else if (canSendForPublisherReview) {
            sendForPublisherReview();
        }
    }
</script>

<svelte:head>
    <title>{resourceContent?.englishLabel} | Aquifer Admin</title>
</svelte:head>

<!-- This key is important to make sure old content clears out when navigating to a new resource.  -->
<!-- It also makes the transition on the div work correctly. -->
{#key resourceContent.resourceContentId}
    <div
        onintroend={() => (shouldTransition = false)}
        in:fly={{ x: 500, duration: shouldTransition ? 450 : 0, delay: shouldTransition ? 350 : 0 }}
        out:fly={{ x: -500, duration: shouldTransition ? 450 : 0, delay: shouldTransition ? 250 : 0 }}
        class="w-screen px-8 pt-1"
        class:absolute={shouldTransition}
    >
        <div class="flex w-full items-center justify-between border-b-[1px] py-1">
            <div class="me-2 flex place-items-center">
                <ExitButton defaultPathIfNoHistory="/resources" />
                {#if resourceContent.mediaType !== MediaTypeEnum.audio}
                    <CurrentTranslations
                        currentResourceId={resourceContent.resourceContentId}
                        languages={data.languages}
                        project={resourceContent.project}
                        englishTranslation={englishContentTranslation}
                        {canCreateTranslation}
                        openModal={openAddTranslationModal}
                    />
                {/if}
                <WorksCited currentResourceId={resourceContent.resourceContentId} />
                <CitedBy currentResourceId={resourceContent.resourceContentId} />
            </div>

            {#if resourceContent.mediaType !== MediaTypeEnum.audio}
                <div class="flex">
                    <div class="flex w-full justify-end">
                        <div class="me-2 flex items-center">
                            {#if $showSavingFailed}
                                <span class="text-error font-bold">Auto-save failed</span>
                            {/if}
                            {#if $isSaving}
                                <Icon data={spinner} pulse class="text-[#0175a2]" />
                            {/if}
                        </div>
                        {#if !isStatusInAwaitingAiDraft}
                            <div class="flex flex-wrap justify-end">
                                {#if canSetStatusTransitionNotApplicable}
                                    <Tooltip
                                        position={{ right: '7.5rem', top: '0.25rem' }}
                                        text={`CTRL+${isMacOS ? 'CMD' : 'ALT'}+N`}
                                    >
                                        <button
                                            class="btn btn-primary btn-sm ms-2"
                                            disabled={$isPageTransacting}
                                            onclick={() => (isNotApplicableModalOpen = true)}
                                        >
                                            Not Applicable
                                        </button>
                                    </Tooltip>
                                {/if}
                                {#if canSetStatusCompleteNotApplicable}
                                    <button
                                        class="btn btn-primary btn-sm ms-2"
                                        disabled={$isPageTransacting}
                                        onclick={handleConfirmNotApplicable}
                                    >
                                        Confirm
                                    </button>
                                {/if}
                                {#if canSendForEditorReview || inPublisherReviewAndCanSendBack}
                                    <Tooltip
                                        position={{
                                            right: `${canSendForEditorReview ? '6.2rem' : '6.5rem'}`,
                                            top: '0.25rem',
                                        }}
                                        text={canSendForEditorReview ? `CTRL+${isMacOS ? 'CMD' : 'ALT'}+A` : ''}
                                    >
                                        <button
                                            class="btn btn-primary btn-sm ms-2"
                                            disabled={$isPageTransacting}
                                            onclick={openAssignUserModal}
                                        >
                                            {#if canSendForEditorReview}
                                                Assign User
                                            {:else if inPublisherReviewAndCanSendBack}
                                                Send Back
                                            {/if}
                                        </button>
                                    </Tooltip>
                                {/if}
                                {#if canPullBackToCompanyReview}
                                    <button
                                        class="btn btn-primary btn-sm ms-2"
                                        disabled={$isPageTransacting}
                                        onclick={pullBackToCompanyReview}
                                    >
                                        Pull Back to Company Review
                                    </button>
                                {/if}
                                {#if canAssignPublisherForReview}
                                    <Tooltip
                                        position={{
                                            right: `${canSendForEditorReview ? '7.2rem' : '4.5rem'}`,
                                            top: '0.25rem',
                                        }}
                                        text={isInReview ? `CTRL+${isMacOS ? 'CMD' : 'ALT'}+A` : ''}
                                    >
                                        <button
                                            class="btn btn-primary btn-sm ms-2"
                                            disabled={$isPageTransacting}
                                            onclick={openAssignReviewModal}
                                            >{isInReview ? 'Assign' : 'Review'}
                                        </button>
                                    </Tooltip>
                                {/if}
                                {#if canPublish}
                                    <button
                                        class="btn btn-primary btn-sm ms-2"
                                        disabled={$isPageTransacting}
                                        onclick={() => publishOrOpenModal(resourceContent.status)}
                                        >Publish
                                    </button>
                                {/if}
                                {#if canUnpublish}
                                    <button
                                        data-app-insights-event-name="resource-unpublish-click"
                                        class="btn btn-primary btn-sm ms-2"
                                        disabled={$isPageTransacting}
                                        onclick={unpublish}
                                        >Unpublish
                                    </button>
                                {/if}
                                {#if canSendForCompanyReview}
                                    <Tooltip
                                        position={{ right: '7.5rem', top: '0.25rem' }}
                                        text={`CTRL+${isMacOS ? 'CMD' : 'ALT'}+S`}
                                    >
                                        <button
                                            class="btn btn-primary btn-sm ms-2"
                                            disabled={$isPageTransacting}
                                            onclick={sendForCompanyReview}
                                            >{resourceContent.hasAdditionalReviewer &&
                                            (resourceContent.status ===
                                                ResourceContentStatusEnum.AquiferizeEditorReview ||
                                                resourceContent.status ===
                                                    ResourceContentStatusEnum.TranslationEditorReview)
                                                ? 'Send to Review'
                                                : 'Send to Manager'}
                                        </button>
                                    </Tooltip>
                                {/if}
                                {#if canSendForPublisherReview}
                                    <Tooltip
                                        position={{ right: '8.5rem', top: '0.25rem' }}
                                        text={`CTRL+${isMacOS ? 'CMD' : 'ALT'}+S`}
                                    >
                                        <button
                                            class="btn btn-primary btn-sm ms-2"
                                            disabled={$isPageTransacting}
                                            onclick={sendForPublisherReview}
                                            >Send to Publisher
                                        </button>
                                    </Tooltip>
                                {/if}
                                {#if canAquiferize}
                                    <button
                                        class="btn btn-primary btn-sm ms-2"
                                        disabled={$isPageTransacting}
                                        onclick={openAquiferizeModal}
                                        >Create Draft
                                    </button>
                                {/if}
                                {#if canCommunityTranslate}
                                    <button
                                        class="btn btn-primary btn-sm ms-2"
                                        disabled={$isPageTransacting}
                                        onclick={handleCommunityTranslate}
                                        >Translate
                                    </button>
                                {/if}
                                {#if canCommunitySendToPublisher}
                                    <button
                                        class="btn btn-primary btn-sm ms-2"
                                        disabled={$isPageTransacting}
                                        onclick={handleCommunitySendToPublisher}
                                        >Send to Publisher
                                    </button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>

        <ContentArea
            {resourceContent}
            historySidebarOpen={$sidebarContentStore.isOpen}
            sidebarHistoryAvailable={sidebarContentStore.allSnapshotAndPublishedVersionOptions.length > 0}
            onToggleHistoryPane={sidebarContentStore.toggleViewing}
            resourceContentStatuses={data.resourceContentStatuses}
            {commentStores}
            {selectedStepNumber}
            {isMacOS}
        />

        <div class="flex h-[calc(100vh-170px)]">
            <div
                class="h-full {$sidebarContentStore.animateOpen &&
                    'transition-[width]'} {!$sidebarContentStore.isOpen && !isShowingSupplementalSidebar
                    ? 'w-full'
                    : $sidebarContentStore.isOpen && !isShowingSupplementalSidebar
                      ? 'w-1/2'
                      : !$sidebarContentStore.isOpen && isShowingSupplementalSidebar
                        ? 'w-4/5'
                        : 'w-2/5'}"
                class:order-first={!$isEditorPaneOnLeft}
                class:pe-3={!$isEditorPaneOnLeft}
                class:ps-3={$isEditorPaneOnLeft}
            >
                <div class="bg-base-200 h-full rounded-md px-4 pt-4 pb-0.5">
                    <div
                        class={`flex h-full w-full max-w-4xl flex-col ${mediaType === MediaTypeEnum.audio ? '' : 'mx-auto'}`}
                    >
                        {#if mediaType !== MediaTypeEnum.audio}
                            <div class="flex flex-row items-center">
                                <input
                                    bind:value={$editableDisplayNameStore}
                                    class="input input-bordered h-8 w-full max-w-[18rem] leading-8"
                                    dir="auto"
                                    type="text"
                                    readonly={!canMakeContentEdits || !resourceContent.isDraft || $isPageTransacting}
                                />
                                {#if resourceContent.isDraft}
                                    <div class="grow"></div>
                                    <div class="me-2 font-semibold text-gray-700">Draft</div>
                                {/if}
                            </div>
                        {/if}
                        <div class="mt-[0.9375rem] w-full grow">
                            <Content
                                bind:selectedStepNumber
                                {editableContentStore}
                                bind:wordCountsByStep={draftWordCountsByStep}
                                bind:characterCountsByStep={draftCharacterCountsByStep}
                                canEdit={canMakeContentEdits && resourceContent.isDraft}
                                canComment={resourceContent.isDraft}
                                {resourceContent}
                                {commentStores}
                                blurOnPendingAiTranslate={isStatusInAwaitingAiDraft}
                                isSourceContentArea={false}
                            />
                        </div>
                        <div class="flex flex-row items-center space-x-4">
                            {#if resourceContent.parentResourceLicenseInfo && resourceContent.mediaType !== MediaTypeEnum.audio}
                                <LicenseInfoButton {resourceContent} />
                            {/if}
                            {#if mediaType === MediaTypeEnum.text}
                                <div class="text-sm text-gray-500">
                                    Word count: {calculateWordCount(draftWordCountsByStep) || resourceContent.wordCount}
                                </div>
                                <div class="text-sm text-gray-500">
                                    Character count: {calculateCharacterCount(draftCharacterCountsByStep) || 0}
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>

            <div
                class="h-full overflow-hidden {$sidebarContentStore.animateOpen &&
                    'transition-[width]'} {!$sidebarContentStore.isOpen
                    ? 'w-0'
                    : isShowingSupplementalSidebar
                      ? 'w-2/5'
                      : 'w-1/2'}"
                class:order-first={$isEditorPaneOnLeft}
                class:ps-3={!$isEditorPaneOnLeft}
                class:pe-3={$isEditorPaneOnLeft}
            >
                <div class="border-base-300 flex h-full w-full flex-col rounded-md border px-4 pt-4 pb-1">
                    <div class="mx-auto flex h-full w-full max-w-4xl flex-col">
                        <Select
                            value={$sidebarContentStore.selected?.idForSelection ?? null}
                            onChange={sidebarContentStore.selectSnapshotOrVersion}
                            class="select select-bordered select-sm mb-4"
                            options={sidebarContentStore.allSnapshotAndPublishedVersionOptions.map((s) => ({
                                value: s.value,
                                label: s.label,
                            }))}
                        />
                        {#if $sidebarContentStore.isOpen}
                            {#if $sidebarContentStore.isLoading}
                                <CenteredSpinner />
                            {:else if $sidebarContentStore.selected}
                                <Content
                                    bind:selectedStepNumber
                                    bind:wordCountsByStep={referenceWordCountsByStep}
                                    bind:characterCountsByStep={referenceCharacterCountsByStep}
                                    {editableContentStore}
                                    sidebarIsOpen={$sidebarContentStore.isOpen}
                                    snapshotOrVersion={$sidebarContentStore.selected}
                                    {resourceContent}
                                    {commentStores}
                                    isSourceContentArea={true}
                                />
                                {#if mediaType === MediaTypeEnum.text}
                                    <div
                                        class="flex h-10 flex-row items-center justify-between px-3 text-sm text-gray-500"
                                    >
                                        <div class="flex gap-x-4">
                                            <span>Word count: {calculateWordCount(referenceWordCountsByStep)}</span>
                                            <span
                                                >Character count: {calculateCharacterCount(
                                                    referenceCharacterCountsByStep
                                                )}</span
                                            >
                                        </div>
                                        <div class="flex gap-2">
                                            <ContentEditorSwapButton />
                                            <ScrollSyncLockToggle />
                                        </div>
                                    </div>
                                {/if}
                            {:else}
                                Error fetching...
                            {/if}
                        {/if}
                    </div>
                </div>
            </div>

            <div
                class="h-full overflow-hidden transition-[width]
                {isShowingSupplementalSidebar ? 'w-1/5 ps-3' : 'w-0'}"
            >
                <div
                    class="border-base-300 flex h-full w-full flex-col rounded-md border {$currentPreferredOpenedSupplementalSideBar ===
                    OpenedSupplementalSideBar.Comments
                        ? ''
                        : 'hidden'}"
                >
                    <CommentsSidebar {commentStores} />
                </div>
                <div
                    class="border-base-300 flex h-full w-full flex-col rounded-md border {$currentPreferredOpenedSupplementalSideBar ===
                    OpenedSupplementalSideBar.BibleReferences
                        ? ''
                        : 'hidden'}"
                >
                    <BibleReferencesSidebar
                        visible={$currentPreferredOpenedSupplementalSideBar ===
                            OpenedSupplementalSideBar.BibleReferences}
                        language={resourceContent.language}
                        languages={data.languages}
                        references={getSortedReferences(resourceContent)}
                    />
                </div>
                <div
                    class="border-base-300 flex h-full w-full flex-col rounded-md border {$currentPreferredOpenedSupplementalSideBar ===
                    OpenedSupplementalSideBar.VersionStatusHistory
                        ? ''
                        : 'hidden'}"
                >
                    <VersionStatusHistorySidebar
                        visible={$currentPreferredOpenedSupplementalSideBar ===
                            OpenedSupplementalSideBar.VersionStatusHistory}
                        resourceContentVersionId={resourceContent.resourceContentVersionId}
                    />
                </div>
            </div>
        </div>
    </div>

    <InlineComment {commentStores} />
    <VersePopout language={resourceContent.language} languages={data.languages} />
    <ResourcePopout />

    <Modal
        primaryButtonText="Assign"
        primaryButtonOnClick={assignPublisherReview}
        primaryButtonDisabled={!assignToUserId}
        bind:open={isAssignReviewModalOpen}
        header="Choose a Reviewer"
    >
        <UserSelector
            users={data.users?.filter((u: User) => u.role === UserRole.Publisher) ?? []}
            hideUser={resourceContent?.assignedUser}
            defaultLabel="Select User"
            bind:selectedUserId={assignToUserId}
        />
    </Modal>

    <Modal
        header={isInTranslationWorkflow ? 'Choose a Translator' : 'Choose an Editor'}
        bind:open={isAquiferizeModalOpen}
        primaryButtonText="Assign"
        primaryButtonOnClick={aquiferize}
        primaryButtonDisabled={assignToUserId === null || $isPageTransacting}
    >
        <UserSelector
            users={usersThatCanBeAssigned()}
            defaultLabel="Select User"
            bind:selectedUserId={assignToUserId}
        />
    </Modal>

    <Modal
        header={isInTranslationWorkflow ? 'Choose a Translator' : 'Choose an Editor'}
        bind:open={isAssignUserModalOpen}
        primaryButtonText="Assign"
        primaryButtonOnClick={canSendForEditorReview ? sendForEditorReview : pullFromPublisherReview}
        primaryButtonDisabled={assignToUserId === null || $isPageTransacting}
    >
        {#if $promptForMachineTranslationRating && currentUserIsAssigned}
            <div class="mb-8 flex flex-col justify-start gap-4">
                <div class="text-error font-semibold">Please rate the AI translation before reassigning.</div>
                <div>
                    <MachineTranslationRating showingInPrompt={true} improvementHorizontalPositionPx={0} />
                </div>
            </div>
        {/if}
        <UserSelector
            users={usersThatCanBeAssigned()}
            defaultLabel="Select User"
            bind:selectedUserId={assignToUserId}
            hideUser={resourceContent?.assignedUser}
        />
    </Modal>

    <Modal
        header={hasUnresolvedThreads && resourceContent?.status !== ResourceContentStatusEnum.New
            ? 'Confirm Publish'
            : 'Choose Publish Option'}
        bind:open={isPublishModalOpen}
        primaryButtonText="Publish"
        primaryButtonOnClick={publish}
        primaryButtonDisabled={$isPageTransacting}
    >
        {#if hasUnresolvedThreads && resourceContent?.status !== ResourceContentStatusEnum.New}
            <p class="text-warning py-4 text-lg">This resource has unresolved comments.</p>
        {/if}
        {#if resourceContent?.status === ResourceContentStatusEnum.New}
            <div class="form-control mb-4">
                <label class="label cursor-pointer justify-start space-x-2">
                    <input type="checkbox" bind:checked={createDraft} class="checkbox" />
                    <span class="label-text">Aquiferization Needed</span>
                </label>
            </div>
            <label class="form-control mb-2" for="aquiferization-assignment">
                <div class="label">
                    <span class="label-text mb-1">Aquiferization Assignment (optional)</span>
                </div>
                <UserSelector
                    users={usersThatCanBeAssigned()}
                    defaultLabel="Unassigned"
                    disabled={!createDraft}
                    bind:selectedUserId={assignToUserId}
                />
            </label>
        {/if}
    </Modal>

    <Modal
        header="Create Translation"
        bind:open={isAddTranslationModalOpen}
        primaryButtonText="Create"
        primaryButtonOnClick={createTranslation}
        primaryButtonDisabled={newTranslationLanguageId === null || $isPageTransacting}
    >
        <TranslationSelector
            allLanguages={data.languages}
            existingTranslations={resourceContent?.contentTranslations ?? []}
            bind:selectedLanguageId={newTranslationLanguageId}
        />
        {#snippet additionalButtons()}
            {#if englishContentTranslation?.hasDraft}
                <div>
                    <label class="label cursor-pointer">
                        <input
                            type="checkbox"
                            class="checkbox-primary checkbox me-2"
                            bind:checked={createTranslationFromDraft}
                        />
                        <span class="label-text">Create from Draft</span>
                    </label>
                </div>
            {/if}
        {/snippet}
    </Modal>

    <Modal
        header={sendToModalText}
        bind:open={isSendToReviewPublisherManagerModalOpen}
        primaryButtonText="Yes"
        primaryButtonOnClick={handleShortCutsSendToReview}
        primaryButtonId="send-to-review-yes-button"
    />

    <Modal
        header="Mark as Not Applicable?"
        bind:open={isNotApplicableModalOpen}
        primaryButtonText="Submit"
        primaryButtonOnClick={handleNotApplicable}
        primaryButtonId="not-applicable-yes-button"
        primaryButtonDisabled={selectedNotApplicableReason === null || $isPageTransacting}
    >
        <NotApplicableReasonSelector bind:selectedReason={selectedNotApplicableReason} />
    </Modal>

    <Modal header="Error" isError={true} bind:description={errorModalMessage} />
{/key}
