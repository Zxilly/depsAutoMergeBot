import {Probot} from "probot";
import type {ProbotOctokit} from "probot/lib/octokit/probot-octokit";

const mergeAllinRepo = async (octokit: InstanceType<typeof ProbotOctokit>, log: (msg: string) => void, owner: string, repo: string) => {
    const prs = await octokit.pulls.list({
        owner,
        repo,
        state: "open",
        per_page: 100,
    })

    log(`Found ${prs.data.length} pull requests for ${owner}/${repo}`);

    for (const lpr of prs.data) {
        const pr = await octokit.pulls.get({
            owner,
            repo,
            pull_number: lpr.number,
        })

        const data = pr.data;
        if (data.state !== "open") {
            log(`Pull request ${data.number} is not open`);
            continue;
        }

        if (data.merged) {
            log(`Pull request ${data.number} is already merged`);
            continue;
        }

        if (data.draft) {
            log(`Pull request ${data.number} is a draft`);
            continue;
        }

        if (!data.rebaseable) {
            log(`Pull request ${data.number} is not rebaseable`);
            continue;
        }

        if (!data.user) {
            log(`Pull request ${data.number} has no user`);
            continue;
        }

        if (data.user.login !== "dependabot[bot]") {
            log(`Pull request ${data.number} is not from dependabot`);
            continue;
        }

        const check_suite = await octokit.checks.listSuitesForRef({
            owner,
            repo,
            ref: data.head.ref,
        })

        if (!(check_suite.data.total_count === 1)) {
            log(`Check suite ${data.number} more than one check suite or no check suite`);
            continue;
        }

        const check_suite_data = check_suite.data.check_suites[0];

        if (!(check_suite_data.conclusion === "success")) {
            log(`Check suite ${data.number} is not successful`);
            continue;
        }

        await octokit.pulls.merge({
            owner,
            repo,
            pull_number: data.number,
            merge_method: "rebase",
        })

        log(`Pull request ${data.number} rebased`);
    }
}

export = (app: Probot) => {
    app.on("installation_repositories.added", async (context) => {
        const repos = context.payload.repositories_added;

        for (const repo of repos) {
            await mergeAllinRepo(
                context.octokit,
                context.log.info,
                context.payload.installation.account.login,
                repo.name,
            )
        }
    })

    app.on("installation.created", async (context) => {
        const repos = context.payload.repositories;

        if (!repos) {
            context.log.info(`No repositories found for installation ${context.payload.installation.id}`);
            return;
        }

        for (const repo of repos) {
            await mergeAllinRepo(
                context.octokit,
                context.log.info,
                context.payload.installation.account.login,
                repo.name,
            )
        }
    })

    app.on("check_suite.completed", async (context) => {
        const check_suite = context.payload.check_suite;

        if (!(check_suite.conclusion === "success")) {
            context.log.info(`Check suite ${check_suite.id} is not successful`);
            return;
        }

        const pullRequests = check_suite.pull_requests;

        if (pullRequests.length === 0) {
            context.log.info(`No pull requests found for check suite ${check_suite.id}`);
            return;
        }

        for (const cpr of pullRequests) {
            const pr = await context.octokit.pulls.get(
                context.repo({
                    pull_number: cpr.number,
                })
            )
            const data = pr.data;

            const prString = `${context.repo().owner}/${context.repo().repo}/${data.number}`;

            if (data.state !== "open") {
                context.log.info(`Pull request ${prString} is not open`);
                continue;
            }

            if (data.merged) {
                context.log.info(`Pull request ${prString} is already merged`);
                continue;
            }

            if (data.draft) {
                context.log.info(`Pull request ${prString} is a draft`);
                continue;
            }

            if (!data.rebaseable) {
                context.log.info(`Pull request ${prString} is not rebaseable`);
                continue;
            }

            if (!data.user) {
                context.log.info(`Pull request ${prString} has no user`);
                continue;
            }

            if (data.user.login !== "dependabot[bot]") {
                context.log.info(`Pull request ${prString} is not from dependabot`);
                continue;
            }

            await context.octokit.pulls.merge(context.repo({
                pull_number: data.number,
                merge_method: "rebase",
            }))

            context.log.info(`Pull request ${prString} rebased`);
        }
    });
};
