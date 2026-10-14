# FivePRS Registry

The community assets on **[fiveprs.org/assets](https://fiveprs.org/assets)** and the partners on **[fiveprs.org/partners](https://fiveprs.org/partners)**.

- **[Assets](#submitting)**: callout packs, plugins, terminal apps, scripts, vehicles, maps and clothing made for FivePRS, one JSON file each in [`listings/`](listings).
- **[Partners](#partners)**: communities running FivePRS, hosts that offer it and studios building for it, one JSON file each in [`partners/`](partners).

Every listing is one JSON file in [`listings/`](listings). You add a listing with a pull request, the FivePRS team reviews it, and once it's merged it appears on the site within about ten minutes. The site reads your repository's latest GitHub release for the version and download, so publishing a new release updates your listing without another pull request.

## Submitting

1. Publish your asset in a **public GitHub repository**, with at least one release that has your download (a `.zip`, `.7z` or `.rar`) attached.
2. [Create `listings/<your-id>.json`](https://github.com/FivePRS/registry/new/master/listings) in this repository. GitHub forks the repository for you and opens a pull request. The [submit page](https://fiveprs.org/assets/submit) fills in a template for you.
3. A check runs on your pull request. Fix anything it reports, and a reviewer will take it from there.

```json
{
  "$schema": "../schema/listing.schema.json",
  "id": "lspd-callouts-plus",
  "name": "LSPD Callouts Plus",
  "category": "callouts",
  "summary": "Twelve new police callouts, including bank robberies, hostage situations and street races.",
  "author": "SomeDev",
  "repository": "somedev/lspd-callouts-plus",
  "source": "open",
  "asset": "lspd-callouts-plus.zip",
  "homepage": "https://github.com/somedev/lspd-callouts-plus#readme",
  "image": "https://raw.githubusercontent.com/somedev/lspd-callouts-plus/main/preview.png",
  "tags": ["police", "pursuits"],
  "minVersion": "0.9.0-ptb.3"
}
```

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Lowercase letters, numbers and dashes. Used in the address `fiveprs.org/assets/<id>`, and the file must be named `<id>.json` |
| `name` | Yes | Display name, 3 to 60 characters |
| `category` | Yes | `callouts`, `plugins`, `apps` (terminal apps), `scripts` (resources that use FivePRS exports or events), `vehicles`, `maps` or `clothing` |
| `summary` | Yes | One or two sentences for the listing card, 20 to 160 characters |
| `author` | Yes | Your name or team name |
| `repository` | Yes | The GitHub repository you release from, as `owner/name` |
| `source` | Yes | `open` if the repository has the source code and a license, `closed` if it only hosts releases |
| `asset` | No | The download's file name on your releases. `my-pack.zip` also matches versioned names like `my-pack-1.2.0.zip`. Without it, the site links to your releases page |
| `readme` | No | Path to a Markdown file in your repository to show on the listing page, such as `packs/highway/README.md`. Use it when one repository holds several assets. Without it, the page shows the repository's README |
| `homepage` | No | Documentation or a project page (`https://` only) |
| `image` | No | A 16:9 preview image at a stable `https://` URL, up to 2 MB |
| `tags` | No | Up to 6 lowercase tags |
| `minVersion` | No | The oldest FivePRS version your asset works with |

The full format is in [`schema/listing.schema.json`](schema/listing.schema.json). Editors such as VS Code use it to check your file as you type.

The listing page shows your repository's README, so make it a good one: what the asset does, how to install it and any configuration.

## Official listings

Listings whose `repository` belongs to the [FivePRS](https://github.com/FivePRS) organisation get an **Official** badge and are shown first. The badge comes from the repository owner, so it can't be added to a listing, and only official listings can use FivePRS as their `author`.

## Rules

- **You made it, or the author agreed to the listing.** If the repository isn't yours, say who gave permission in the pull request.
- **It's free.** The download on your releases must be the full asset, not a demo or a link to a paid store.
- **It works with FivePRS.** Keep it working with current releases, or set `minVersion` and note the versions it supports in your README.
- **Only content you have the rights to share.** No game files, leaked or paid assets, or models and clothing taken from other creators. See [Copyright & DMCA](https://fiveprs.org/legal/copyright) for what counts and how infringement is reported.
- **No malware.** No obfuscated code that phones home, backdoors, or anything that harms servers or players. Closed-source listings get extra scrutiny.
- **Open source means licensed.** `"source": "open"` needs a license file in the repository.

Listings that stop meeting these rules, or whose repository or download disappears, are removed. A check runs every week to catch dead repositories.

## Updating and removing

- **New version:** publish a new GitHub release. Nothing to change here.
- **Changed details:** open a pull request that edits your file.
- **Remove your listing:** open a pull request that deletes your file.

## Partners

Anyone can apply. Partners are added the same way as assets: a pull request that adds `partners/<your-id>.json`. The [Become a partner](https://fiveprs.org/partners/apply) page opens one for you with a template for your type. Examples of each type are in [`examples/partners`](examples/partners).

```json
{
  "$schema": "../schema/partner.schema.json",
  "id": "blue-line-rp",
  "name": "Blue Line RP",
  "type": "community",
  "summary": "Serious public safety roleplay with full Police, Fire and EMS departments.",
  "logo": "https://raw.githubusercontent.com/bluelinerp/branding/main/logo.png",
  "website": "https://bluelinerp.example",
  "discord": "https://discord.gg/bluelinerp",
  "joinCode": "abc123",
  "tags": ["us", "serious-rp"]
}
```

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Lowercase letters, numbers and dashes, matching the file name |
| `name` | Yes | Display name, 2 to 50 characters |
| `type` | Yes | `community`, `host` or `studio` |
| `summary` | Yes | One or two sentences for your card, 20 to 200 characters |
| `logo` | Yes | A square logo at a stable `https://` URL, such as your own website, up to 2 MB |
| `website` | Hosts | Your website (`https://` only). Optional for others |
| `discord` | No | A Discord invite that never expires. Your card shows your member count |
| `github` | No | Your GitHub user or organisation name |
| `tags` | No | Up to 6 lowercase tags, such as a region, language or roleplay style |
| `joinCode` | Communities, optional | The code from your `cfx.re/join/<code>` link if you run a FiveM server, for the Join button |
| `offer` | Hosts, optional | A short offer for FivePRS users, such as a discount code |
| `assets` | Studios | Ids of your listings in `listings/`. List new assets first, or in the same pull request |

`joinCode` is only for communities, `offer` only for hosts and `assets` only for studios.

**Requirements**

- **Communities** are FiveM servers running FivePRS, or roleplay and Discord communities that work with FivePRS. Servers add their `cfx.re/join` code.
- **Hosts** can install FivePRS for customers or offer it in their panel, and any offer is real and open to everyone.
- **Studios** have at least one approved listing in `listings/` and keep their assets working with current FivePRS releases.
- **Everyone** runs, owns or represents what they list, uses a logo they have the rights to, makes no claims of being official or endorsed by FivePRS, and follows the FiveM and Cfx.re terms of service.

The check confirms your logo is an image, your Discord invite works and doesn't expire, your website responds and your studio's assets are listed. Partners whose invite, website or server disappears are removed.

## Reporting a listing or partner

Use **Report this listing** on an asset's page, or [open a report](https://github.com/FivePRS/registry/issues/new?template=report-listing.yml) for a listing or partner.

Listed assets are made and supported by their authors, not the FivePRS team. See [Third-party liability](https://fiveprs.org/legal/liability).

## Checking locally

```bash
npm ci
npm run validate          # format checks
npm run validate:online   # also checks repositories and releases on GitHub (set GITHUB_TOKEN to avoid rate limits)
```
