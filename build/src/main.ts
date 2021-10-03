/* eslint-disable @typescript-eslint/no-explicit-any */
import * as core from '@actions/core'
import * as actionExec from '@actions/exec'
import * as github from '@actions/github'
import {join} from 'path'

let silicon = false

async function needsArmFlag(): Promise<boolean> {
  const uname = await actionExec.getExecOutput(`uname`, ['-m'])
  const isArm = uname.stdout === 'arm64'
  let isM1 = false
  try {
    // this command will only succeed on m1 macs.
    await actionExec.exec('arch', ['-arm64', 'echo', 'hi'])
    isM1 = true
  } catch (err) {
    // Must not be an m1 mac
  }
  return isM1 && !isArm
}

async function exec(
  command: string,
  args: string[]
): Promise<actionExec.ExecOutput> {
  if (silicon) {
    args = ['-arm64', command, ...args]
    command = 'arch'
  }

  return await actionExec.getExecOutput(command, args)
}

async function run(): Promise<void> {
  silicon = await needsArmFlag()

  try {
    const PR = core.getInput('PR', {required: true})

    const GH_WORKSPACE = process.env.GITHUB_WORKSPACE as string
    const repository = 'test'

    // let arch = ''

    // if (!silicon) {
    //   arch = 'intel'
    // } else {
    //   arch = 'silicon'
    // }

    const octokit = github.getOctokit(core.getInput('GH_TOKEN'))

    const pull = await octokit.rest.pulls.get({
      owner: 'pakket-project',
      repo: repository,
      pull_number: (PR as unknown) as number
    })

    const branch = pull.data.head.ref

    await exec('git', ['fetch', 'origin', `${branch}:${branch}`])
    await exec('git', ['config', `branch.${branch}.remote`, 'origin'])
    await exec('git', [
      'config',
      `branch.${branch}.merge`,
      `refs/heads/${branch}`
    ])
    await exec('git', ['checkout', branch])
    core.info(`Checked out ${pull.data.head.ref} (PR #${PR})`)

    const {data: files} = await octokit.rest.pulls.listFiles({
      owner: 'pakket-project',
      pull_number: (PR as unknown) as number,
      repo: repository
    })

    let pkg = ''
    let version = ''
    // let checksum = ''

    for (const f of files) {
      const pathRegex = new RegExp(
        /(packages\/)([^/]*)\/([^/]*)\/([^\n]*)/g
      ).exec(f.filename)

      if (pathRegex && pkg === '' && version === '') {
        pkg = pathRegex[2]
        version = pathRegex[3]

        await exec('pakket-builder', [
          'build',
          join(GH_WORKSPACE, 'packages', pkg),
          version,
          '-o',
          join(GH_WORKSPACE, 'temp', `${pkg}-${version}`)
        ])

        // const stdout = output.stdout.split('\n')
        // for (const line of stdout) {
        //   const regex = new RegExp(/checksum: ([A-Fa-f0-9]{64})/g).exec(line)
        //   if (regex) {
        //     checksum = regex[1]
        //   }
        // }
      }
    }
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
