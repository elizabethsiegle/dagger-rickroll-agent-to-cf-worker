# Dagger URL Slug Agent

A Dagger-powered agent that takes in a query string that a user wants to generate a podcast about and generates URL slugs to attach to a base Cloudflare Worker URL pretending to be linking to a podcast about the user input. The Worker URL, when clicked, actually rickrolls the user.

The [Cloudflare Worker code is here on GitHub](https://github.com/elizabethsiegle/rickroll-worker).

## Tools
- generatePodcast
- get-previous-podcasts 
- search-podcasts

## Features

- Generate URL-safe slugs from text input
- Create a podcast URL with unique slugs
- Generate LLM responses for input queries
- Saves + queries + searches user queries + generated URLs + times to [Cloudflare D1 database](https://developers.cloudflare.com/d1/) 

## Requirements
- Dagger SDK
- Node.js/TypeScript environment
- Cloudflare Workers URL to generate the podcast at + add slug to

Run on the command line by initially running 
`dagger` followed by the following with [Secret arguments](https://docs.dagger.io/api/arguments#secret-arguments)
```bash
generatePodcast {query}
--cloudflare-account-id=env://CLOUDFLARE_ACCOUNT_ID \
--cloudflare-database-id=env://CLOUDFLARE_D1_DATABASE_ID \
--cloudflare-api-token=env://CLOUDFLARE_API_TOKEN
```
To search previous podcasts generated, you can pass in `--limit={number to search}` or the default is 10 and run
```bash
get-previous-podcasts --cloudflare-account-id=env://CLOUDFLARE_ACCOUNT_ID \
--cloudflare-database-id=env://CLOUDFLARE_D1_DATABASE_ID \
--cloudflare-api-token=env://CLOUDFLARE_API_TOKEN
```

To search for a topic, run
```bash
search-podcasts {query} --cloudflare-account-id=env://CLOUDFLARE_ACCOUNT_ID \
--cloudflare-database-id=env://CLOUDFLARE_D1_DATABASE_ID \
--cloudflare-api-token=env://CLOUDFLARE_API_TOKEN
```