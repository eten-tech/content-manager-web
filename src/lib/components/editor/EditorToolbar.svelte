<script lang="ts">
    import { type Editor, getMarkAttributes } from 'aquifer-tiptap';
    import BoldIcon from '$lib/icons/BoldIcon.svelte';
    import ItalicsIcon from '$lib/icons/ItalicsIcon.svelte';
    import UnderlineIcon from '$lib/icons/UnderlineIcon.svelte';
    import UnorderedListIcon from '$lib/icons/UnorderedListIcon.svelte';
    import OrderedListIcon from '$lib/icons/OrderedListIcon.svelte';
    import Heading1Icon from '$lib/icons/Heading1Icon.svelte';
    import Heading2Icon from '$lib/icons/Heading2Icon.svelte';
    import Heading3Icon from '$lib/icons/Heading3Icon.svelte';
    import UndoIcon from '$lib/icons/UndoIcon.svelte';
    import RedoIcon from '$lib/icons/RedoIcon.svelte';
    import CommentIcon from '$lib/icons/CommentIcon.svelte';
    import Tooltip from '$lib/components/Tooltip.svelte';
    import type { CommentStores } from '$lib/stores/comments';
    import type { ResourceContent } from '$lib/types/resources';
    import { getIsPageTransactingContext } from '$lib/context/is-page-transacting-context';
    import MenuIcon from '$lib/icons/MenuIcon.svelte';
    import { onMount } from 'svelte';
    import LinkBibleReferenceButton from './LinkBibleReferenceButton.svelte';
    import { Permission, userCan } from '$lib/stores/auth';
    import LinkResourceReferenceButton from './LinkResourceReferenceButton.svelte';
    import { ResourceContentStatusEnum } from '$lib/types/base';
    import MachineTranslationRating from '$lib/components/MachineTranslationRating.svelte';

    interface Props {
        itemIndex: number;
        editor: Editor | undefined;
        commentStores: CommentStores;
        canEdit: boolean;
        resourceContent: ResourceContent;
        isLoading: boolean;
    }

    let { itemIndex, editor, commentStores, canEdit, resourceContent, isLoading = $bindable() }: Props = $props();

    const isPageTransacting = getIsPageTransactingContext();

    let canEditBibleReferences = $derived($userCan(Permission.EditBibleReferences));
    let canEditResourceReferences = $derived($userCan(Permission.EditResourceReferences));

    let outerDiv: HTMLDivElement | null = $state(null);
    let isCommentBoxOpen = false;

    const showMachineTranslationRating = $derived(
        canEdit && resourceContent.status === ResourceContentStatusEnum.TranslationEditorReview
    );

    let widthRequired = $derived(
        (canEditBibleReferences ? 30 : 0) +
            (canEditResourceReferences ? 30 : 0) +
            (showMachineTranslationRating ? 136 : 0) +
            460
    );

    function getCommentOptions(editor: Editor) {
        return {
            name: 'comment',
            onClick: () => {
                isCommentBoxOpen = true;

                // Create a temporary comment mark so that we can create a span with id.
                // After the comment is created will replace with valid thread id.
                editor.chain().focus().setComments({ threadId: -1 }).run();
                let selectionRange = { from: editor.state.selection.from, to: editor.state.selection.to };

                let tempSpan = document.getElementById('thread-temp');
                tempSpan?.click();

                commentStores.createNewThread.set((created: boolean, threadId: number, hasError: boolean) => {
                    isCommentBoxOpen = false;
                    editor.chain().setTextSelection(selectionRange).focus().unsetComments().run();
                    if (created) {
                        editor
                            .chain()
                            .focus()
                            .setComments({ threadId: threadId })
                            .setTextSelection(selectionRange.from)
                            .run();
                    }

                    if (!hasError) {
                        commentStores.createNewThread.set(() => {
                            return;
                        });
                    }
                });
            },
            isActive: editor.isActive('comments'),
            disabled:
                isCommentBoxOpen ||
                editor.isActive('comments') ||
                editor.state.selection.empty ||
                getMarkAttributes(editor.state, 'comments')?.comments,
            icon: CommentIcon,
        };
    }

    function formattingOptions(editor: Editor) {
        return [
            {
                name: 'undo',
                onClick: () => {
                    editor.commands.undo();
                },
                disabled: !editor.can().undo(),
                isActive: false,
                icon: UndoIcon,
            },
            {
                name: 'redo',
                onClick: () => {
                    editor.commands.redo();
                },
                disabled: !editor.can().redo(),
                isActive: false,
                icon: RedoIcon,
            },
            {
                name: 'bold',
                onClick: () => {
                    editor.chain().focus().toggleBold().run();
                },
                isActive: editor.isActive('bold'),
                disabled: false,
                icon: BoldIcon,
            },
            {
                name: 'italic',
                onClick: () => {
                    editor.chain().focus().toggleItalic().run();
                },
                isActive: editor.isActive('italic'),
                disabled: false,
                icon: ItalicsIcon,
            },
            {
                name: 'underline',
                onClick: () => {
                    editor.chain().focus().toggleUnderline().run();
                },
                isActive: editor.isActive('underline'),
                disabled: false,
                icon: UnderlineIcon,
            },
            {
                name: 'bulletList',
                onClick: () => {
                    editor.chain().focus().toggleBulletList().run();
                },
                isActive: editor.isActive('bulletList'),
                disabled: false,
                icon: UnorderedListIcon,
            },
            {
                name: 'orderedList',
                onClick: () => {
                    editor.chain().focus().toggleOrderedList().run();
                },
                isActive: editor.isActive('orderedList'),
                disabled: false,
                icon: OrderedListIcon,
            },
            {
                name: 'header1',
                onClick: () => {
                    editor.chain().focus().toggleHeading({ level: 1 }).run();
                },
                isActive: editor.isActive('heading', { level: 1 }),
                disabled: false,
                icon: Heading1Icon,
            },
            {
                name: 'header2',
                onClick: () => {
                    editor.chain().focus().toggleHeading({ level: 2 }).run();
                },
                isActive: editor.isActive('heading', { level: 2 }),
                disabled: false,
                icon: Heading2Icon,
            },
            {
                name: 'header3',
                onClick: () => {
                    editor.chain().focus().toggleHeading({ level: 3 }).run();
                },
                isActive: editor.isActive('heading', { level: 3 }),
                disabled: false,
                icon: Heading3Icon,
            },
        ];
    }

    let resizeObserver: ResizeObserver;
    let outerDivWidth: number | null = $state(null);

    onMount(() => {
        if (outerDiv) {
            resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(() => {
                    outerDivWidth = outerDiv?.offsetWidth ?? null;
                });
            });
            resizeObserver.observe(outerDiv);

            return () => {
                resizeObserver.disconnect();
            };
        }
    });
</script>

<div bind:this={outerDiv} class="flex min-h-6 items-center justify-between">
    {#if editor}
        {@const commentOptions = getCommentOptions(editor)}
        {@const commentDisabled = commentOptions.disabled || $isPageTransacting}
        <div class="flex space-x-2">
            {#if canEdit}
                {#if outerDivWidth && outerDivWidth < widthRequired}
                    <div class="dropdown-start dropdown max-h-6">
                        <div tabindex="0" role="button" class="btn btn-link h-auto min-h-0 scale-[90%] p-0">
                            <MenuIcon />
                        </div>
                        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                        <ul
                            tabindex="0"
                            class="dropdown-content menu-horizontal rounded-box bg-base-100 z-50 h-auto min-h-0
                            items-center space-x-2 p-2 pt-3 pb-1 shadow"
                        >
                            {#each formattingOptions(editor) as option (option.name)}
                                {@const disable = option.disabled || $isPageTransacting}
                                <li>
                                    <button
                                        data-app-insights-event-name="editor-toolbar-{option.name}-click"
                                        class="btn h-auto min-h-0 px-1 py-0 {disable && 'bg-base-200!'} {option.isActive
                                            ? 'btn-primary'
                                            : 'btn-ghost'}"
                                        disabled={disable}
                                        onclick={option.onClick}
                                    >
                                        <div class="mt-[-1px] scale-[85%]">
                                            <option.icon />
                                        </div>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {:else}
                    {#each formattingOptions(editor) as option (option.name)}
                        {@const disable = option.disabled || $isPageTransacting}
                        <button
                            data-app-insights-event-name="editor-toolbar-{option.name}-click"
                            class="btn btn-xs px-1 {disable && 'bg-base-200!'} {option.isActive
                                ? 'btn-primary'
                                : 'btn-ghost'}"
                            disabled={disable}
                            onclick={option.onClick}
                        >
                            <div class="mt-[-1px] scale-[85%]">
                                <option.icon />
                            </div>
                        </button>
                    {/each}
                {/if}
                <div class="divider divider-horizontal mx-0 w-0"></div>
                {#if canEditBibleReferences}
                    <LinkBibleReferenceButton {resourceContent} {editor} />
                {/if}
                {#if canEditResourceReferences}
                    <LinkResourceReferenceButton resourceContentId={resourceContent.resourceContentId} {editor} />
                {/if}
            {/if}
            <Tooltip position={{ left: '2rem', bottom: '0.2rem' }} class="flex align-middle" text="Add Comment">
                <button
                    data-app-insights-event-name="editor-toolbar-comment-click"
                    class="btn btn-xs px-1 {commentDisabled && 'bg-base-200!'} {commentOptions.isActive
                        ? 'btn-primary'
                        : 'btn-ghost'}"
                    disabled={commentDisabled}
                    onclick={commentOptions.onClick}
                >
                    <div class="mt-[-1px] scale-[85%]">
                        <commentOptions.icon />
                    </div>
                </button>
            </Tooltip>
        </div>
        <div class="flex">
            {#if showMachineTranslationRating && !isLoading}
                <div class="mx-2 flex items-center">
                    <MachineTranslationRating {itemIndex} />
                </div>
            {/if}
        </div>
    {/if}
</div>
