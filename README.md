# Branch Workflow CLI

A cli that provides a set of `git wf` subcommands which simplify dealing with
feature branches & GitHub pull requests. Does not require a GH API token, as
it just opens your browser to complete Pull Request operations.

- creates named feature branches which track their intended "parent" (`start`)
- opens pull requests against the intended parent branch (`pr`)
- cleans up when done (`done`)
- aborts abandoned branches cleanly (`abort`)
- renames branches locally & on server (`rename`)
- additional optional release management commands (`cut-release`, `qa`,
  `hotfix`, `merge-back`)

## "master" vs "main"

Below we use the term `main` to refer to your mainline branch; if you have a
`main` branch in your local checkout, we'll assume that's the one you're using.
If not, we'll assume you're using `master`.

## Installation

```
$ npm install -g git-wf
```

If your GitHub username does not match `$USER` in your environment, you
should set the `$GH_USER` env var to your GitHub username wherever you
set your shell's environment variables.

## Usage

```
$ git wf --help
```

## Commands

The `start`, `pr`, `abort`, `rename`, and `done` commands can be used on **any**
project that has a master or main branch.

All of the other commands will enforce the existence and use of the `main`,
`release`, and `hotfix` branch naming scheme.

### `git wf start [--fork] <name>` - starts a new feature branch

Given you are currently on branch `<parent>`

1. Updates the branch you currently have checked out with `git pull`
1. Creates a new feature branch named `<name>` locally with
   `git checkout -b <name>`
1. If you specified `--fork` or already have a remote named `fork`:
   1. verifies you have a remote named `fork`
   1. if you don't, verifies that `<yourusername>/<reponame>` exists on github,
      and if not prompts you to create it
   1. if you do have a github fork, creates the `fork` remote for you
   1. Pushes your feature branch to `fork` as a branch named
      `feature/<parent>/<name>` with
      `git push -u fork <name>:feature/<parent><name>`
1. If you didn't, pushes your feature branch to `origin` as a branch named
   `<yourusername>/feature/<parent>/<name>` with
   `git push -u origin <name>:<yourusername>/feature/<parent>/<name>`

### `git wf rename <newname>` - renames a feature branch

If you decide you don't like your name, from a checked out feature
branch run this command, passing a new name, it will:

1. Fetch the latest commits from the remote
1. Create a new remote branch named correctly, based on the fetched
   version of the old remote branch (no new commits from local)
1. Create a new local branch with the new name, based on the current
   local branch
1. Make the former the upstream of the latter
1. Delete the old local branch
1. Delete the old remote branch

### `git wf abort` - aborts a feature

If you decide you don't like your new feature, you may PERMANENTLY delete it,
locally and remotely, using `git wf abort`. This will:

1. Commit any working tree changes as a commit with message "WIP"
1. Save the SHA of whatever the final commit was
1. Switch to the parent branch
1. Delete the local branch, remote branch, and remote tracking branch.
1. Output the final SHA in case you change your mind.

### `git wf pr` - PRs a completed feature branch

Given you are currently on a feature branch named `<name>`, makes sure all your
work is pushed to `origin` or `fork`, then opens your browser to a GitHub PR
creation page to merge that back to its parent branch.

### `git wf done` - cleans up a merged feature branch

Given you are currently on a feature branch named `<name>`

1. Switches to inferred parent branch with `git checkout <parent>`
1. Updates the parent branch with `git pull --no-rebase`
1. Deletes the feature branch with `git branch -d <name>`
1. Cleans up the corresponding remote branch with `git remote prune origin`

### `git wf cut-release [branch]` - PRs starting a fresh release from main

1. Runs `git wf merge-back` (see below)
1. Opens a PR, as per `git wf pr` to merge `branch` (default: `main`) to
   `release`

### `git wf qa [branch]` - Tags build of _branch_

1. If no `[branch]` is given, defaults to current branch
1. If `[branch]` is `release`, runs `git wf merge-back`
1. Switches to `[branch]` with `git checkout [branch]`
1. Updates with `git pull --no-rebase`
1. Tags `HEAD` of `[branch]` as `build-YYYY.mm.dd_HH.MM.SS` with
   `git tag build-...`
1. Pushes tag with `git push origin tag build-...`

### `git wf hotfix <build-tag>` - Moves the hotfix branch to given tag

1. Switches to `hotfix` branch
1. Pulls latest updates
1. Fast-forward merges `hotfix` to given build tag
1. Pushes `hotfix` branch

### `git wf merge-back` - Merges all changes back from main ← release ← hotfix

1. Switches to `hotfix` branch
1. Pulls latest updates
1. Merges `hotfix` branch to `release` branch - if there are conflicts, it
   creates a feature branch for you to clean up the results, and submit a PR.
   If not, pushes the merged branch.
1. As before, but this time merging `release` onto `main`

## Example Flow

Here's a narrative sequence of events in the life of a project:

- The project starts with branches `main`, `release`, and `hotfix` all
  pointing at the same place
- On branch main, you `git wf start widget-fix`
- Now on branch `widget-fix`, you make some commits, decide it's ready to PR,
  and run `git wf pr`
- The PR is tested, accepted, and merged, and at some point, while on branch
  `widget-fix`, you run `git wf done`, which cleans it up
- You start a new features, `git wf start bad-ideea`, make a few commits, then
  realize you named it wrong, so you `git wf rename bad-idea` - which is fine
  until you realize you don't want it at all, so you `git wf abort` and it's
  all gone.
- A few more good features go in, and it's time to `git wf cut-release` -
  now your `release` branch is pointing up-to-date with `main`, and people
  can resume adding features to `main`
- It's time to QA your upcoming release, so you `git wf qa release` which
  creates a `build-...` tag
- Your shiny new `build-...` tag is available for deploying
  however you do that, so you deploy it, QA it, and eventually release it
  to production.
- Everything's progressing along, there's new stuff on `main`, maybe a
  new release has even been cut to `release`, when you realize there's
  a problem on production, so you run `git wf hotfix build-...` with the
  build tag that's currently on production. Your `hotfix` branch is now
  ready for fixes.
- From the `hotfix` branch, you `git wf start urgent-thingy` and now you're
  on a feature branch off of `hotfix` - you make your commits to fix the
  bug and `git wf pr`
- People review and approve your PR, it's merged to the `hotfix` branch, you
  `git wf done` to cleanup
- `git wf qa hotfix` creates a new `build-...` tag off of the `hotfix` branch,
  which can be QAed, then (quickly!) deployed to production
- Now's a good time to run `git wf merge-back`, which will take those commits
  sitting on `hotfix` and merge them back onto the `release` branch you had
  in progress. This goes cleanly, so it just does it for you.
- Then it goes to merge `release` back onto `main`, but uh-oh there are some
  conflicts by now, because someone fixed the problem a different way on
  `main`. No worries, `git wf` will detect that, create a feature branch
  to resolve the conflicts, let you clean up the merge on that branch, and
  then you `git wf pr` and it will open a PR to review the resolution.

At every stage, you don't need to stop your forward progress, forget which your
next planned release was, or anything else as you add new features and hotfix
production issues.
