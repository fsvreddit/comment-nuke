import { describe, expect, test } from "vitest";

import devvitConfig from "../../../devvit.json";
import { AppSetting } from "./settings.js";

interface DevvitConfig {
    settings?: Record<string, Record<string, unknown>>;
}

function getDevvitSettingKeys (): string[] {
    const config = devvitConfig as DevvitConfig;
    const settingsByScope = Object.values(config.settings ?? {});

    return [...new Set(settingsByScope.flatMap(scopeSettings => Object.keys(scopeSettings)))].sort();
}

function getAppSettingValues (): string[] {
    return Object.values(AppSetting).sort();
}

function getMissingValues (source: string[], target: string[]): string[] {
    const targetSet = new Set(target);
    return source.filter(value => !targetSet.has(value)).sort();
}

describe("App settings parity", () => {
    test("devvit.json settings are all represented in AppSetting", () => {
        const devvitSettings = getDevvitSettingKeys();
        const appSettings = getAppSettingValues();

        expect(
            getMissingValues(devvitSettings, appSettings),
            "Missing in AppSetting enum",
        ).toEqual([]);
    });

    test("AppSetting entries are all represented in devvit.json settings", () => {
        const devvitSettings = getDevvitSettingKeys();
        const appSettings = getAppSettingValues();

        expect(
            getMissingValues(appSettings, devvitSettings),
            "Missing in devvit.json settings",
        ).toEqual([]);
    });
});
