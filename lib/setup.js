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

const debug = require('debug')('workflow:setup');

const { gitConfig, UIError } = require('./common');

async function oldestSHA(git) {
  const shas = (await git.raw(['rev-list', '--max-parents=0', 'HEAD']))
    .trim()
    .split('\n');
  return shas[shas.length - 1];
}

// runs optimistically against current state, and if any of the checks
// seem like things aren't right, it does `git fetch origin` then tries once
// more

async function verifySetup(cmd, deps, doFetch) {
  const { git, log } = deps;

  if (doFetch) {
    debug('fetching origin');
    await git.fetch('origin');
  }

  const branches = await git.branch();
  const cfg = await gitConfig(git, true);

  if (cfg['push.default'] !== 'upstream') {
    log('Setting push.default=upstream for this repo');
    await git.addConfig('push.default', 'upstream');
  }

  // these commands don't require the custom branches
  if (/^(done|start|rename|pr|abort)$/.test(cmd)) return;

  debug('checking config for master branch');
  if (!branches.branches.master || cfg['branch.master.remote'] !== 'origin') {
    if (!doFetch) return void (await verifySetup(cmd, deps, true));
    throw new UIError("Missing required 'master' branch from remote 'origin'");
  }

  for (const name of ['release', 'hotfix']) {
    debug('checking for %s branch', name);
    const remote = branches.branches[`remotes/origin/${name}`];
    const local = branches.branches[name];
    if (!local) {
      if (!doFetch) return void (await verifySetup(cmd, deps, true));
      log(`Creating missing local branch ${name}`);
      // start hotfix at the initial commit so it always moves forward
      const base = name === 'hotfix' ? await oldestSHA(git) : 'origin/master';
      await git.checkoutBranch(name, base);
      await git.checkout(branches.current);
    }

    if (remote) {
      for (const [key, val] of [
        ['remote', 'origin'],
        ['merge', `refs/heads/${name}`],
      ]) {
        const fullKey = `branch.${name}.${key}`;
        const cur = cfg[fullKey];
        if (cur == null) {
          if (!doFetch) return void (await verifySetup(cmd, deps, true));
          log(`Setting ${fullKey} to ${val}`);
          await git.addConfig(fullKey, val);
        } else if (cur !== val) {
          if (!doFetch) return void (await verifySetup(cmd, deps, true));
          throw new UIError(
            `Invalid ${key} '${cur}' for local branch '${name}'`
          );
        }
      }
    } else {
      if (!doFetch) return void (await verifySetup(cmd, deps, true));
      log(`Pushing ${name} to origin`);
      await git.push('origin', `${name}:${name}`, { '--set-upstream': true });
    }
  }
}
module.exports = verifySetup;
