import { UiResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { getNukeDefaults, NukeFormField, preCheckNukePermissions } from "../core";
import { context } from "@devvit/web/server";

export const handleMopCommentsMenu = async (c: Context) => {
    const modCheckResult = await preCheckNukePermissions();

    if (modCheckResult) {
        return c.json(modCheckResult);
    }

    console.log(`Showing mop form via commentId ${context.commentId} or postId ${context.postId}`);

    let formTitle: string;
    if (context.commentId) {
        formTitle = "Mop comments";
    } else if (context.postId) {
        formTitle = "Mop post comments";
    } else {
        return c.json<UiResponse>({
            showToast: {
                text: "Error: No comment or post context found.",
            },
        });
    }

    const nukeDefaults = await getNukeDefaults();

    return c.json<UiResponse>({
        showForm: {
            name: "mopComments",
            form: {
                title: formTitle,
                fields: [
                    {
                        name: NukeFormField.Remove,
                        type: "boolean",
                        label: "Remove comments",
                        defaultValue: nukeDefaults.remove,
                    },
                    {
                        name: NukeFormField.Lock,
                        type: "boolean",
                        label: "Lock comments",
                        defaultValue: nukeDefaults.lock,
                    },
                    {
                        name: NukeFormField.SkipDistinguished,
                        type: "boolean",
                        label: "Skip distinguished comments",
                        helpText: "If set, the app will not remove/lock comments with the Mod badge",
                        defaultValue: nukeDefaults.skipDistinguished,
                    },
                    {
                        name: NukeFormField.SkipAlreadyActioned,
                        type: "boolean",
                        label: "Skip already actioned comments",
                        helpText: "If set, the app will not remove/lock comments that have already been removed/locked",
                        defaultValue: nukeDefaults.skipAlreadyActioned,
                    },
                ],
            },
        },
    });
};
