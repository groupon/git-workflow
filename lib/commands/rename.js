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

const { UIError, featureParent, remoteFromLocal } = require('../common');

async function renameAction({ git, log }, newBranch) {
  const { current } = await git.branchLocal();

  const { parent, remote } = await featureParent(git, current);
  const onFork = remote === 'fork';

  const oldRemoteBranch = remoteFromLocal(current, parent, onFork);
  const newRemoteBranch = remoteFromLocal(newBranch, parent, onFork);

  const { files } = await git.status();
  if (files.length > 0) {
    throw new UIError('Commit current work before renaming branch');
  }

  log(`Fetching ${remote}`);
  await git.fetch([remote]);

  log(`Creating ${newRemoteBranch} on ${remote}`);
  await git.push(
    remote,
    `refs/remotes/${remote}/${oldRemoteBranch}:refs/heads/${newRemoteBranch}`
  );

  log(`Creating local ${newBranch} branch`);
  await git.checkoutLocalBranch(newBranch);
  await git.branch(['--set-upstream-to', `${remote}/${newRemoteBranch}`]);

  log(`Deleting old local & remote branches`);
  await git.branch(['-D', current]);
  await git.push(remote, `:${oldRemoteBranch}`);
}

module.exports = {
  action: renameAction,
  command(prog, wrapAction) {
    prog
      .command('rename')
      .description('Rename local and remote current feature branch')
      .action(wrapAction(renameAction));
  },
};
