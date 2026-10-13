import fs from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = path.resolve(import.meta.dirname, "..");
const RESERVED = new Set(["submit", "apply", "new", "edit", "search"]);
const token = process.env.GITHUB_TOKEN;
const submitter = process.env.PR_AUTHOR;
const online = process.argv.includes("--online");
const checkOnly = process.argv
  .filter((arg) => arg.endsWith(".json"))
  .map((file) => path.relative(ROOT, path.resolve(ROOT, file)).split(path.sep).join("/"));

let failed = false;
const summary = [];

function error(file, message) {
  failed = true;
  console.log(`::error file=${file}::${message}`);
  summary.push(`- ❌ \`${file}\`: ${message}`);
}

function warn(file, message) {
  console.log(`::warning file=${file}::${message}`);
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

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

async function checkImage(file, url, label) {
  const response = await fetch(url, { redirect: "follow" }).catch(() => null);
  if (!response?.ok || !(response.headers.get("content-type") ?? "").startsWith("image/")) {
    return error(file, `The ${label} URL doesn't return an image.`);
  }

  const size = (await response.arrayBuffer()).byteLength;
  if (size > MAX_IMAGE_BYTES) error(file, `The ${label} is ${(size / 1024 / 1024).toFixed(1)} MB. Keep it under 2 MB.`);
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

async function checkListing(file, listing) {
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

  if (listing.image) await checkImage(file, listing.image, "image");
}

async function checkPartner(file, partner) {
  await checkImage(file, partner.logo, "logo");

  if (partner.discord) {
    const code = partner.discord.split("/").pop();
    const response = await fetch(`https://discord.com/api/v10/invites/${code}`);
    if (response.status === 404) error(file, "The Discord invite is invalid or has expired. Use an invite that never expires.");
    else if (response.ok && (await response.json()).expires_at) warn(file, "The Discord invite expires. Use an invite that never expires.");
  }

  if (partner.website) {
    const response = await fetch(partner.website, { redirect: "follow" }).catch(() => null);
    if (!response?.ok) warn(file, `${partner.website} didn't respond. Reviewers: check it loads.`);
  }

  if (partner.github && !(await github(`/users/${partner.github}`))) {
    error(file, `GitHub user or organisation ${partner.github} doesn't exist.`);
  }
}

const TYPE_FIELDS = { joinCode: "community", offer: "host", assets: "studio" };
const TYPE_NAMES = { community: "communities", host: "hosts", studio: "studios" };

function explainPartner(entry) {
  const messages = [];
  for (const [field, type] of Object.entries(TYPE_FIELDS)) {
    if (entry[field] !== undefined && entry.type !== type) messages.push(`"${field}" is only for ${TYPE_NAMES[type]}. Remove it, or change "type".`);
    if (entry[field] === undefined && entry.type === type && field === "assets") messages.push(`${TYPE_NAMES[type][0].toUpperCase()}${TYPE_NAMES[type].slice(1)} need "${field}".`);
  }
  if (entry.type === "host" && entry.website === undefined) messages.push(`Hosts need "website".`);
  return messages;
}

const collections = [
  {
    dir: "listings",
    schema: "listing.schema.json",
    unique: (entry) => [`Name:${entry.name.toLowerCase()}`, `Repository and asset:${entry.repository.toLowerCase()}/${entry.asset ?? ""}`],
    check: checkListing,
  },
  {
    dir: "partners",
    schema: "partner.schema.json",
    unique: (entry) => [`Name:${entry.name.toLowerCase()}`, ...(entry.joinCode ? [`Join code:${entry.joinCode}`] : [])],
    check: checkPartner,
    explain: explainPartner,
  },
];

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

async function load(collection) {
  const schema = JSON.parse(await fs.readFile(path.join(ROOT, "schema", collection.schema), "utf8"));
  const validate = ajv.compile(schema);
  const folder = path.join(ROOT, collection.dir);
  const names = await fs.readdir(folder).catch(() => []);

  for (const name of names.filter((entry) => !entry.endsWith(".json") && entry !== ".gitkeep")) {
    error(`${collection.dir}/${name}`, `Only .json files belong in ${collection.dir}/.`);
  }

  const entries = [];
  for (const name of names.filter((entry) => entry.endsWith(".json")).sort()) {
    const file = `${collection.dir}/${name}`;
    let entry;
    try {
      entry = JSON.parse(await fs.readFile(path.join(folder, name), "utf8"));
    } catch (cause) {
      error(file, `Invalid JSON: ${cause.message}`);
      continue;
    }

    if (!validate(entry)) {
      const explained = collection.explain?.(entry) ?? [];
      const generic = validate.errors.filter(
        (issue) => !(explained.length > 0 && (["if", "not"].includes(issue.keyword) || (issue.keyword === "required" && issue.instancePath === ""))),
      );
      for (const message of explained) error(file, message);
      for (const issue of generic) error(file, `${issue.instancePath || "file"} ${issue.message}`);
      continue;
    }

    if (name !== `${entry.id}.json`) error(file, `The file must be named ${entry.id}.json to match its id.`);
    if (RESERVED.has(entry.id)) error(file, `The id "${entry.id}" is reserved.`);
    entries.push({ file, entry });
  }

  const seen = new Map();
  for (const { file, entry } of entries) {
    for (const key of collection.unique(entry)) {
      const other = seen.get(key);
      const label = key.slice(0, key.indexOf(":"));
      if (other) error(file, `${label} already used by ${other}.`);
      else seen.set(key, file);
    }
  }

  return entries;
}

const loaded = [];
for (const collection of collections) loaded.push({ collection, entries: await load(collection) });

const [listings, partners] = loaded.map(({ entries }) => entries);
const listingIds = new Set(listings.map(({ entry }) => entry.id));
for (const { file, entry } of partners) {
  for (const id of entry.assets ?? []) {
    if (!listingIds.has(id)) error(file, `"${id}" isn't a listing in listings/. List the asset first, or in the same pull request.`);
  }
}

if (online) {
  for (const { collection, entries } of loaded) {
    for (const { file, entry } of entries) {
      if (checkOnly.length > 0 && !checkOnly.includes(file)) continue;
      try {
        await collection.check(file, entry);
      } catch (cause) {
        error(file, cause.message);
      }
    }
  }
}

const result = failed
  ? "❌ Some files need changes."
  : `✅ ${listings.length} listing(s) and ${partners.length} partner(s) are valid.`;
console.log(result);
if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `### Registry check\n\n${result}\n\n${summary.join("\n")}\n`);
}
process.exit(failed ? 1 : 0);
