import { browser } from '$app/environment';
import { OpenedSupplementalSideBar } from '$lib/types/resources';
import { writable } from 'svelte/store';

const sidepanelSettingString = 'aquifer_sidepanel_setting';
let savedSidePanelSetting = OpenedSupplementalSideBar.None;

if (browser) {
    const localSidePanelSetting = localStorage.getItem(sidepanelSettingString);

    if (localSidePanelSetting !== null) {
        savedSidePanelSetting = parseInt(localSidePanelSetting) as OpenedSupplementalSideBar;
    }
}

export const currentPreferredOpenedSupplementalSideBar = writable<number>(savedSidePanelSetting);

currentPreferredOpenedSupplementalSideBar.subscribe((val) => {
    if (browser) localStorage.setItem(sidepanelSettingString, `${val}`);
});

export function setPreferredExtraInfoPanel(panelType: OpenedSupplementalSideBar) {
    currentPreferredOpenedSupplementalSideBar.set(panelType);
}
