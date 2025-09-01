import { SettingsFormFieldGroup } from "@devvit/public-api";
import { NukeFormField } from "./nuke.js";
import { appSettings } from "./settings.js";

test("All nuke form fields are also available in settings", () => {
    const nukeFields = Object.values(NukeFormField);
    const settingsFields = (appSettings as SettingsFormFieldGroup).fields;
    const settingsFieldNames = Object.values(settingsFields).filter(field => "name" in field).map(field => field.name);

    const nukeFieldsWithoutSetting = nukeFields.filter(field => !settingsFieldNames.includes(field));

    expect(nukeFieldsWithoutSetting).toEqual([]);
});
