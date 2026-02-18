<script lang="ts">
    import type { ResourceContent } from '$lib/types/resources';
    import { filterBoolean } from '$lib/utils/array';

    interface Props {
        resourceContent: ResourceContent;
    }

    let { resourceContent }: Props = $props();

    let licenseInfo = $derived(resourceContent.parentResourceLicenseInfo!);
    let englishLicenses = $derived(filterBoolean(licenseInfo.licenses.map(({ eng }) => eng)));
    let englishLicensesForAdaptation = $derived(englishLicenses.filter(({ name }) => name.toLowerCase() !== 'public domain'));
    let container: HTMLDivElement;
    let show = $state(false);

    const handleClick = (e: MouseEvent) => {
        if (!container.contains(e.target as Node)) {
            show = false;
        }
    };
</script>

<svelte:window onclick={handleClick} />

<div bind:this={container} class="dropdown dropdown-top">
    <button
        data-app-insights-event-name="resource-license-info-click"
        class="btn btn-ghost btn-sm hover:bg-primary hover:text-primary-content text-gray-500"
        onclick={() => (show = !show)}
    >
        License Info
    </button>
    {#if show}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
            tabindex="0"
            class="dropdown-content border-base-300 bg-base-100 flex w-[30rem] flex-col space-y-2 rounded-md border
        p-6"
        >
            <div class="flex flex-row space-x-1">
                {#each englishLicenses as license, i (i)}
                    {@const spacer = i !== englishLicenses.length - 1 ? ';' : ''}
                    {#if license.url}
                        <a class="text-primary" href={license.url} target="_blank" rel="noopener noreferrer"
                            >{license.name}</a
                        >{spacer}
                    {:else}
                        <span>{license.name}{spacer}</span>
                    {/if}
                {/each}
            </div>
            <div>
                {licenseInfo.copyright.holder.name +
                    (licenseInfo.copyright.dates ? ' ©' + licenseInfo.copyright.dates : '')}
            </div>
            {#if licenseInfo.copyright.holder.url}
                <div>
                    <a
                        class="text-primary"
                        href={licenseInfo.copyright.holder.url}
                        target="_blank"
                        rel="noopener noreferrer">{licenseInfo.copyright.holder.url}</a
                    >
                </div>
            {/if}
            {#if resourceContent.language.iso6393Code.toLowerCase() === 'eng' ? licenseInfo.showAdaptationNoticeForEnglish : licenseInfo.showAdaptationNoticeForNonEnglish}
                <div>
                    This work, "{licenseInfo.title}", is adapted from "{licenseInfo.title}" by "{licenseInfo.copyright
                        .holder.name}", used under
                    {englishLicensesForAdaptation.map(({ name }) => name).join(' and ')}. "{licenseInfo.title}" is
                    licensed under
                    {englishLicensesForAdaptation.map(({ name }) => name).join(' and ')} by BiblioNexus.
                </div>
            {/if}
        </div>
    {/if}
</div>
