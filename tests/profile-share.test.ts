import assert from "node:assert/strict";
import test from "node:test";
import { getProfileShareData } from "../src/lib/profile-share";
import { getProfileMetadata } from "../src/lib/profile-metadata";
import profiles from "../src/data/profiles.json";

test("sharing uses the canonical profile ID on the configured public origin", () => {
    const profile = profiles[0];
    const siteUrl = new URL("https://directory.example.test/other?q=Azure&page=2#results");
    const data = getProfileShareData(profile, siteUrl);
    assert.equal(data.url, new URL(getProfileMetadata(profile).alternates.canonical, siteUrl).href);
    assert.equal(data.url, `https://directory.example.test/mvps/${profile.id}`);
    assert.deepEqual(data.links.map(link => link.platform), ["Facebook", "LinkedIn", "X"]);
});

test("each social composer receives the complete encoded URL and X receives the profile title", () => {
    const profile = { id: "a/b?#", name: "Élodie 李 & O'Neil + #MVP" };
    const data = getProfileShareData(profile, new URL("https://directory.example.test"));
    assert.equal(data.url, "https://directory.example.test/mvps/a%2Fb%3F%23");
    for (const [index, [origin, path, parameter]] of [
        ["https://www.facebook.com", "/sharer/sharer.php", "u"],
        ["https://www.linkedin.com", "/sharing/share-offsite/", "url"],
        ["https://twitter.com", "/intent/tweet", "url"],
    ].entries()) {
        const target = new URL(data.links[index].href);
        assert.equal(target.origin, origin);
        assert.equal(target.pathname, path);
        assert.equal(target.searchParams.get(parameter), data.url);
        assert.equal(target.hash, "");
        if (index === 2) assert.equal(target.searchParams.get("text"), `${profile.name} — Microsoft MVP`);
        else assert.equal([...target.searchParams].length, 1);
    }
});

test("duplicate names have distinct share and copy URLs", () => {
    const duplicates = profiles.filter(profile => profile.name === "Ben Thomas");
    assert.equal(duplicates.length, 2);
    const shares = duplicates.map(profile => getProfileShareData(profile, new URL("https://directory.example.test")));
    assert.notEqual(shares[0].url, shares[1].url);
    shares[0].links.forEach((link, index) => assert.notEqual(link.href, shares[1].links[index].href));
});