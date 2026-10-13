import fs from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = path.resolve(import.meta.dirname, "..");
const LISTINGS = path.join(ROOT, "listings");
const RESERVED = new Set(["submit", "new", "edit", "search"]);
const token = process.env.GITHUB_TOKEN;
const submitter = process.env.PR_AUTHOR;
const online = process.argv.includes("--online");
const checkOnly = process.argv.filter((arg) => arg.endsWith(".json")).map((file) => path.basename(file));

let failed = false;
const summary = [];

function error(file, message) {
  failed = true;
  console.log(`::error file=listings/${file}::${message}`);
  summary.push(`- ❌ \`${file}\`: ${message}`);
}

function warn(file, message) {
  console.log(`::warning file=listings/${file}::${message}`);
  summary.push(`- ⚠️ \`${file}\`: ${message}`);
}

async function github(endpoint) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "fiveprs-registry",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub API ${endpoint} returned ${response.status}`);
  return response.json();
}

function matchesAsset(fileName, asset) {
  const name = fileName.toLowerCase();
  const expected = asset.toLowerCase();
  if (name === expected) return true;

  const dot = expected.lastIndexOf(".");
  const prefix = `${expected.slice(0, dot)}-`;
  const extension = expected.slice(dot);
  return (
    name.startsWith(prefix) &&
    name.endsWith(extension) &&
    /^v?\d+\.\d+\.\d+(-[0-9a-z.]+)?$/.test(name.slice(prefix.length, name.length - extension.length))
  );
}

async function checkRepository(file, listing) {
  const repo = await github(`/repos/${listing.repository}`);
  if (!repo) return error(file, `Repository ${listing.repository} doesn't exist or isn't public.`);
  if (repo.private) return error(file, `Repository ${listing.repository} is private.`);
  if (repo.archived) warn(file, `Repository ${listing.repository} is archived.`);
  if (repo.full_name !== listing.repository) error(file, `Repository has moved: use "${repo.full_name}".`);

  if (listing.source === "open" && !repo.license) {
    error(file, `Open-source listings need a license in the repository. Add one, or set "source": "closed".`);
  }

  if (submitter && repo.owner.login.toLowerCase() !== submitter.toLowerCase()) {
    warn(file, `Submitted by @${submitter}, but ${listing.repository} belongs to @${repo.owner.login}. Reviewers: confirm they're allowed to list it.`);
  }

  const releases = ((await github(`/repos/${listing.repository}/releases?per_page=10`)) ?? []).filter((release) => !release.draft);
  if (releases.length === 0) return error(file, `${listing.repository} has no published releases.`);

  if (listing.asset) {
    const release = releases.find((entry) => !entry.prerelease) ?? releases[0];
    if (!release.assets.some((entry) => matchesAsset(entry.name, listing.asset))) {
      error(file, `The latest release (${release.tag_name}) has no file named ${listing.asset}.`);
    }
  }

  if (listing.image) {
    const response = await fetch(listing.image, { method: "HEAD", redirect: "follow" });
    if (!response.ok || !(response.headers.get("content-type") ?? "").startsWith("image/")) {
      error(file, `The image URL doesn't return an image.`);
    }
  }
}

const schema = JSON.parse(await fs.readFile(path.join(ROOT, "schema", "listing.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const files = (await fs.readdir(LISTINGS)).filter((file) => file.endsWith(".json")).sort();
const others = (await fs.readdir(LISTINGS)).filter((file) => !file.endsWith(".json") && file !== ".gitkeep");
for (const file of others) error(file, "Only .json files belong in listings/.");

const listings = [];
for (const file of files) {
  let listing;
  try {
    listing = JSON.parse(await fs.readFile(path.join(LISTINGS, file), "utf8"));
  } catch (cause) {
    error(file, `Invalid JSON: ${cause.message}`);
    continue;
  }

  if (!validateSchema(listing)) {
    for (const issue of validateSchema.errors) error(file, `${issue.instancePath || "listing"} ${issue.message}`);
    continue;
  }

  if (file !== `${listing.id}.json`) error(file, `The file must be named ${listing.id}.json to match its id.`);
  if (RESERVED.has(listing.id)) error(file, `The id "${listing.id}" is reserved.`);
  listings.push({ file, listing });
}

const seen = new Map();
for (const { file, listing } of listings) {
  for (const key of [`name:${listing.name.toLowerCase()}`, `download:${listing.repository.toLowerCase()}/${listing.asset ?? ""}`]) {
    const other = seen.get(key);
    if (other) error(file, `${key.startsWith("name") ? "Name" : "Repository and asset"} already used by ${other}.`);
    else seen.set(key, file);
  }
}

if (online) {
  for (const { file, listing } of listings) {
    if (checkOnly.length > 0 && !checkOnly.includes(file)) continue;
    try {
      await checkRepository(file, listing);
    } catch (cause) {
      error(file, cause.message);
    }
  }
}

const result = failed ? "❌ Some listings need changes." : `✅ ${listings.length} listing(s) are valid.`;
console.log(result);
if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `### Listing check\n\n${result}\n\n${summary.join("\n")}\n`);
}
process.exit(failed ? 1 : 0);
