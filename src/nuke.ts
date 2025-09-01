import { Comment, Context, FormFunction, FormOnSubmitEvent, JSONObject, Post } from "@devvit/public-api";
import { chunk } from "lodash";
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

async function getAllCommentsInThread (comment: Comment, skipDistinguished: boolean): Promise<Comment[]> {
    const comments: Comment[] = [];

    if (!skipDistinguished || !comment.isDistinguished()) {
        comments.push(comment);
    }

    const replies = await comment.replies.all();
    const replyResults = await Promise.all(replies.map(reply => getAllCommentsInThread(reply, skipDistinguished)));

    comments.push(...replyResults.flat());

    return comments;
}

async function getAllCommentsInPost (post: Post, skipDistinguished: boolean): Promise<Comment[]> {
    const comments: Comment[] = [];

    const replies = await post.comments.all();
    const replyResults = await Promise.all(replies.map(reply => getAllCommentsInThread(reply, skipDistinguished)));

    comments.push(...replyResults.flat());

    return comments;
}

async function nukeComments (comments: Comment[], shouldLock: boolean, shouldRemove: boolean, skipAlreadyActioned: boolean): Promise<boolean> {
    try {
        // Chunk comments into 30 items at a a time to reduce the risk of failure.
        const commentChunks = chunk(comments, 30);

        for (const chunk of commentChunks) {
            if (shouldRemove) {
                if (skipAlreadyActioned) {
                    await Promise.all(chunk.filter(comment => !comment.removed).map(comment => comment.remove()));
                } else {
                    await Promise.all(chunk.map(comment => comment.remove()));
                }
            }

            if (shouldLock) {
                if (skipAlreadyActioned) {
                    await Promise.all(chunk.filter(comment => !comment.locked).map(comment => comment.lock()));
                } else {
                    await Promise.all(chunk.map(comment => comment.lock()));
                }
            }
        }

        return true;
    } catch (error) {
        console.error("Failed to nuke comments:", error);
        return false;
    }
}

export async function handleNukePostForm (event: FormOnSubmitEvent<JSONObject>, context: Context) {
    const { values } = event;

    if (!context.postId) {
        console.error("No post ID");
        throw new Error("No post ID");
    }

    const target = await context.reddit.getPostById(context.postId);

    const nukeProps: NukeProps = {
        remove: values.remove as boolean,
        lock: values.lock as boolean,
        skipDistinguished: values.skipDistinguished as boolean,
        skipAlreadyActioned: values.skipAlreadyActioned as boolean,
        target,
    };

    if (!nukeProps.lock && !nukeProps.remove) {
        context.ui.showToast("You must select either lock or remove.");
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
        let comments: Comment[];

        if (nukeProps.target instanceof Comment) {
            comments = await getAllCommentsInThread(nukeProps.target, nukeProps.skipDistinguished);
        } else {
            comments = await getAllCommentsInPost(nukeProps.target, nukeProps.skipDistinguished);
        }

        const commentGatherEnd = Date.now();
        console.log(`Gathered ${comments.length} ${pluralize("comment", comments.length)} in ${commentGatherEnd - start}ms`);

        if (comments.length === 0) {
            console.log(`${nukeProps.target.id}: No comments found to mop.`);
            context.ui.showToast("No comments found to mop.");
            return;
        }

        const nukeResult = await nukeComments(comments, nukeProps.lock, nukeProps.remove, nukeProps.skipAlreadyActioned);
        if (!nukeResult) {
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

        console.log(`${nukeProps.target.id}: /u/${currentUsername} successfully ${toastVerbage} ${comments.length} ${pluralize("comment", comments.length)} in ${nukeEnd - commentGatherEnd}ms.`);

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
