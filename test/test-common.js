'use strict';

const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const debug = require('debug')('workflow:test');
const simpleGit = require('simple-git/promise');
const mktemp = require('mktemp');

const writeFileAsync = promisify(require('fs').writeFile);
const rimrafAsync = promisify(require('rimraf'));

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
  await git.init(true);
  return [dir, git];
}

async function setupLocalDir(ghDir) {
  const dir = await mktemp.createDir(
    path.join(tmpDir, 'feature-test-local-XXXXXXX')
  );
  const git = simpleGit(dir).silent(true);
  await git.clone(ghDir, dir);
  await changeSomething(dir);
  await git.add(['.']);
  await git.commit('init');
  await git.push();
  return [dir, git];
}

async function setupLocalDir2(ghDir) {
  const dir = await mktemp.createDir(
    path.join(tmpDir, 'feature-test-local2-XXXXXXX')
  );
  const git = simpleGit(dir).silent(true);
  await git.clone(ghDir, dir);
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

function addHooks() {
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

  beforeEach('setup git dir', async () => {
    savedUser = process.env.USER;
    process.env.USER = FAKE_USER;
    [t.ghDir, t.ghGit] = await setupGitHubDir();
    [t.localDir, t.git] = await setupLocalDir(t.ghDir);
    [t.localDir2, t.git2] = await setupLocalDir2(t.ghDir);
    [t.forkDir, t.gitFork] = await setupForkDir(t.ghDir);
    t.logged = '';
  });

  afterEach(() => {
    process.env.USER = savedUser;
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
