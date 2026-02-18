<script lang="ts">
    import StarIcon from '$lib/icons/StarIcon.svelte';
    import StarFilledIcon from '$lib/icons/StarFilledIcon.svelte';

    interface Props {
        rating: number | undefined;
        callback: (e: MouseEvent, rating: number) => void;
    }

    let { rating = 0, callback }: Props = $props();

    let starHighlightPosition = $derived(rating - 1);

    // this is needed for if the component exists in multiple spots on the page (as the case with MachineTranslationRating.svelte)
    $effect(() => {
        refreshStarPosition(rating);
    });

    function refreshStarPosition(r: number) {
        starHighlightPosition = r - 1;
    }

    const onClick = (e: MouseEvent, newRating: number) => {
        callback(e, newRating);
    };
</script>

<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div class="text-primary flex">
    {#each { length: 5 } as _, i (i)}
        <button
            class="px-1"
            onclick={(e) => onClick(e, i + 1)}
            onmouseover={() => (starHighlightPosition = i)}
            onmouseleave={() => (starHighlightPosition = rating - 1)}
        >
            {#if starHighlightPosition >= i}
                <StarFilledIcon />
            {:else}
                <StarIcon />
            {/if}
        </button>
    {/each}
</div>
