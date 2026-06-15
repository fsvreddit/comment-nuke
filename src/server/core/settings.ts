import { settings } from "@devvit/web/server";
import { NukeFormField } from ".";

export async function getNukeDefaults () {
    const appSettings = await settings.getAll();
    return {
        remove: appSettings[NukeFormField.Remove] as boolean | undefined ?? true,
        lock: appSettings[NukeFormField.Lock] as boolean | undefined ?? false,
        skipDistinguished: appSettings[NukeFormField.SkipDistinguished] as boolean | undefined ?? false,
        skipAlreadyActioned: appSettings[NukeFormField.SkipAlreadyActioned] as boolean | undefined ?? true,
    };
}

export enum AppSetting {
    Remove = "remove",
    Lock = "lock",
    SkipDistinguished = "skipDistinguished",
    SkipAlreadyActioned = "skipAlreadyActioned",
    RestrictedMods = "restrictedMods",
}
