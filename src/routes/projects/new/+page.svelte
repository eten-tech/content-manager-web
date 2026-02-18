<script lang="ts">
    import { goto } from '$app/navigation';
    import Modal from '$lib/components/Modal.svelte';
    import Select from '$lib/components/Select.svelte';
    import { log } from '$lib/logger';
    import { UserRole } from '$lib/types/base';
    import { postToApi } from '$lib/utils/http-service';
    import { isApiErrorWithMessage } from '$lib/utils/http-errors';
    import type { PageData } from './$types';
    import ProjectContentSelector from './ProjectContentSelector.svelte';
    import BackButton from '$lib/components/BackButton.svelte';

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();

    const { languages, users, companies } = $derived(data);

    let title = $state('');
    let sourceLanguageId: number | null = $state(null);
    $effect(() => {
        sourceLanguageId = (languages || []).find((l) => l.iso6393Code === 'eng')?.id ?? null;
    });
    let targetLanguageId: number | null = $state(null);
    let projectManagerUserId: number | null = $state(null);
    let companyId: number | null = $state(null);
    let companyLeadUserId: number | null = $state(null);
    let selectedResourceIds: number[] = $state([]);
    let isSaving = $state(false);
    let isShowingErrorModal = $state(false);
    let errorMessage: string | null = $state(null);
    let isTranslatedChecked = $state(false);

    $effect(() => {
        !isShowingErrorModal && (errorMessage = '');
    });

    let isForAquiferization = $derived(
        !isTranslatedChecked && !!sourceLanguageId && !!targetLanguageId && sourceLanguageId === targetLanguageId
    );
    let isAlreadyTranslated = $derived(!isForAquiferization && isTranslatedChecked);

    let canSave = $derived(
        !!title &&
            !!sourceLanguageId &&
            (isTranslatedChecked || !!targetLanguageId) &&
            !!projectManagerUserId &&
            !!companyId &&
            !!companyLeadUserId &&
            selectedResourceIds.length > 0
    );

    async function save() {
        isSaving = true;
        try {
            const project = await postToApi<{ id: number }>('/projects', {
                title,
                sourceLanguageId,
                targetLanguageId,
                projectManagerUserId,
                companyId,
                companyLeadUserId,
                resourceIds: selectedResourceIds,
                isAlreadyTranslated,
            });
            if (!project) {
                throw new Error('No project created');
            }
            await goto(`/projects/${project.id}`);
        } catch (error) {
            if (isApiErrorWithMessage(error, 'project with this title already exists', 'title')) {
                errorMessage = 'A project with this name already exists.';
            } else {
                log.exception(error);
                errorMessage = 'There was an error while saving.';
            }
            isShowingErrorModal = true;
        } finally {
            isSaving = false;
        }
    }
</script>

<svelte:head>
    <title>Create Project | Aquifer Admin</title>
</svelte:head>

<div class="short:h-full short:overflow-auto relative flex h-screen flex-col overflow-hidden px-8 py-4">
    <div class="mb-4 flex flex-row items-center">
        <BackButton defaultPathIfNoHistory="/projects" />
        <div class="text-3xl">Create Project</div>
    </div>
    <div class="mb-8 flex flex-col">
        <div class="w-full pb-2 text-lg font-bold">Basic Information</div>
        <div class="grid grid-cols-2 gap-4">
            <div class="w-full">
                <div class="flex flex-row items-center border-b p-2">
                    <div class="text-md">Title <span class="text-error">*</span></div>
                    <div class="grow"></div>
                    <input bind:value={title} class="input input-bordered input-sm w-full max-w-[50%]" />
                </div>
                <div class="flex flex-row items-center border-b p-2">
                    <div class="text-md">
                        {!isTranslatedChecked ? 'Source ' : ''}Language <span class="text-error">*</span>
                    </div>
                    <div class="grow"></div>
                    <Select
                        bind:value={sourceLanguageId}
                        class="select select-bordered select-sm w-full max-w-[50%]"
                        disabled={selectedResourceIds.length > 0}
                        isNumber={true}
                        options={[
                            { value: null, label: 'Select ' + (!isTranslatedChecked ? 'Source ' : '') + 'Language' },
                            ...(languages || [])
                                // don't allow English resource contents to be put into an already translated project
                                .filter((l) => !isTranslatedChecked || l.iso6393Code !== 'eng')
                                .map((l) => ({
                                    value: l.id,
                                    label: l.englishDisplay,
                                })),
                        ]}
                    />
                </div>
                {#if !isTranslatedChecked}
                    <div class="flex flex-row items-center border-b p-2">
                        <div class="text-md">Target Language <span class="text-error">*</span></div>
                        <div class="grow"></div>
                        <Select
                            bind:value={targetLanguageId}
                            class="select select-bordered select-sm w-full max-w-[50%]"
                            disabled={(!isTranslatedChecked && !sourceLanguageId) || selectedResourceIds.length > 0}
                            isNumber={true}
                            options={[
                                { value: null, label: 'Select Target Language' },
                                ...(languages || [])
                                    // only allow English resource contents to be Aquiferized
                                    .filter(
                                        (l) =>
                                            l.id !== sourceLanguageId ||
                                            (sourceLanguageId === l.id && l.iso6393Code === 'eng')
                                    )
                                    .map((l) => ({
                                        value: l.id,
                                        label:
                                            l.id === sourceLanguageId
                                                ? l.englishDisplay + ' (Aquiferize)'
                                                : l.englishDisplay,
                                    })),
                            ]}
                        />
                    </div>
                {/if}
            </div>
            <div class="w-full">
                <div class="flex flex-row items-center border-b p-2">
                    <div class="text-md">Project Manager <span class="text-error">*</span></div>
                    <div class="grow"></div>
                    <Select
                        bind:value={projectManagerUserId}
                        class="select select-bordered select-sm w-full max-w-[50%]"
                        isNumber={true}
                        options={[
                            { value: null, label: 'Select User' },
                            ...(users || [])
                                .filter((u) => u.role === UserRole.Publisher)
                                .map((u) => ({ value: u.id, label: u.name })),
                        ]}
                    />
                </div>
                <div class="flex flex-row items-center border-b p-2">
                    <div class="text-md">Company <span class="text-error">*</span></div>
                    <div class="grow"></div>
                    <Select
                        bind:value={companyId}
                        class="select select-bordered select-sm w-full max-w-[50%]"
                        isNumber={true}
                        options={[
                            { value: null, label: 'Select Company' },
                            ...(companies || [])
                                .filter((c) => c.name !== 'N/A')
                                .map((c) => ({ value: c.id, label: c.name })),
                        ]}
                    />
                </div>
                <div class="flex flex-row items-center border-b p-2">
                    <div class="text-md">Company Lead <span class="text-error">*</span></div>
                    <div class="grow"></div>
                    <Select
                        bind:value={companyLeadUserId}
                        class="select select-bordered select-sm w-full max-w-[50%]"
                        isNumber={true}
                        options={[
                            { value: null, label: 'Select User' },
                            ...(users || [])
                                .filter((u) => u.role === UserRole.Manager)
                                .map((c) => ({ value: c.id, label: c.name })),
                        ]}
                    />
                </div>
                {#if !isForAquiferization}
                    <div class="flex flex-row items-center border-b p-2">
                        <div class="text-md">Create project from already translated items</div>
                        <div class="grow"></div>
                        <label class="flex items-center">
                            <input
                                type="checkbox"
                                class="toggle me-0.5"
                                bind:checked={isTranslatedChecked}
                                disabled={isForAquiferization || selectedResourceIds.length > 0}
                                onchange={() => {
                                    sourceLanguageId = null;
                                    targetLanguageId = null;
                                }}
                            />
                        </label>
                    </div>
                {/if}
            </div>
        </div>
    </div>
    <div class="short:h-[30rem] flex flex-col overflow-hidden">
        <div class="text-lg font-bold">Add Content</div>
        <!-- the key ensures we reset the project content selection when the selected languages or translation settings change -->
        {#key sourceLanguageId?.toString() + '-' + targetLanguageId?.toString() + '-' + isAlreadyTranslated.toString()}
            <ProjectContentSelector
                disabled={!sourceLanguageId || (!isAlreadyTranslated && !targetLanguageId)}
                {sourceLanguageId}
                {targetLanguageId}
                {data}
                {isForAquiferization}
                {isAlreadyTranslated}
                bind:finalizedResourceIds={selectedResourceIds}
            />
        {/key}
    </div>
    <div class="absolute right-0 bottom-0 left-0 z-50 flex flex-row border-t p-4">
        <div class="grow"></div>
        <button class="btn btn-primary" disabled={!canSave} onclick={save}>
            {#if isSaving}
                <span class="loading loading-spinner"></span>
            {:else}
                Create
            {/if}
        </button>
    </div>
</div>

<Modal bind:open={isShowingErrorModal} description={errorMessage} header="Error creating" isError={true} />
