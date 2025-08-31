import { Comment, Context, FormFunction, FormOnSubmitEvent, JSONObject, Post } from "@devvit/public-api";
import pluralize from "pluralize";

export enum NukeFormField {
    Remove = "remove",
    Lock = "lock",
    SkipDistinguished = "skipDistinguished",
}

export const nukeFormDefinition: FormFunction = data => ({
    title: data.title as string,
    fields: [
        {
            name: NukeFormField.Remove,
            label: "Remove Comments",
            type: "boolean",
            defaultValue: data.remove as boolean,
        },
        {
            name: NukeFormField.Lock,
            label: "Lock Comments",
            type: "boolean",
            defaultValue: data.lock as boolean,
        },
        {
            name: NukeFormField.SkipDistinguished,
            label: "Skip Distinguished Comments",
            type: "boolean",
            defaultValue: data.skipDistinguished as boolean,
        },
    ],
    acceptLabel: "Mop",
    cancelLabel: "Cancel",
});

export interface NukeProps {
    remove: boolean;
    lock: boolean;
    skipDistinguished: boolean; // When true, distinguished comments and their children are not processed
    target: Post | Comment;
}

// Depth-first traversal to get all comments in a thread
async function* getAllCommentsInThread (
    comment: Comment,
    skipDistinguished: boolean,
): AsyncGenerator<Comment> {
    if (!skipDistinguished || !comment.isDistinguished()) {
        yield comment;
    }

    const replies = await comment.replies.all();
    for (const reply of replies) {
        yield* getAllCommentsInThread(reply, skipDistinguished);
    }
}

// Depth-first traversal to get all comments in a post
async function* getAllCommentsInPost (
    post: Post,
    skipDistinguished: boolean,
): AsyncGenerator<Comment> {
    const comments = await post.comments.all();
    for (const comment of comments) {
        yield* getAllCommentsInThread(comment, skipDistinguished);
    }
}

async function nukeComments (comments: Comment[], shouldLock: boolean, shouldRemove: boolean): Promise<boolean> {
    try {
        const promises: Promise<void>[] = [];

        if (shouldRemove) {
            promises.push(...comments.map(comment => comment.remove()));
        }

        if (shouldLock) {
            promises.push(...comments.map(comment => comment.lock()));
        }

        await Promise.all(promises);
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
        target,
    };

    await handleNuke(nukeProps, context);
}

async function handleNuke (nukeProps: NukeProps, context: Context): Promise<void> {
    try {
        const comments: Comment[] = [];

        if (nukeProps.target instanceof Comment) {
            for await (const eachComment of getAllCommentsInThread(nukeProps.target, nukeProps.skipDistinguished)) {
                comments.push(eachComment);
            }
        } else {
            for await (const eachComment of getAllCommentsInPost(nukeProps.target, nukeProps.skipDistinguished)) {
                comments.push(eachComment);
            }
        }

        if (comments.length === 0) {
            console.log(`No comments found to mop for ${nukeProps.target.id}.`);
            context.ui.showToast("No comments found to mop.");
            return;
        }

        const nukeResult = await nukeComments(comments, nukeProps.lock, nukeProps.remove);
        if (!nukeResult) {
            context.ui.showToast("Mop failed! Please try again later.");
            return;
        }

        let toastVerbage: string;
        let logVerbage: string;
        if (nukeProps.lock && nukeProps.remove) {
            toastVerbage = "removed and locked";
            logVerbage = "remove and lock";
        } else {
            toastVerbage = nukeProps.lock ? "locked" : "removed";
            logVerbage = nukeProps.lock ? "lock" : "remove";
        }

        console.log(`Successfully ${toastVerbage} ${comments.length} ${pluralize("comment", comments.length)} on ${nukeProps.target.id}.`);

        if (nukeProps.remove) {
            try {
                await context.modLog.add({
                    action: nukeProps.target instanceof Comment ? "removecomment" : "removelink",
                    target: nukeProps.target.id,
                    details: "comment-mop app",
                    description: `${await context.reddit.getCurrentUsername()} used comment-mop to ${logVerbage} all comments of this post.`,
                });
            } catch (e: unknown) {
                console.error(`Failed to add modlog for ${nukeProps.target.id}.`, (e as Error).message);
            }
        }

        context.ui.showToast({
            text: `Successfully ${toastVerbage} ${comments.length} ${pluralize("comment", comments.length)}.`,
            appearance: "success",
        });
    } catch (e) {
        console.error("Failed to nuke comments:", e);
    }
}
