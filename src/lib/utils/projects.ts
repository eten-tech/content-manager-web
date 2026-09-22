import { postToApi, patchToApi } from '$lib/utils/http-service';

export function formatDate(date: Date | string | null | undefined): string {
    if (!date) {
        return '';
    }

    if (typeof date === 'string') {
        const dateParts = date.split('-').map((part) => parseInt(part, 10));

        const year = dateParts[0] ?? 0;
        const month = dateParts[1] ?? 0;
        const day = dateParts[2] ?? 0;

        date = new Date(year, month - 1, day);
    }

    const options = { month: 'short' as const, day: '2-digit' as const, year: 'numeric' as const };
    const formattedDate = (date as Date).toLocaleDateString('en-US', options);

    return formattedDate;
}

export async function updateProject(id: number | string | undefined, data: { [key: string]: string | number }) {
    await patchToApi(`/projects/${id}`, {
        ...data,
    });
}

export async function startProject(id: number | string | undefined) {
    await postToApi(`/projects/${id}/start`);
}

export interface RequeueProjectPreTranslationOptions {
    shouldForceRetranslation: boolean;
    shouldSkipCompanyLeadAssignment: boolean;
    shouldSkipProjectStartedNotification: boolean;
    /** Null or empty pre-translates the whole project. */
    resourceContentIds: number[] | null;
}

export async function requeueProjectPreTranslation(
    id: number | string | undefined,
    options: RequeueProjectPreTranslationOptions
) {
    await postToApi(`/admin/projects/${id}/pre-translate`, { ...options });
}

export function formatCurrency(amount: number | string): string {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    });

    return formatter.format(Number(amount));
}

export function formatNumberWithCommas(amount: number | string): string {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
