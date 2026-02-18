<script lang="ts">
    import Chart, { type ChartConfiguration, type ChartDataset } from 'chart.js/auto';
    import { onDestroy, onMount } from 'svelte';
    import type { ResourcesByLanguage, TotalsByMonth } from '../../routes/(dashboard)/+page';
    import { _ as translate } from 'svelte-i18n';
    import { generateColors } from '$lib/utils/color-gen';

    interface Props {
        resourcesByLanguage: ResourcesByLanguage[];
        totalsByMonth: TotalsByMonth[];
        languages: string[];
        selectedLanguages: string[];
        selectedResource: string;
    }

    let { resourcesByLanguage, totalsByMonth, languages, selectedLanguages, selectedResource }: Props = $props();

    const defaultSelection = 'default';

    const months = $derived(totalsByMonth.map((item) => item.monthAbbreviation));

    let languagesToColors: { color: string; language: string }[] | undefined = undefined;

    let chart: Chart | undefined;

    $effect(() => {
        updateTranslatedResourcesChart(selectedLanguages, selectedResource);
    });

    const updateTranslatedResourcesChart = (selectedLanguages: string[], resource: string) => {
        let resources = resourcesByLanguage;

        if (selectedLanguages.length === 0 && resource !== defaultSelection) {
            resources = resources.filter((x) => x.parentResourceName === resource);
        } else if (selectedLanguages.length > 0 && resource === defaultSelection) {
            resources = resources.filter((x) => selectedLanguages.includes(x.language));
        } else if (selectedLanguages.length > 0 && resource !== defaultSelection) {
            resources = resources.filter(
                (x) => selectedLanguages.includes(x.language) && x.parentResourceName === resource
            );
        }

        let langMonthGroup = resources.reduce(
            (group, resource) => {
                const { language, monthAbbreviation } = resource;
                group[`${language}-${monthAbbreviation}`] = group[`${language}-${monthAbbreviation}`] ?? [];
                group[`${language}-${monthAbbreviation}`]!.push(resource);

                return group;
            },
            {} as { [monthLanguage: string]: ResourcesByLanguage[] }
        );

        let translatedData = (selectedLanguages.length === 0 ? languages : selectedLanguages).map((x: string) => ({
            label: x,
            data: [] as number[],
        }));

        for (let langMonth in langMonthGroup) {
            let group = langMonthGroup[langMonth];
            let total = 0;
            for (let i = 0; i < group!.length; i++) {
                total += group![i]!.resourceCount;
            }
            translatedData?.find((x) => x.label === group![0]?.language)?.data.push(total);
        }

        if (!languagesToColors || Object.keys(languagesToColors).length !== Object.keys(translatedData).length) {
            languagesToColors = generateColors(translatedData);
        }

        updateChart(translatedData);
    };

    const updateChart = (data: ChartDataset[]) => {
        if (languagesToColors) {
            for (let i = 0; i < data.length; i++) {
                data[i]!.backgroundColor = languagesToColors.find((lc) => lc.language === data[i]!.label)?.color;
            }
        }

        if (chart !== undefined) {
            chart.data.datasets = data;
            chart.update();
        } else {
            chartData.data.datasets = data;
        }
    };

    const chartData: ChartConfiguration = $derived({
        type: 'bar',
        data: {
            labels: months,
            datasets: [] as { label: string; data: number[] }[],
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
                legend: {
                    display: true,
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 6,
                        boxHeight: 6,
                    },
                },
            },
            elements: {
                line: {
                    backgroundColor: '#81755620',
                    borderColor: '#817556',
                },
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false,
                    },
                },
                y: {
                    stacked: true,
                    ticks: {
                        precision: 0,
                    },
                },
            },
            // @ts-expect-error this barPercentage is valid but missing from the ChartJS types
            barPercentage: 0.5,
        },
    });

    onMount(() => {
        let canvas = document?.getElementById('areaChartCanvas') as HTMLCanvasElement | undefined;
        let canvasContext = canvas?.getContext('2d');
        if (canvasContext) {
            let gradient = canvasContext.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, '#81755690');
            gradient.addColorStop(1, '#81755600');
            if (chartData.data.datasets[0]) {
                chartData.data.datasets[0].backgroundColor = gradient;
            }
        }

        chart = new Chart('translatedResourcesBarChart', chartData);
    });

    onDestroy(() => {
        chart?.destroy();
    });
</script>

<div class="flex flex-col">
    <div class="mb-6 text-lg font-bold">{$translate('page.dashboard.charts.translatedResources.value')}</div>
    <canvas class="h-full! max-h-[24.125rem] w-full!" id="translatedResourcesBarChart"></canvas>
</div>
