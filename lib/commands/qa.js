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

const { action: mergeBackAction } = require('./merge-back');
const { assertNoFork } = require('../common');

function genBuildTag() {
  // 2017-09-22T16:10:25.766Z -> build-2017.09.22_16.10.25
  const ts = new Date()
    .toISOString()
    .replace(/\..+/, '')
    .replace(/[:-]/g, '.')
    .replace('T', '_');
  return `build-${ts}`;
}

async function qaAction({ git, log }, branch, opts) {
  await assertNoFork(git, 'qa');

  if (branch) await git.checkout(branch);
  else branch = (await git.branchLocal()).current;

  if (branch === 'release' && opts.mergeBack) {
    log('Requiring clean merge-back for release qa');
    await mergeBackAction({ git, log });
  } else {
    log(`Pulling latest commits for '${branch}'`);
    await git.pull({ '--no-rebase': true });
  }

  const tag = genBuildTag();

  log(`Creating and pushing tag to github: ${tag}`);
  await git.tag([tag]);
  await git.push(['origin', 'tag', tag]);
}

module.exports = {
  action: qaAction,
  command(prog, wrapAction) {
    prog
      .command('qa [branch]')
      .option(
        '-M, --no-merge-back',
        "Don't require a merge-back for qa of 'release' branch"
      )
      .description('Tag given (or current) branch as a build')
      .action(wrapAction(qaAction));
  },
};
