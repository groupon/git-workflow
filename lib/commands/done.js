/*
 * Copyright (c) 2019, Groupon, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of GROUPON nor the names of its contributors may be
 * used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

const debug = require('debug')('workflow:done');

const {
  featureParent,
  yesNo,
  UIError,
  plural,
  inferRemote,
} = require('../common');

/** @param {string} diff */
function stripIndexLines(diff) {
  return diff.replace(/^index .*\n/gm, '');
}

/** @param {string} diff */
function stripLineNums(diff) {
  return diff.replace(/^@@ .*\n/gm, '');
}

/** @param {{ message: string, hash: string }} commit */
function commitDescr({ message, hash }) {
  return `[${hash.slice(0, 7)}] ${message}`;
}

/**
 *
 * @param {import('simple-git/promise').SimpleGit} git
 * @param {string} feature
 * @param {string} parent
 */
async function findSquashedDiff(git, feature, parent) {
  // collect the combined set of diffs on the feature branch
  const base = (await git.raw(['merge-base', parent, feature])).trim();
  const diff = stripIndexLines(await git.diff([`${base}..${feature}`]));

  const { all: commits } = await git.log({ from: base, to: parent });

  /** @type {Map<typeof commits[0], string>} */
  const cachedCommitDiffs = new Map();

  for (const commit of commits) {
    const show = await git.show([commit.hash]);
    // strip off the commit msg at the beginning of the show
    const commitDiff = stripIndexLines(show).replace(/^[\s\S]+?\ndiff/, 'diff');
    if (commitDiff === diff) return commitDescr(commit);
    cachedCommitDiffs.set(commit, commitDiff);
  }

  debug("Couldn't find squashed diff on exact match; fudging line numbers");
  const strippedDiff = stripLineNums(diff);

  for (const commit of commits) {
    let commitDiff = cachedCommitDiffs.get(commit);
    if (!commitDiff) {
      throw new Error(`Couldn't find cached commit diff for ${commit.hash}`);
    }
    commitDiff = stripLineNums(commitDiff);
    if (commitDiff === strippedDiff) return commitDescr(commit);
  }

  debug('Failed to find squashed diff match for:');
  debug(strippedDiff);

  return null;
}

/** @type {import('../typedefs').ActionFn} */
async function doneAction({ deps: { git, log, forceBool } }) {
  const { current: feature } = await git.branchLocal();
  const { parent } = await featureParent(git, feature);

  log(
    `Switching to detected parent branch '${parent}' and pulling latest commits`
  );
  await git.checkout(parent);
  // @ts-ignore
  await git.pull({ '--no-rebase': true });

  const unmerged = (await git.log([`..${feature}`])).total;
  if (unmerged > 0) {
    const squashMsg = await findSquashedDiff(git, feature, parent);
    if (squashMsg) {
      log(`Found squashed commit in ${parent}: ${squashMsg}`);
    } else {
      const ok = await yesNo(
        `Feature branch '${feature}' contains ${plural(
          unmerged,
          'commit'
        )} not present in '${parent}'.  Delete anyway?`,
        false,
        forceBool
      );
      if (!ok) {
        throw new UIError(
          `Refusing to cleanup unmerged feature branch '${feature}'`
        );
      }
    }
  }

  log(`Deleting local ${feature} feature branch and cleaning up remotes`);
  await git.branch(['-D', feature]);
  const remote = await inferRemote(git);
  await git.raw(['remote', 'prune', remote]);
}

/** @type {import('../typedefs').Action} */
module.exports = {
  action: doneAction,
  command(prog, wrapAction) {
    prog
      .command('done')
      .description('Cleanup current merged, PRed feature branch')
      .action(wrapAction(doneAction));
  },
};
