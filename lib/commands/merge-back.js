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

const { action: startAction } = require('./start');
const { UIError, cmdLine, assertNoFork } = require('../common');

/**
 * @param {import('../typedefs').CmdDeps} deps
 * @param {string} from
 */
async function createFeatureMerge({ git, log }, from) {
  await git.reset('hard');
  await startAction({
    deps: { git, log },
    args: [`merge-${from}`],
    opts: { parent: {} },
  });
  await git.merge([from]).catch(() => {});
  throw new UIError('When conflicts are resolved, commit and `wf pr`');
}

/**
 * @param {import('simple-git/promise').SimpleGit} git
 * @param {string} branch
 */
async function switchAndPull(git, branch) {
  await git.checkout(branch);
  // @ts-ignore
  await git.pull({ '--no-rebase': true });
}

/**
 * @param {import('../typedefs').CmdDeps} deps
 * @param {string} from
 * @param {string} to
 */
async function tryMerge(deps, from, to) {
  const { git, log } = deps;
  log(`${to} ← ${from}`);
  await switchAndPull(git, to);

  // if there are no additional commits, there's nothing to merge
  if ((await git.log([`${to}..${from}`])).total === 0) return;

  log(`Merging ${from} onto ${to}`);
  try {
    // https://github.com/steveukx/git-js/issues/204
    const output = await git.merge([from]);
    if (/\nCONFLICT /.test(output)) throw new Error(output);
  } catch (err) {
    log('Automated merge failed; creating feature branch for resolution');
    await createFeatureMerge(deps, from); // will throw
  }

  log(`Merged cleanly; committing & pushing results to ${to} branch`);
  await git.commit(
    `Automated merge-back ${to} ← ${from}\n\n` +
      `Original command was: ${cmdLine()}\n`
  );
  await git.push();
}

/** @type {import('../typedefs').ActionFn} */
async function mergeBackAction({ deps }) {
  const { git, log } = deps;

  await assertNoFork(git, 'merge-back');

  const origBranch = (await git.branchLocal()).current;

  await switchAndPull(git, 'hotfix');
  await tryMerge(deps, 'hotfix', 'release');
  await tryMerge(deps, 'release', 'master');

  log('merge-back is clean');

  if (origBranch !== 'master') await git.checkout(origBranch);

  return true;
}

/** @type {import('../typedefs').Action} */
module.exports = {
  action: mergeBackAction,
  command(prog, wrapAction) {
    prog
      .command('merge-back')
      .description('Merges all changes back from master ← release ← hotfix')
      .action(wrapAction(mergeBackAction));
  },
};
