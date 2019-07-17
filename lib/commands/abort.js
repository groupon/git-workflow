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

const { featureParent, inferRemote, remoteFromLocal } = require('../common');

/** @type {import('../typedefs').ActionFn} */
async function abortAction({ deps: { git, log } }) {
  const { current: feature } = await git.branchLocal();
  const { parent } = await featureParent(git, feature);

  log(`Committing in-progress work as WIP`);
  await git.add('--all');
  try {
    await git.commit('WIP');
  } catch (err) {
    // if no changes to commit, don't worry about it
  }

  const finalSHA = await git.revparse(['HEAD']);

  log(`Switching to detected parent branch '${parent}'`);
  await git.checkout(parent);

  log(`Deleting ${feature} feature branch and cleaning up remotes`);
  await git.branch(['-D', feature]);
  const remote = await inferRemote(git);
  const remoteFeature = remoteFromLocal(feature, parent, remote === 'fork');
  await git.push(remote, `:${remoteFeature}`);
  await git.raw(['remote', 'prune', remote]);

  log(`${feature} aborted; last SHA was ${finalSHA.trim()}`);
}

/** @type {import('../typedefs').Action} */
module.exports = {
  action: abortAction,
  command(prog, wrapAction) {
    prog
      .command('abort')
      .description('Close a feature branch without it being merged [CAREFUL]')
      .action(wrapAction(abortAction));
  },
};
