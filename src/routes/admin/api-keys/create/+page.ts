import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { currentUser } from '$lib/stores/auth';
import { UserRole } from '$lib/types/base';
import { get } from 'svelte/store';

export const load: PageLoad = async ({ parent }) => {
    await parent();

    if (!get(currentUser)?.roles.includes(UserRole.Admin)) {
        redirect(302, '/');
    }
};
