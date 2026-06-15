import { Comment, Post, reddit } from "@devvit/web/server";
import { UiResponse } from "@devvit/web/shared";
import pluralize from "pluralize";
import { NukeProps } from ".";

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

export async function handleNuke (nukeProps: NukeProps): Promise<UiResponse> {
    const start = Date.now();

    if (!nukeProps.remove && !nukeProps.lock) {
        return {
            showToast: {
                text: "No action selected! Please select remove and/or lock.",
            },
        };
    }

    try {
        let actionResult: ActionResult;

        if ("parentId" in nukeProps.target) { // A good check for comments vs. posts
            actionResult = await actionAllCommentsInThread(nukeProps.target, nukeProps);
        } else {
            actionResult = await actionAllCommentsInPost(nukeProps.target, nukeProps);
        }

        const commentGatherEnd = Date.now();
        console.log(`${nukeProps.target.id}: Gathered ${actionResult.promises.length} ${pluralize("promises", actionResult.promises.length)} in ${commentGatherEnd - start}ms`);
        if (actionResult.promises.length === 0) {
            console.log(`${nukeProps.target.id}: No comments found to mop.`);
            return {
                showToast: {
                    text: "No comments found to mop.",
                },
            };
        }

        const results = await Promise.allSettled(actionResult.promises);

        if (results.some(result => result.status === "rejected")) {
            return {
                showToast: {
                    text: "Mop failed! Please try again later.",
                },
            };
        }

        const nukeEnd = Date.now();

        const currentUsername = await reddit.getCurrentUsername();

        let toastVerbage: string;
        if (nukeProps.lock && nukeProps.remove) {
            toastVerbage = "removed and locked";
        } else {
            toastVerbage = nukeProps.lock ? "locked" : "removed";
        }

        console.log(`${nukeProps.target.id}: /u/${currentUsername} successfully ${toastVerbage} ${actionResult.commentsActioned} ${pluralize("comment", actionResult.commentsActioned)} in ${nukeEnd - commentGatherEnd}ms.`);

        return {
            showToast: {
                text: `Successfully ${toastVerbage} ${actionResult.commentsActioned} ${pluralize("comment", actionResult.commentsActioned)}! Refresh the page to see the cleanup.`,
                appearance: "success",
            },
        };
    } catch (e) {
        console.error(`${nukeProps.target.id}: Failed to nuke comments after ${Date.now() - start}ms:`, e);
        return {
            showToast: {
                text: "Mop failed! Please try again later.",
            },
        };
    }
}
