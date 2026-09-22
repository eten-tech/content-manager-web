import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { Permission, userCan } from '$lib/stores/auth';
import { get } from 'svelte/store';
import { getFromApi } from '$lib/utils/http-service';
import type { ProjectResponse } from '$lib/types/projects';

export const load: PageLoad = async ({ params, parent, fetch }) => {
    await parent();

    if (!get(userCan)(Permission.RequeuePreTranslationProject)) {
        redirect(302, '/');
    }

    const projectResponse = await getFromApi<ProjectResponse>(`/projects/${params.projectId}`, fetch);

    return { projectResponse };
};
