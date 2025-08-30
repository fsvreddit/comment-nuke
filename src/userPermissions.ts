import { ModAction } from "@devvit/protos";
import { Context, TriggerContext } from "@devvit/public-api";

function getPermissionsCacheKey (userId: string) {
    return `permissionsCache:${userId}`;
}

export async function canCurrentUserManagePostsAndComments (context: Context): Promise<boolean | undefined> {
    if (!context.userId) {
        console.error("No user ID found");
        return;
    }

    const cachedValue = await context.redis.get(getPermissionsCacheKey(context.userId));
    if (cachedValue) {
        console.log(`Cache hit for user ${context.userId}, can nuke: ${cachedValue}`);
        return JSON.parse(cachedValue) as boolean;
    }

    const currentUser = await context.reddit.getCurrentUser();
    if (!currentUser) {
        console.error("No current user found");
        return;
    }

    const modPermissions = await currentUser.getModPermissionsForSubreddit(context.subredditName ?? await context.reddit.getCurrentSubredditName());
    const canManagePosts = modPermissions.includes("all") || modPermissions.includes("posts");

    const keyExpiry = Date.now() + 1000 * 28 * 24 * 60 * 60; // 28 days
    await context.redis.set(getPermissionsCacheKey(currentUser.id), JSON.stringify(canManagePosts), { expiration: new Date(keyExpiry) });

    console.log(`Cache miss for user ${currentUser.id}, can nuke: ${canManagePosts}`);
    return canManagePosts;
}

export async function handleModAction (event: ModAction, context: TriggerContext) {
    if (!event.action || !event.targetUser?.id) {
        return;
    }

    const relevantModActions = [
        "addmoderator",
        "invitemoderator",
        "permissions",
        "removemoderator",
    ];

    if (!relevantModActions.includes(event.action)) {
        return;
    }

    await context.redis.del(getPermissionsCacheKey(event.targetUser.id));
}
