import { Context, SettingsFormField } from "@devvit/public-api";
import { NukeFormField } from "./nuke.js";

export const appSettings: SettingsFormField = {
    type: "group",
    label: "Comment Mop Defaults",
    fields: [
        {
            name: NukeFormField.Remove,
            type: "boolean",
            label: "Remove Comments",
            defaultValue: true,
        },
        {
            name: NukeFormField.Lock,
            type: "boolean",
            label: "Lock Comments",
            defaultValue: false,
        },
        {
            name: NukeFormField.SkipDistinguished,
            type: "boolean",
            label: "Skip Distinguished comments",
            defaultValue: false,
        },
    ],
};

export async function getNukeDefaults (context: Context) {
    const settings = await context.settings.getAll();
    return {
        remove: settings[NukeFormField.Remove] as boolean | undefined ?? true,
        lock: settings[NukeFormField.Lock] as boolean | undefined ?? false,
        skipDistinguished: settings[NukeFormField.SkipDistinguished] as boolean | undefined ?? false,
    };
}
