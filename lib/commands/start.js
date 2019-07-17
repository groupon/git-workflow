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

const { remoteFromLocal, UIError, inferRemote } = require('../common');

/** @type {import('../typedefs').ActionFn} */
async function startAction({ deps: { git, log }, args: [branch], opts }) {
  if (!/^[\w-]+$/.test(branch)) {
    throw new UIError('branch must match /^[\\w-]+$/');
  }

  const { branches, current } = await git.branchLocal();

  if (branches[branch]) {
    throw new UIError(`You already have a branch named ${branch}`);
  }

  const remote = await inferRemote(
    git,
    opts.fork,
    opts.parent && opts.parent.open
  );

  const remoteBranch = remoteFromLocal(
    branch,
    opts.prBase || current,
    remote === 'fork'
  );

  if (opts.stash) {
    const { files } = await git.status();
    if (files.length === 0) throw new UIError('No changed files to stash');
    log('Stashing changes');
    await git.stash();
  }

  log(`Updating current branch '${current}'`);
  // @ts-ignore
  await git.pull({ '--no-rebase': true });

  const pushSpec = `${branch}:${remoteBranch}`;
  log(`Creating and pushing branch ${pushSpec}`);
  await git.checkoutLocalBranch(branch);
  await git.push(remote, pushSpec, { '--set-upstream': true });

  if (opts.stash) {
    log('Popping stashed changes');
    await git.stash(['pop']);
  }
}

/** @type {import('../typedefs').Action} */
module.exports = {
  action: startAction,
  command(prog, wrapAction) {
    prog
      .command('start <branch>')
      .description('Create new feature branch from current branch')
      .option('-f, --fork', 'Create the branch on a fork')
      .option('-s, --stash', 'stash working tree changes & move to new feature')
      .option(
        '-p, --pr-base <p>',
        'while still using current branch as starting point, make the parent (for PRs) something else'
      )
      .action(wrapAction(startAction));
  },
};
