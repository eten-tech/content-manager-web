import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const darkModeLocalStorageString = 'AQUIFER_DARK_MODE';

export const sideBarHiddenOnPage = writable(false);

let savedDarkMode = false;

if (browser) {
    const localDarkMode = localStorage.getItem(darkModeLocalStorageString);

    if (localDarkMode === null) {
        const userTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        if (userTheme === 'dark') {
            savedDarkMode = true;
        }
    } else if (localDarkMode === 'true') {
        savedDarkMode = true;
    }
}

export const darkMode = writable(savedDarkMode);

darkMode.subscribe(($darkMode) => {
    if (browser) {
        localStorage.setItem(darkModeLocalStorageString, $darkMode.toString());
    }
});
