import { describe, expect, test } from "vitest";

import { NukeFormField } from "./constants.js";
import { AppSetting } from "./settings.js";

function getMissingValues (source: string[], target: string[]): string[] {
    const targetSet = new Set(target);
    return source.filter(value => !targetSet.has(value)).sort();
}

describe("NukeFormField parity", () => {
    test("every NukeFormField entry is represented in AppSetting", () => {
        const formFieldValues = Object.values(NukeFormField).sort();
        const appSettingValues = Object.values(AppSetting).sort();

        expect(
            getMissingValues(formFieldValues, appSettingValues),
            "Missing in AppSetting enum",
        ).toEqual([]);
    });
});
