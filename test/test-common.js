'use strict';

const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const debug = require('debug')('workflow:test');
const simpleGit = require('simple-git/promise');
const mktemp = require('mktemp');

const writeFileAsync = promisify(require('fs').writeFile);
const rimrafAsync = promisify(require('rimraf'));

/**
 * @typedef {import('../lib/typedefs.d.ts').MainBranch} MainBranch
 */

const tmpDir = process.env.TMPDIR || '/tmp';

const FAKE_USER = 'jdoe';

function changeSomething(dir, file) {
  if (!file) file = 'README';
  debug('modify', file);
  return writeFileAsync(path.join(dir, file), Math.random().toString(), {
    encoding: 'utf8',
  });
}

async function setupGitHubDir() {
  const dir = await mktemp.createDir(
    path.join(tmpDir, 'feature-test-gh-XXXXXXX')
  );
  const git = simpleGit(dir).silent(true);
  // master to make legacy tests work; we'll switch it to default-to-main later
  // raw b/c simple-git 1.x .init() doesn't support extra args
  await git.raw(['init', '--bare', '--initial-branch=master']);
  return [dir, git];
}

async function setupLocalDir(ghDir, ghGit, main) {
  const dir = await mktemp.createDir(
    path.join(tmpDir, 'feature-test-local-XXXXXXX')
  );
  const git = simpleGit(dir).silent(true);
  await git.clone(ghDir, dir);
  await git.addConfig('user.name', 'Tester');
  await git.addConfig('user.email', 'test@example.com');
  await changeSomething(dir);
  await git.add(['.']);
  await git.commit('init');
  await git.push();

  if (main !== 'master') {
    await ghGit.branch(['-m', 'master', main]);
    await git.branch(['-m', 'master', main]);
    await git.push(['-u', 'origin', `${main}:${main}`]);
  }

  return [dir, git];
}

async function setupLocalDir2(ghDir) {
  const dir = await mktemp.createDir(
    path.join(tmpDir, 'feature-test-local2-XXXXXXX')
  );
  const git = simpleGit(dir).silent(true);
  await git.clone(ghDir, dir);
  await git.addConfig('user.name', 'Tester');
  await git.addConfig('user.email', 'test@example.com');
  return [dir, git];
}

async function setupForkDir(ghDir) {
  const dir = await mktemp.createDir(
    path.join(tmpDir, 'feature-test-local-XXXXXXX')
  );
  const git = simpleGit(dir);
  await git.clone(ghDir, dir);
  await git.addRemote('fork', ghDir);
  return [dir, git];
}

// can't use promisify because it throws away the other callback args if there's
// an error

function wfCLI(dir, args) {
  return new Promise((resolve, reject) => {
    execFile(
      path.join(__dirname, '..', 'cli.js'),
      [].slice.call(args),
      { cwd: dir },
      (err, stdout, stderr) => {
        if (process.env.DEBUG) {
          process.stdout.write(stdout);
          process.stderr.write(stderr);
        }
        if (err) reject(err);
        else resolve([stdout, stderr]);
      }
    );
  });
}

/**
 * TODO: have this default to main, once there's time to rewrite all the tests
 * @param {MainBranch} [main]
 */
function addHooks(main = 'master') {
  const t = {
    changeSomething(file) {
      return changeSomething(t.localDir, file);
    },
    changeSomething2(file) {
      return changeSomething(t.localDir2, file);
    },
    changeSomethingFork(file) {
      return changeSomething(t.forkDir, file);
    },
    cli() {
      return wfCLI(t.localDir, arguments);
    },
    logged: '',
    user: FAKE_USER,
    log(msg) {
      t.logged += `${msg}\n`;
    },
  };

  let savedUser;
  let savedDir;

  beforeEach('setup git dir', async () => {
    savedUser = process.env.USER;
    savedDir = process.cwd();
    process.env.USER = FAKE_USER;
    [t.ghDir, t.ghGit] = await setupGitHubDir();
    [t.localDir, t.git] = await setupLocalDir(t.ghDir, t.ghGit, main);
    [t.localDir2, t.git2] = await setupLocalDir2(t.ghDir);
    [t.forkDir, t.gitFork] = await setupForkDir(t.ghDir);
    t.logged = '';
    process.chdir(t.localDir);
  });

  afterEach(() => {
    process.env.USER = savedUser;
    process.chdir(savedDir);
    delete t.forceBool;
    return Promise.all(
      [t.ghDir, t.localDir, t.localDir2, t.forkDir].map(dir =>
        rimrafAsync(dir, { disableGlob: true })
      )
    );
  });

  return t;
}
module.exports = addHooks;
