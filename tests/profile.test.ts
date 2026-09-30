import assert from "node:assert/strict";
import test from "node:test";
import { profileHref, profileInitials } from "../src/lib/profile";
import { parseFilters } from "../src/lib/directory";
import { countries, manifest } from "../src/lib/catalog";
import { EMPTY_FILTERS } from "../src/lib/types";
import profiles from "../src/data/profiles.json";

test("profile links use stable IDs, not names, including duplicate names", () => {
    const duplicates = profiles.filter(profile => profile.name === "Ben Thomas");
    assert.equal(duplicates.length, 2);
    const links = duplicates.map(profile => profileHref(profile.id, EMPTY_FILTERS));
    assert.notEqual(links[0], links[1]);
    duplicates.forEach((profile, index) => assert.equal(links[index], `/mvps/${profile.id}`));
    assert.equal(profileHref("a/b?#", EMPTY_FILTERS), "/mvps/a%2Fb%3F%23");
});

test("profile links round-trip all filters and pagination, including repeated facets", () => {
    const filters = {
        q: "identity & access", country: ["united-states", "canada"],
        category: manifest.categories.slice(0, 2), technology: manifest.technologies.slice(0, 2),
        region: manifest.regions.slice(0, 2), page: 2
    };
    const href = profileHref(profiles[0].id, filters);
    const restored = parseFilters(new URL(href, "https://example.test").searchParams, countries, manifest);
    assert.deepEqual(restored, filters);
    assert.equal(restored.page, 2);
    assert.deepEqual(restored.country, ["united-states", "canada"]);
});

test("portrait initials handle missing photos, punctuation, Unicode, and long names", () => {
    assert.equal(profileInitials("Ahmed Walid"), "AW");
    assert.equal(profileInitials("- ALI TAJRAN"), "AT");
    assert.equal(profileInitials("  Élodie   Åström "), "ÉÅ");
    assert.equal(profileInitials("李"), "李");
    assert.equal(profileInitials("Jayanth Dattatri Yajaman Kodandarama Bhatta"), "JD");
    assert.equal(profileInitials(""), "");
});