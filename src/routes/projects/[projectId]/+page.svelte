<script lang="ts">
    import type { PageData } from './$types';
    import { Permission, userCan } from '$lib/stores/auth';
    import { project, users } from '$lib/stores/projects';
    import ProjectViewTabs from '$lib/components/projects/ProjectViewTabs.svelte';
    import ProjectViewTableAndFilters from '$lib/components/projects/ProjectViewTableAndFilters.svelte';
    import ProjectProgressBar from '$lib/components/ProjectProgressBar.svelte';
    import { startProject } from '$lib/utils/projects';
    import type { ProjectResource } from '$lib/types/projects';
    import BackButton from '$lib/components/BackButton.svelte';
    import { browser } from '$app/environment';

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();

    let projectResponse = $derived(data.projectResponse);
    $effect(() => {
        $project = projectResponse;
    });

    let usersDerived = $derived(data.users);
    $effect(() => {
        $users = usersDerived;
    });

    let disabledStartButton = $derived(
        $project?.projectManager &&
            $project?.effectiveWordCount &&
            $project?.quotedCost &&
            $project?.projectedDeliveryDate &&
            $project?.projectedPublishDate
    );

    async function onStartProject() {
        if ($project) {
            await startProject($project?.id);
            window.location.reload();
        }
    }

    function jsonToCsv(json: ProjectResource[] | undefined, fields: string[], fieldMapping: Record<string, string>) {
        if (!json) return;
        const replacer = (_: string, value: string) => (value === null ? '' : value);
        const header = fields.map((fieldName) => fieldMapping[fieldName] || fieldName).join(',');
        const csv = [
            header,
            ...json.map((row) =>
                fields.map((fieldName) => JSON.stringify(row[fieldName as keyof ProjectResource], replacer)).join(',')
            ),
        ].join('\r\n');
        return csv;
    }

    function downloadCsv(csv: string | undefined, filename: string) {
        if (!csv || !browser) return;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    function handleDownloadWordCounts() {
        const fields = ['englishLabel', 'wordCount'];
        const fieldMapping = { englishLabel: 'Title', wordCount: 'Word Count' };
        const csv = jsonToCsv($project?.items, fields, fieldMapping);
        const csvFileName = `${$project?.company.replace(/ /g, '_')}-${$project?.name.replace(
            / /g,
            '_'
        )}-word_counts.csv`;
        downloadCsv(csv, csvFileName);
    }
</script>

<svelte:head>
    <title>{$project?.name || 'Project'} | Aquifer Admin</title>
</svelte:head>

<div class="flex justify-between p-4 pb-0 xl:mb-4">
    <div class="flex w-2/3 items-center">
        <BackButton defaultPathIfNoHistory="/projects" />
        <span class="ms-2 text-2xl">
            {projectResponse?.company} - {projectResponse?.name}
        </span>
    </div>
    <div class="flex">
        {#if $project?.started === null && $userCan(Permission.EditProjects)}
            <button class="btn btn-primary" disabled={!disabledStartButton} onclick={onStartProject}>Start</button>
        {:else}
            <button
                data-app-insights-event-name="project-download-word-counts-click"
                class="btn btn-primary"
                onclick={handleDownloadWordCounts}
                >Download Word Counts
            </button>
        {/if}
    </div>
</div>
<div class="flex flex-col overflow-hidden xl:flex-row">
    <div class="px-4 xl:me-8">
        <ProjectViewTabs canOnlyViewProjectsInCompany={data?.canOnlyViewProjectsInCompany ?? false} />
        {#if (projectResponse?.counts?.notStarted ?? 0) + (projectResponse?.counts?.editorReview ?? 0) + (projectResponse?.counts?.inCompanyReview ?? 0) + (projectResponse?.counts?.inPublisherReview ?? 0) + (projectResponse?.counts?.completed ?? 0) > 0}
            <div class="mb-4 w-1/2 pe-4 xl:w-full xl:pe-0">
                <ProjectProgressBar
                    notStartedCount={projectResponse?.counts?.notStarted ?? 0}
                    editorReviewCount={projectResponse?.counts?.editorReview ?? 0}
                    inCompanyReviewCount={projectResponse?.counts?.inCompanyReview ?? 0}
                    inPublisherReviewCount={projectResponse?.counts?.inPublisherReview ?? 0}
                    completeCount={projectResponse?.counts?.completed ?? 0}
                    showLegend={true}
                />
            </div>
        {/if}
    </div>
    <div class="flex w-full grow flex-col overflow-hidden px-4">
        <ProjectViewTableAndFilters />
    </div>
</div>
