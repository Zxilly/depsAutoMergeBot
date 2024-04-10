# autoMergeBot

> A GitHub App built with [Probot](https://github.com/probot/probot) that Auto merge PRs if it is possible

## Setup

```sh
# Install dependencies
pnpm install

# Run the bot
pnpm start
```

## Deploy

When deploying the app to vercel, add an environment variable `NODEJS_HELPERS` with the value 0 to disable the pre parsing of the request body, which leads to a failed signature verification.

## Contributing

If you have suggestions for how autoMergeBot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2023 Zxilly
