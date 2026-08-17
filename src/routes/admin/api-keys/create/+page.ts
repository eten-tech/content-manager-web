import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { Permission, userCan } from '$lib/stores/auth';
import { get } from 'svelte/store';

export const load: PageLoad = async ({ parent }) => {
    await parent();

    if (!get(userCan)(Permission.CreateApiKey)) {
        redirect(302, '/');
    }
};
