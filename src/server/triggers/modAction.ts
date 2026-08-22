import { OnModActionRequest, TriggerResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { clearModPermissionsForUser } from "../core";

export const onModAction = async (c: Context) => {
    const modActionRequest = await c.req.json<OnModActionRequest>();

    if (!modActionRequest.action || !modActionRequest.targetUser?.id) {
        return c.json<TriggerResponse>({ message: "invalid mod action request" }, 200);
    }

    const relevantModActions = [
        "addmoderator",
        "invitemoderator",
        "permissions",
        "removemoderator",
    ];

    if (relevantModActions.includes(modActionRequest.action)) {
        await clearModPermissionsForUser(modActionRequest.targetUser.id);
    }

    return c.json<TriggerResponse>({ message: "mod action handled" }, 200);
};
