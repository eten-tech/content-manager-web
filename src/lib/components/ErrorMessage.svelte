<script lang="ts">
    import {
        isApiErrorWithStatus,
        ApiError,
        AuthUninitializedError,
        FetchError,
        TokenMissingError,
    } from '$lib/utils/http-errors';
    import { onDestroy, onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import CenteredSpinnerFullScreen from './CenteredSpinnerFullScreen.svelte';
    import errorGotoPath from '$lib/stores/error-goto-path';

    /**
     * ErrorMessage component handles various error states and provides appropriate user feedback.
     * It accepts an uncastError prop which can be various error types (Error, FetchError, ApiError, etc.).
     * Based on the error type, it either:
     * - Redirects to a specified path (for 404 errors)
     * - Shows a rate limit message with refresh button (for 429 errors)
     * - Displays a generic error message with navigation button
     *
     * It uses the `errorGotoPath` to determine where to redirect users after certain error states are handled,
     * defaulting to the home route when no path is specified.
     *
     * The primary usage is the generic `src/routes/+error.svelte` but it can also be used in `{#await}{:then}{:catch}`
     * Svelte blocks to easily handle errors in a specific part of the page.
     */

    let { uncastError } = $props();

    let buttonText = $state('');
    let errorMessage = $state('');
    let didNotRedirect = $state(false);
    const error = $derived(uncastError as Error | FetchError | ApiError | TokenMissingError | AuthUninitializedError);

    function handleButtonClick() {
        if (isApiErrorWithStatus(error, 429)) {
            // SvelteKit's goto function does not
            // react to window.location.pathname;
            location.reload();
        }

        goto($errorGotoPath ?? '/');
    }

    onMount(() => {
        if (isApiErrorWithStatus(error, 404)) {
            goto($errorGotoPath ?? '');
        } else if (isApiErrorWithStatus(error, 429)) {
            buttonText = 'Refresh';
            errorMessage = 'Rate limit exceeded.';
            didNotRedirect = true;
        } else {
            errorMessage = 'An error occurred';
            buttonText = $errorGotoPath === null ? 'Go Home' : `Go To ${$errorGotoPath.replace('/', '')}`;
            didNotRedirect = true;
        }
    });

    onDestroy(() => {
        // when navigating away from a page with an error, reset `errorGotoPath`
        // it will then be ready to be set by the next page's `load` function if necessary
        errorGotoPath.set(null);
    });
</script>

{#if didNotRedirect}
    <div class="flex h-[calc(100vh-39px)] w-full items-center justify-center">
        <div class="flex grow flex-col items-center">
            <h1 class="text-4xl">{errorMessage}</h1>
            <button onclick={handleButtonClick} class="btn btn-primary mt-4 capitalize">{buttonText}</button>
        </div>
    </div>
{:else}
    <CenteredSpinnerFullScreen />
{/if}
