<script lang="ts">
    import BackButton from '$lib/components/BackButton.svelte';
    import Select from '$lib/components/Select.svelte';
    import { log } from '$lib/logger';
    import { ApiKeyScope } from '$lib/types/base';
    import { postToApi } from '$lib/utils/http-service';
    import { isAuthorizationError } from '$lib/utils/http-errors';

    interface ApiKeyResponse {
        id: number;
        apiKey: string;
    }

    let scope: ApiKeyScope | null = $state(null);
    let organization: string = $state('');
    let contactName: string = $state('');
    let email: string = $state('');
    let phone: string = $state('');
    let useCase: string = $state('');
    let isSaving = $state(false);
    let errorMessage: string | null = $state(null);
    let createdApiKey: string | null = $state(null);
    let isCopied = $state(false);

    let canSave = $derived(!!scope && !!contactName && !!email);

    const scopeOptions = [
        { value: null, label: 'Select Scope' },
        ...Object.values(ApiKeyScope)
            .filter((s) => s !== ApiKeyScope.None)
            .map((s) => ({ value: s, label: s })),
    ];

    async function save() {
        if (!canSave) return;
        isSaving = true;
        errorMessage = null;
        try {
            const response = await postToApi<ApiKeyResponse>('/admin/api-keys', {
                scope,
                organization: organization || null,
                contactName,
                email,
                phone: phone || null,
                useCase: useCase || null,
            });
            if (!response) {
                throw new Error('No API key created');
            }
            createdApiKey = response.apiKey;
        } catch (error) {
            if (isAuthorizationError(error)) {
                errorMessage = 'You are not authorized';
            } else {
                log.exception(error);
                errorMessage = 'There was an error while creating the API key.';
            }
        } finally {
            isSaving = false;
        }
    }

    async function copyApiKey() {
        if (!createdApiKey) return;
        await navigator.clipboard.writeText(createdApiKey);
        isCopied = true;
        setTimeout(() => (isCopied = false), 2000);
    }

    function resetForm() {
        scope = null;
        organization = '';
        contactName = '';
        email = '';
        phone = '';
        useCase = '';
        errorMessage = null;
        createdApiKey = null;
        isCopied = false;
    }
</script>

<svelte:head>
    <title>Create API Key | Aquifer Admin</title>
</svelte:head>

<div class="short:h-full short:overflow-auto relative flex h-screen flex-col overflow-hidden px-8 py-4">
    <div class="mb-4 flex flex-row items-center">
        <BackButton defaultPathIfNoHistory="/" />
        <div class="text-3xl">Create API Key</div>
    </div>

    {#if createdApiKey}
        <div class="flex max-w-xl flex-col gap-2">
            <div class="text-md font-bold">API key created</div>
            <div class="text-sm">Copy this key now — it will not be shown again.</div>
            <div class="flex flex-row items-center gap-2">
                <input readonly class="input input-bordered w-full" value={createdApiKey} />
                <button class="btn btn-primary" onclick={copyApiKey}>{isCopied ? 'Copied!' : 'Copy'}</button>
            </div>
            <button class="btn btn-link self-start px-0" onclick={resetForm}>Create another API key</button>
        </div>
    {:else}
        <div class="flex max-w-xl flex-col">
            <div class="flex flex-col border-b p-2">
                <div class="text-md">Scope <span class="text-error">*</span></div>
                <Select
                    class="select select-bordered w-full"
                    options={scopeOptions}
                    isNumber={false}
                    bind:value={scope}
                />
            </div>
            <div class="flex flex-col border-b p-2">
                <div class="text-md">Organization</div>
                <input class="input input-bordered w-full" bind:value={organization} />
            </div>
            <div class="flex flex-col border-b p-2">
                <div class="text-md">Contact Name <span class="text-error">*</span></div>
                <input class="input input-bordered w-full" bind:value={contactName} />
            </div>
            <div class="flex flex-col border-b p-2">
                <div class="text-md">Email <span class="text-error">*</span></div>
                <input type="email" class="input input-bordered w-full" bind:value={email} />
            </div>
            <div class="flex flex-col border-b p-2">
                <div class="text-md">Phone</div>
                <input class="input input-bordered w-full" bind:value={phone} />
            </div>
            <div class="flex flex-col border-b p-2">
                <div class="text-md">Use Case</div>
                <textarea class="textarea textarea-bordered w-full" bind:value={useCase}></textarea>
            </div>
            <div class="flex w-full flex-row items-center justify-end pt-4">
                {#if errorMessage}
                    <div class="text-error pr-2">{errorMessage}</div>
                {/if}
                <button class="btn btn-primary" onclick={save} disabled={!canSave || isSaving}
                    >{#if isSaving}
                        <span class="loading loading-spinner"></span>
                    {:else}
                        Create API Key
                    {/if}</button
                >
            </div>
        </div>
    {/if}
</div>
