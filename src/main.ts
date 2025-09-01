import { Devvit } from "@devvit/public-api";
import { handleNukeCommentForm, handleNukePostForm, nukeFormDefinition } from "./nuke.js";
import { appSettings, getNukeDefaults } from "./settings.js";
import { handleModAction, preCheckNukePermissions } from "./userPermissions.js";

Devvit.addSettings(appSettings);

Devvit.configure({
    redditAPI: true,
    modLog: true,
});

Devvit.addTrigger({
    event: "ModAction",
    onEvent: handleModAction,
});

const nukeForm = Devvit.createForm(nukeFormDefinition, handleNukeCommentForm);

Devvit.addMenuItem({
    label: "Mop comments",
    description: "Remove this comment and all child comments. This might take a few seconds to run.",
    location: "comment",
    forUserType: "moderator",
    onPress: async (_, context) => {
        if (!await preCheckNukePermissions(context)) {
            return;
        }

        const nukeDefaults = await getNukeDefaults(context);
        const nukeData = {
            title: "Mop comments",
            remove: nukeDefaults.remove,
            lock: nukeDefaults.lock,
            skipDistinguished: nukeDefaults.skipDistinguished,
            skipAlreadyActioned: nukeDefaults.skipAlreadyActioned,
        };

        console.log(`Showing nuke comment form for user ${context.userId}`);
        context.ui.showForm(nukeForm, nukeData);
    },
});

const nukePostForm = Devvit.createForm(nukeFormDefinition, handleNukePostForm);

Devvit.addMenuItem({
    label: "Mop post comments",
    description: "Remove all comments of this post. This might take a few seconds to run.",
    location: "post",
    forUserType: "moderator",
    onPress: async (_, context) => {
        if (!await preCheckNukePermissions(context)) {
            return;
        }

        const nukeDefaults = await getNukeDefaults(context);
        const nukeData = {
            title: "Mop post comments",
            remove: nukeDefaults.remove,
            lock: nukeDefaults.lock,
            skipDistinguished: nukeDefaults.skipDistinguished,
            skipAlreadyActioned: nukeDefaults.skipAlreadyActioned,
        };

        console.log(`Showing nuke post form for user ${context.userId}`);
        context.ui.showForm(nukePostForm, nukeData);
    },
});

export default Devvit;
