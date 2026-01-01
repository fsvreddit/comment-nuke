import { Comment, Context, FormFunction, FormOnSubmitEvent, JSONObject, Post } from "@devvit/public-api";
import pluralize from "pluralize";

export enum NukeFormField {
    Remove = "remove",
    Lock = "lock",
    SkipDistinguished = "skipDistinguished",
    SkipAlreadyActioned = "skipAlreadyActioned",
}

export const nukeFormDefinition: FormFunction = data => ({
    title: data.title as string,
    fields: [
        {
            name: NukeFormField.Remove,
            label: "Remove comments",
            type: "boolean",
            defaultValue: data.remove as boolean,
        },
        {
            name: NukeFormField.Lock,
            label: "Lock comments",
            type: "boolean",
            defaultValue: data.lock as boolean,
        },
        {
            name: NukeFormField.SkipDistinguished,
            label: "Skip distinguished comments",
            helpText: "If set, the app will not remove/lock comments with the Mod badge",
            type: "boolean",
            defaultValue: data.skipDistinguished as boolean,
        },
        {
            name: NukeFormField.SkipAlreadyActioned,
            label: "Skip already actioned comments",
            helpText: "If set, the app will not remove/lock comments that have already been removed/locked",
            type: "boolean",
            defaultValue: data.skipAlreadyActioned as boolean,
        },
    ],
    acceptLabel: "Mop",
    cancelLabel: "Cancel",
});

export interface NukeProps {
    remove: boolean;
    lock: boolean;
    skipDistinguished: boolean;
    skipAlreadyActioned: boolean;
    target: Post | Comment;
}

interface ActionResult {
    promises: Promise<void>[];
    commentsActioned: number;
}

async function actionAllCommentsInThread (comment: Comment, nukeProps: NukeProps): Promise<ActionResult> {
    const promises: Promise<void>[] = [];
    let actioned = false;

    if (nukeProps.remove && (!nukeProps.skipDistinguished || !comment.isDistinguished()) && (!nukeProps.skipAlreadyActioned || !comment.removed)) {
        promises.push(comment.remove());
        actioned = true;
    }

    if (nukeProps.lock && (!nukeProps.skipAlreadyActioned || !comment.locked)) {
        promises.push(comment.lock());
        actioned = true;
    }

    const replies = await comment.replies.all();
    const actions = await Promise.all(replies.map(reply => actionAllCommentsInThread(reply, nukeProps)));

    return {
        promises: [...promises, ...actions.map(action => action.promises).flat()],
        commentsActioned: (actioned ? 1 : 0) + actions.reduce((sum, action) => sum + action.commentsActioned, 0),
    };
}

async function actionAllCommentsInPost (post: Post, nukeProps: NukeProps) {
    const replies = await post.comments.all();
    const actions = await Promise.all(replies.map(reply => actionAllCommentsInThread(reply, nukeProps)));

    return {
        promises: actions.map(action => action.promises).flat(),
        commentsActioned: actions.reduce((sum, action) => sum + action.commentsActioned, 0),
    };
}

export async function handleNukePostForm (event: FormOnSubmitEvent<JSONObject>, context: Context) {
    if (!context.postId) {
        console.error("No post ID");
        throw new Error("No post ID");
    }

    const target = await context.reddit.getPostById(context.postId);

    const nukeProps: NukeProps = {
        remove: event.values.remove as boolean,
        lock: event.values.lock as boolean,
        skipDistinguished: event.values.skipDistinguished as boolean,
        skipAlreadyActioned: event.values.skipAlreadyActioned as boolean,
        target,
    };

    if (!nukeProps.lock && !nukeProps.remove) {
        context.ui.showToast("You must select either lock or remove.");
        return;
    }

    if (nukeProps.lock && !nukeProps.remove) {
        if (target.locked) {
            context.ui.showToast("The post is already locked. Locking individual comments is not necessary.");
        } else {
            await target.lock();
            context.ui.showToast("Rather than locking individual comments, the post has been locked.");
        }
        return;
    }

    await handleNuke(nukeProps, context);
}

export async function handleNukeCommentForm (event: FormOnSubmitEvent<JSONObject>, context: Context) {
    const { values } = event;

    if (!context.commentId) {
        console.error("No comment ID");
        throw new Error("No comment ID");
    }

    const target = await context.reddit.getCommentById(context.commentId);

    const nukeProps: NukeProps = {
        remove: values.remove as boolean,
        lock: values.lock as boolean,
        skipDistinguished: values.skipDistinguished as boolean,
        skipAlreadyActioned: values.skipAlreadyActioned as boolean,
        target,
    };

    await handleNuke(nukeProps, context);
}

async function handleNuke (nukeProps: NukeProps, context: Context): Promise<void> {
    const start = Date.now();
    try {
        let actionResult: ActionResult;

        if (nukeProps.target instanceof Comment) {
            actionResult = await actionAllCommentsInThread(nukeProps.target, nukeProps);
        } else {
            actionResult = await actionAllCommentsInPost(nukeProps.target, nukeProps);
        }

        const commentGatherEnd = Date.now();
        console.log(`${nukeProps.target.id}: Gathered ${actionResult.promises.length} ${pluralize("promises", actionResult.promises.length)} in ${commentGatherEnd - start}ms`);
        if (actionResult.promises.length === 0) {
            console.log(`${nukeProps.target.id}: No comments found to mop.`);
            context.ui.showToast("No comments found to mop.");
            return;
        }

        const results = await Promise.allSettled(actionResult.promises);

        if (results.some(result => result.status === "rejected")) {
            context.ui.showToast("Mop failed! Please try again later.");
            return;
        }

        const nukeEnd = Date.now();

        const currentUsername = await context.reddit.getCurrentUsername();

        let toastVerbage: string;
        let logVerbage: string;
        if (nukeProps.lock && nukeProps.remove) {
            toastVerbage = "removed and locked";
            logVerbage = "remove and lock";
        } else {
            toastVerbage = nukeProps.lock ? "locked" : "removed";
            logVerbage = nukeProps.lock ? "lock" : "remove";
        }

        console.log(`${nukeProps.target.id}: /u/${currentUsername} successfully ${toastVerbage} ${actionResult.commentsActioned} ${pluralize("comment", actionResult.commentsActioned)} in ${nukeEnd - commentGatherEnd}ms.`);

        if (nukeProps.remove) {
            try {
                await context.modLog.add({
                    action: nukeProps.target instanceof Comment ? "removecomment" : "removelink",
                    target: nukeProps.target.id,
                    details: "comment-mop app",
                    description: `${currentUsername} used comment-mop to ${logVerbage} all comments of this post.`,
                });
            } catch (e: unknown) {
                console.error(`Failed to add modlog for ${nukeProps.target.id}.`, (e as Error).message);
            }
        }

        context.ui.showToast({
            text: `Successfully ${toastVerbage} comments! Refresh the page to see the cleanup.`,
            appearance: "success",
        });
    } catch (e) {
        console.error(`${nukeProps.target.id}: Failed to nuke comments after ${Date.now() - start}ms:`, e);
    }
}
