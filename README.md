# Zxilly Bot

> A GitHub App built with [Probot](https://github.com/probot/probot) that manage Zxilly's GitHub repos.

## Setup

```sh
# Install dependencies
pnpm install

# Run the bot
pnpm start
```

## Deploy

When deploying the app to vercel, add an environment variable `NODEJS_HELPERS` with the value 0 to disable the pre parsing of the request body, which leads to a failed signature verification.

## License

[MIT](LICENSE) © 2024 Zxilly
