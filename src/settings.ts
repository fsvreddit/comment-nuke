import { Context, SettingsFormField } from "@devvit/public-api";
import { NukeFormField } from "./nuke.js";

export const appSettings: SettingsFormField = {
    type: "group",
    label: "Comment Mop defaults",
    helpText: "This allows you to set the default values for the 'Mop Comments' form, if the standard defaults don't suit your workflow.",
    fields: [
        {
            name: NukeFormField.Remove,
            type: "boolean",
            label: "Remove comments",
            defaultValue: true,
        },
        {
            name: NukeFormField.Lock,
            type: "boolean",
            label: "Lock comments",
            defaultValue: false,
        },
        {
            name: NukeFormField.SkipDistinguished,
            label: "Skip distinguished comments",
            helpText: "If set, the app will not remove/lock comments with the Mod badge",
            type: "boolean",
            defaultValue: false,
        },
        {
            name: NukeFormField.SkipAlreadyActioned,
            label: "Skip already actioned comments",
            helpText: "If set, the app will not remove/lock comments that have already been removed/locked",
            type: "boolean",
            defaultValue: true,
        },
    ],
};

export async function getNukeDefaults (context: Context) {
    const settings = await context.settings.getAll();
    return {
        remove: settings[NukeFormField.Remove] as boolean | undefined ?? true,
        lock: settings[NukeFormField.Lock] as boolean | undefined ?? false,
        skipDistinguished: settings[NukeFormField.SkipDistinguished] as boolean | undefined ?? false,
        skipAlreadyActioned: settings[NukeFormField.SkipAlreadyActioned] as boolean | undefined ?? true,
    };
}
