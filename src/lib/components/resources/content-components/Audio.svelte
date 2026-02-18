<script lang="ts">
    import { onMount, untrack } from 'svelte';
    import type { AudioContentItem, ResourceContent, Version } from '$lib/types/resources';
    import ReplaceAudioButton from '$lib/components/audioPlayer/ReplaceAudioButton.svelte';
    import AudioPlayer from '$lib/components/audioPlayer/AudioPlayer.svelte';
    import { createAudioPlaylistContext, type AudioPlaylist } from '$lib/components/audioPlayer/context.svelte';
    import Select from '$lib/components/Select.svelte';
    import LicenseInfoButton from '../../../../routes/resources/[resourceContentId]/LicenseInfoButton.svelte';
    import ArrowLeftSmall from '$lib/icons/ArrowLeftSmall.svelte';
    import ArrowRightSmall from '$lib/icons/ArrowRightSmall.svelte';
    import { getFromApi } from '$lib/utils/http-service';
    import { Permission, userCan } from '$lib/stores/auth';

    interface Props {
        resourceContent: ResourceContent;
    }

    let { resourceContent }: Props = $props();

    const versions = $derived(buildVersionSelectOptions(resourceContent));
    const audioContent = $derived(resourceContent.content as AudioContentItem);

    let hasSteps = $state(false);
    let stepHasAudio = $state(false);
    let playlist: AudioPlaylist = createAudioPlaylistContext();
    let selectedStepNumber = $state(1);
    let selectedVersionNumber = $derived(
        versions.find((version) => version.id === resourceContent.resourceContentId)?.version || 1
    );
    let versionAudioContents: Version | null = $state(null);

    function updateCurrentTrack() {
        if (selectedStepNumber! > playlist.currentTrackIndex + 1) {
            playlist.nextTrack();
        } else if (selectedStepNumber! < playlist.currentTrackIndex + 1) {
            playlist.prevTrack();
        }
    }

    function buildVersionSelectOptions(resourceContent: ResourceContent) {
        const versionZero = {
            version: resourceContent.versions.length ? resourceContent.versions.length + 1 : 1,
            created: resourceContent.resourceContentVersionCreated,
            id: resourceContent.resourceContentId,
            isPublished: true,
        };

        return [versionZero, ...resourceContent.versions];
    }

    async function loadAudioResourceVersion() {
        const selectedVersion = versions.find((version) => version.version === selectedVersionNumber)!;

        if (selectedVersion.isPublished) {
            versionAudioContents = null;
            return;
        }

        versionAudioContents = await getFromApi<Version>(`/resources/content/versions/${selectedVersion.id}`, fetch);
    }

    $effect(() => {
        if (untrack(() => !playlist) || !selectedStepNumber) return;
        updateCurrentTrack();
    });

    onMount(() => {
        if (audioContent?.webm?.steps?.length) {
            hasSteps = true;
        }
    });
</script>

<div class="flex flex-col items-start">
    <div class="mb-4">
        <Select
            bind:value={selectedVersionNumber}
            options={versions.map((version) => ({
                label: `${new Date(version.created).toLocaleDateString()} Version ${version.version}`,
                value: version.version,
            }))}
            class="select select-bordered w-lg"
            isNumber={true}
            onChange={loadAudioResourceVersion}
        />
    </div>

    <div class="mb-4 flex flex-col">
        {#if hasSteps}
            <div class="mb-2 flex w-[29rem] justify-between">
                <button
                    data-app-insights-event-name="audio-resource-item-back-arrow-click"
                    class="btn btn-circle btn-primary text-primary-content"
                    disabled={selectedStepNumber === 1}
                    onclick={() => {
                        selectedStepNumber = selectedStepNumber - 1;
                    }}
                >
                    <ArrowLeftSmall />
                </button>
                <div class="flex w-full items-center justify-center">
                    <h1 class="text-lg font-bold">Step {selectedStepNumber}</h1>
                </div>
                <button
                    data-app-insights-event-name="audio-resource-item-forward-arrow-click"
                    class="btn btn-circle btn-primary text-primary-content"
                    disabled={selectedStepNumber === 6}
                    onclick={() => {
                        selectedStepNumber = selectedStepNumber + 1;
                    }}
                >
                    <ArrowRightSmall />
                </button>
            </div>
        {/if}

        <AudioPlayer audioContents={[resourceContent]} {versionAudioContents} bind:stepHasAudio />
    </div>

    {#if $userCan(Permission.PublishContent)}
        <ReplaceAudioButton
            {hasSteps}
            {stepHasAudio}
            {selectedStepNumber}
            resourceContentId={resourceContent.resourceContentId}
        />
    {/if}

    <LicenseInfoButton {resourceContent} />
</div>
