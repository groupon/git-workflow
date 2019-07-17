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

const open = require('open');

const { action: mergeBackAction } = require('./merge-back');

const { ghURL, assertNoFork } = require('../common');

/** @type {import('../typedefs').ActionFn} */
async function cutReleaseAction({ deps: { git, log }, args: [branch], opts }) {
  await assertNoFork(git, 'cut-release');

  if (!branch) branch = 'master';

  log('Ensuring all changes are merged back');
  await mergeBackAction({ deps: { git, log }, opts, args: [] });

  log(`Creating PR to fast-forward merge ${branch} onto release`);
  const prURL = await ghURL(git, `/compare/release...${branch}`, {
    expand: 1,
    title: `Cut release from ${branch}`,
  });
  log(`Opening ${prURL}`);
  if (opts.parent.open) await open(prURL);
}

/** @type {import('../typedefs').Action} */
module.exports = {
  action: cutReleaseAction,
  command(prog, wrapAction) {
    prog
      .command('cut-release [branch]')
      .description('Move branch (default: master) commits onto release branch')
      .action(wrapAction(cutReleaseAction));
  },
};
