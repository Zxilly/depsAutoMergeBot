import {Probot} from "probot";
import type {ProbotOctokit} from "probot/lib/octokit/probot-octokit";

const acceptableConclusions = function (cr: { conclusion: string | null; }) {
    return cr.conclusion === "success" || cr.conclusion === "skipped";
}

const mergePR = async (octokit: InstanceType<typeof ProbotOctokit>, log: (msg: string) => void, owner: string, repo: string, pr: number) => {
    const pull = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pr,
    })

    const data = pull.data;
    if (data.state !== "open") {
        log(`Pull request ${data.number} is not open`);
        return;
    }

    if (data.merged) {
        log(`Pull request ${data.number} is already merged`);
        return;
    }

    if (data.draft) {
        log(`Pull request ${data.number} is a draft`);
        return;
    }

    if (!data.rebaseable) {
        log(`Pull request ${data.number} is not rebaseable`);
        return;
    }

    if (!data.user) {
        log(`Pull request ${data.number} has no user`);
        return;
    }

    if (data.user.login !== "dependabot[bot]") {
        log(`Pull request ${data.number} is not from dependabot`);
        return;
    }

    const check_runs = await octokit.checks.listForRef({
        owner,
        repo,
        ref: data.head.ref,
    })

    if (check_runs.data.total_count === 0) {
        log(`No check runs found for pull request ${data.number}`);
        return;
    }

    if (!check_runs.data.check_runs.every((cr) => acceptableConclusions(cr))) {
        for (const cr of check_runs.data.check_runs) {
            if (!acceptableConclusions(cr)) {
                log(`Check run ${cr.id} is not successful, ${cr.conclusion}`);
                log(`Check run ${cr.id} has status ${cr.status}`);
                log(`Check run ${cr.id} has url ${cr.url}`);
            }
        }
        return;
    }

    await octokit.pulls.merge({
        owner,
        repo,
        pull_number: data.number,
        merge_method: "rebase",
    })

    log(`Pull request ${data.number} rebased`);
}

const mergeAllPRinRepo = async (octokit: InstanceType<typeof ProbotOctokit>, log: (msg: string) => void, owner: string, repo: string) => {
    const prs = await octokit.pulls.list({
        owner,
        repo,
        state: "open",
        per_page: 100,
    })

    log(`Found ${prs.data.length} pull requests for ${owner}/${repo}`);

    for (const lpr of prs.data) {
        await mergePR(octokit, log, owner, repo, lpr.number);
    }
}

export = (app: Probot) => {
    app.onAny(async (context) => {
        console.log(`Event ${context.name} received`);
    })

    app.on("installation_repositories.added", async (context) => {
        context.log.info(`Installation ${context.payload.installation.id} added repositories`);

        const repos = context.payload.repositories_added;

        for (const repo of repos) {
            await mergeAllPRinRepo(
                context.octokit,
                context.log.info,
                context.payload.installation.account.login,
                repo.name,
            )
        }
    })

    app.on("installation.created", async (context) => {
        context.log.info(`Installation ${context.payload.installation.id} created`);

        const repos = context.payload.repositories;

        if (!repos) {
            context.log.info(`No repositories found for installation ${context.payload.installation.id}`);
            return;
        }

        for (const repo of repos) {
            await mergeAllPRinRepo(
                context.octokit,
                context.log.info,
                context.payload.installation.account.login,
                repo.name,
            )
        }

        context.log.info(`Finished merging all pull requests for installation ${context.payload.installation.id}`);
    })

    app.on("check_run.completed", async (context) => {
        context.log.info(`Check run ${context.payload.check_run.id} completed`);

        const check_run = context.payload.check_run;
        const cprs = check_run.pull_requests;

        if (cprs.length === 0) {
            context.log.info(`No pull requests found for check run ${context.payload.check_run.id}`);
            return;
        }

        if (!acceptableConclusions(check_run)) {
            context.log.info(`Check run ${context.payload.check_run.id} is not successful, ${check_run.conclusion}`);
            return;
        }

        for (const cpr of cprs) {
            await mergePR(
                context.octokit,
                context.log.info,
                context.payload.repository.owner.login,
                context.payload.repository.name,
                cpr.number,
            )
        }
    })
};
