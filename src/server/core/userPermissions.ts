import { context, reddit, redis, User } from "@devvit/web/server";
import { UiResponse } from "@devvit/web/shared";

function getPermissionsCacheKey (userId: string) {
    return `permissionsCache:${userId}`;
}

async function getCurrentUser (): Promise<User | undefined> {
    // First, attempt to get user by conventional means.
    try {
        const user = await reddit.getCurrentUser();
        return user;
    } catch (error) {
        console.error("Error fetching current user using getCurrentUser():", error);
    }

    // Fall back to getting the user from the moderators list.
    const moderators = await reddit.getModerators({
        subredditName: context.subredditName,
        username: await reddit.getCurrentUsername(),
    }).all();

    return moderators.find(moderator => moderator.id === context.userId);
}

export async function canCurrentUserManagePostsAndComments (): Promise<boolean | undefined> {
    if (!context.userId) {
        console.error("No user ID found");
        return;
    }

    const start = Date.now();

    const cachedValue = await redis.get(getPermissionsCacheKey(context.userId));
    if (cachedValue) {
        console.log(`Cache hit for user ${context.userId}, can nuke: ${cachedValue}. Cache lookup took ${Date.now() - start}ms`);
        return JSON.parse(cachedValue) as boolean;
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
        console.error("Current user could not be retrieved or is not a mod.");
        return false;
    }

    const modPermissions = await currentUser.getModPermissionsForSubreddit(context.subredditName);
    const canManagePosts = modPermissions.includes("all") || modPermissions.includes("posts");

    const keyExpiry = Date.now() + 1000 * 28 * 24 * 60 * 60; // 28 days
    await redis.set(getPermissionsCacheKey(currentUser.id), JSON.stringify(canManagePosts), { expiration: new Date(keyExpiry) });

    console.log(`Cache miss for user ${currentUser.username}, can nuke: ${canManagePosts}. Lookup took ${Date.now() - start}ms`);
    return canManagePosts;
}

export async function preCheckNukePermissions (): Promise<UiResponse | undefined> {
    const canManagePostsAndComments = await canCurrentUserManagePostsAndComments();
    if (canManagePostsAndComments === undefined) {
        return {
            showToast: "Could not determine your mod permissions. Please try again later.",
        };
    }

    if (!canManagePostsAndComments) {
        return {
            showToast: "You do not have the correct mod permissions to do this.",
        };
    }
}

export async function clearModPermissionsForUser (userId: string) {
    await redis.del(getPermissionsCacheKey(userId));
}
