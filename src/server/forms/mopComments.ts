import { Comment, context, Post, reddit } from "@devvit/web/server";
import { isT1, isT3, UiResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { handleNuke, NukeFormField, NukeProps } from "../core";

interface NukeFormOptions {
    [NukeFormField.Remove]: boolean;
    [NukeFormField.Lock]: boolean;
    [NukeFormField.SkipDistinguished]: boolean;
    [NukeFormField.SkipAlreadyActioned]: boolean;
}

export const handleMopCommentsForm = async (c: Context) => {
    const request = await c.req.json<NukeFormOptions>();

    console.log(`Mopping via commentId ${context.commentId} or postId ${context.postId}`);
    const targetId = context.commentId ?? context.postId;

    if (!targetId) {
        return c.json<UiResponse>({
            showToast: {
                text: "Error: No comment or post context found.",
            },
        });
    }

    let target: Post | Comment;
    if (isT1(targetId)) {
        target = await reddit.getCommentById(targetId);
    } else if (isT3(targetId)) {
        target = await reddit.getPostById(targetId);
    } else {
        return c.json<UiResponse>({
            showToast: {
                text: "Error: Invalid mop target.",
            },
        });
    }

    const nukeProps: NukeProps = {
        remove: request.remove,
        lock: request.lock,
        skipDistinguished: request.skipDistinguished,
        skipAlreadyActioned: request.skipAlreadyActioned,
        target,
    };

    return c.json(await handleNuke(nukeProps), 200);
};
