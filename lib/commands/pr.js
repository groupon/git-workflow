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

const {
  ghURL,
  featureParent,
  remoteFromLocal,
  cmdLine,
  UIError,
} = require('../common');

function stripNLMPrefix(str) {
  return str.replace(/^(feat|fix|docs|style|refactor|perf|test|chore):\s+/, '');
}

function findTitle(subjects) {
  const eligible = subjects.filter(s => !/^(docs|test):\s/.test(s));
  return eligible.length === 1 ? stripNLMPrefix(eligible[0]) : null;
}

// extracts the organization from the "fork" remote's url
function forkPrefix(git) {
  return git.getRemotes(true).then(remotes => {
    const remote = remotes.find(r => r.name === 'fork').refs.fetch;
    const owner = remote.match(/([\w-]+)\/[^\/]+$/)[1];
    return `${owner}:`;
  });
}

async function prAction({ git, log }, opts) {
  log('Ensuring all work is pushed to remote');
  try {
    await git.push();
  } catch (err) {
    if (/remote contains work/.test(err.message)) {
      throw new UIError(
        "Your local repo is out-of-date so changes can't be pushed"
      );
    }
    throw err;
  }

  const { current } = await git.branchLocal();

  const { parent, remote } = await featureParent(git, current);
  const onFork = remote === 'fork';
  const prefix = onFork ? await forkPrefix(git) : '';
  const remoteBranch = prefix + remoteFromLocal(current, parent, onFork);

  const gitLog = await git.log({
    [`${parent}..`]: true,
    splitter: Math.random(),
    format: { subject: '%s', body: '%b' },
  });

  if (gitLog.total === 0) {
    log(`No commits to PR ${parent}..HEAD`);
    return;
  }

  let title;
  let body;
  if (gitLog.total > 1) {
    title =
      findTitle(gitLog.all.map(c => c.subject)) || current.replace(/-/g, ' ');
    body = gitLog.all
      .reverse()
      .map(c => `* ${c.subject}`)
      .join('\n');
  } else {
    title = stripNLMPrefix(gitLog.latest.subject);
    body = gitLog.latest.body || '';
  }

  body += `\n\n\n---\n_This PR was started by: ${cmdLine(true)}_`;

  const prURL = await ghURL(git, `/compare/${parent}...${remoteBranch}`, {
    expand: 1,
    title,
    body,
  });

  log(`Opening ${prURL}`);

  if (opts.parent.open) await open(prURL);
}

module.exports = {
  action: prAction,
  command(prog, wrapAction) {
    prog
      .command('pr')
      .description('Open a PR to merge current feature branch')
      .action(wrapAction(prAction));
  },
};
