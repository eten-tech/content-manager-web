<script lang="ts">
    import Chart, { type ChartConfiguration } from 'chart.js/auto';
    import { onDestroy, onMount } from 'svelte';
    import type { ResourcesByLanguage, ResourcesByParentResource, TotalsByMonth } from '../../routes/(dashboard)/+page';
    import { _ as translate } from 'svelte-i18n';

    interface Props {
        totalsByMonth: TotalsByMonth[];
        resourcesByLanguage: ResourcesByLanguage[];
        resourcesByType: ResourcesByParentResource[];
        selectedLanguages: string[];
        selectedResource: string;
    }

    let { totalsByMonth, resourcesByLanguage, resourcesByType, selectedLanguages, selectedResource }: Props = $props();

    const defaultSelection = 'default';
    const months = $derived(totalsByMonth.map((item) => item.monthAbbreviation));

    let chart: Chart | undefined;

    $effect(() => {
        updateTotalResourcesChart(selectedLanguages, selectedResource);
    });

    const updateTotalResourcesChart = (languages: string[], resource: string) => {
        if (languages.length === 0 && resource !== defaultSelection) {
            let totals = resourcesByType.reduce((resources: TotalsByMonth[], r) => {
                if (r.parentResourceName === resource) {
                    resources.push({
                        date: r.date,
                        monthAbbreviation: r.monthAbbreviation,
                        resourceCount: r.resourceCount,
                    });
                }
                return resources;
            }, []);

            updateChart(totals);
        } else if (languages.length > 0) {
            let languageResources =
                resource === defaultSelection
                    ? resourcesByLanguage.filter((resource) => languages.includes(resource.language))
                    : resourcesByLanguage.filter(
                          (item) => languages.includes(item.language) && item.parentResourceName === resource
                      );

            let monthGroup = languageResources.reduce(
                (group, resource) => {
                    const { monthAbbreviation } = resource;
                    group[monthAbbreviation] = group[monthAbbreviation] ?? [];
                    group[monthAbbreviation]!.push(resource);
                    return group;
                },
                {} as { [month: string]: ResourcesByLanguage[] }
            );

            let totals: TotalsByMonth[] = [];
            for (let month in monthGroup) {
                let group = monthGroup[month];
                let total = 0;
                for (let i = 0; i < group!.length; i++) {
                    total += group![i]!.resourceCount;
                }
                if (group![0]) {
                    totals.push({
                        resourceCount: total,
                        monthAbbreviation: group![0].monthAbbreviation,
                        date: group![0].date,
                    });
                }
            }

            updateChart(totals);
        } else {
            updateChart(totalsByMonth);
        }
    };

    const updateChart = (data: TotalsByMonth[]) => {
        let counts = data.map((item) => item.resourceCount);
        if (chart !== undefined) {
            if (chart?.data.datasets[0]) {
                chart.data.datasets[0].data = counts;
                chart.update();
            }
        } else {
            if (chartData.data.datasets[0]) {
                chartData.data.datasets[0].data = counts;
            }
        }
    };

    const chartData: ChartConfiguration = $derived({
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    data: [] as number[],
                    fill: true,
                    tension: 0.0,
                },
            ],
        },
        options: {
            animation: {
                onComplete: function () {
                    this.options.animation = {
                        duration: 1000,
                    };
                },
                duration: 0,
            },
            plugins: {
                legend: { display: false },
            },
            elements: {
                line: {
                    backgroundColor: '#00A3E020',
                    borderColor: '#00A3E0',
                },
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                    },
                },
                y: {
                    ticks: {
                        precision: 0,
                    },
                },
            },
        },
    });

    onMount(() => {
        let canvas = document?.getElementById('totalResourcesAreaChart') as HTMLCanvasElement | undefined;
        let canvasContext = canvas?.getContext('2d');
        if (canvasContext) {
            let gradient = canvasContext.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, '#00A3E090');
            gradient.addColorStop(1, '#00A3E000');
            if (chartData.data.datasets[0]) {
                chartData.data.datasets[0].backgroundColor = gradient;
            }
        }

        chart = new Chart('totalResourcesAreaChart', chartData);
    });

    onDestroy(() => {
        chart?.destroy();
    });
</script>

<div class="flex flex-col">
    <div class="mb-6 text-lg font-bold">{$translate('page.dashboard.charts.totalResources.value')}</div>
    <canvas class="h-full! max-h-[24.125rem] w-full!" id="totalResourcesAreaChart"></canvas>
</div>
