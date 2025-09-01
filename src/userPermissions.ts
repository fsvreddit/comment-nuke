import { ModAction } from "@devvit/protos";
import { Context, TriggerContext, User } from "@devvit/public-api";

function getPermissionsCacheKey (userId: string) {
    return `permissionsCache:${userId}`;
}

async function getCurrentUser (context: Context): Promise<User | undefined> {
    // First, attempt to get user by conventional means.
    try {
        const user = await context.reddit.getCurrentUser();
        return user;
    } catch (error) {
        console.error("Error fetching current user using getCurrentUser():", error);
    }

    // Fall back to getting the user from the moderators list.
    const moderators = await context.reddit.getModerators({
        subredditName: context.subredditName ?? await context.reddit.getCurrentSubredditName(),
        username: await context.reddit.getCurrentUsername(),
    }).all();

    return moderators.find(moderator => moderator.id === context.userId);
}

export async function canCurrentUserManagePostsAndComments (context: Context): Promise<boolean | undefined> {
    if (!context.userId) {
        console.error("No user ID found");
        return;
    }

    const start = Date.now();

    const cachedValue = await context.redis.get(getPermissionsCacheKey(context.userId));
    if (cachedValue) {
        console.log(`Cache hit for user ${context.userId}, can nuke: ${cachedValue}. Cache lookup took ${Date.now() - start}ms`);
        return JSON.parse(cachedValue) as boolean;
    }

    const currentUser = await getCurrentUser(context);
    if (!currentUser) {
        console.error("Current user could not be retrieved or is not a mod.");
        return false;
    }

    const modPermissions = await currentUser.getModPermissionsForSubreddit(context.subredditName ?? await context.reddit.getCurrentSubredditName());
    const canManagePosts = modPermissions.includes("all") || modPermissions.includes("posts");

    const keyExpiry = Date.now() + 1000 * 28 * 24 * 60 * 60; // 28 days
    await context.redis.set(getPermissionsCacheKey(currentUser.id), JSON.stringify(canManagePosts), { expiration: new Date(keyExpiry) });

    console.log(`Cache miss for user ${currentUser.username}, can nuke: ${canManagePosts}. Lookup took ${Date.now() - start}ms`);
    return canManagePosts;
}

export async function preCheckNukePermissions (context: Context): Promise<boolean> {
    const canManagePostsAndComments = await canCurrentUserManagePostsAndComments(context);
    if (canManagePostsAndComments === undefined) {
        context.ui.showToast("Could not determine your mod permissions. Please try again later.");
        return false;
    }

    if (!canManagePostsAndComments) {
        context.ui.showToast("You do not have the correct mod permissions to do this.");
        return false;
    }

    return true;
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
    console.log(`Cleared permissions cache for user ${event.targetUser.id} due to mod action ${event.action}`);
}
