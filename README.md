# Dagger URL Slug Agent

A Dagger-powered agent that takes in a query string that a user wants to generate a podcast about and generates URL slugs to attach to a base Cloudflare Worker URL pretending to be linking to a podcast about the user input. The Worker URL, when clicked, actually rickrolls the user.

## Features

- Generate URL-safe slugs from text input
- Create a podcast URL with unique slugs
- Generate LLM responses for input queries

## Requirements
- Dagger SDK
- Node.js/TypeScript environment
- Cloudflare Workers for linked website 

Run on the command line by initially running 
`dagger` followed by the following with [Secret arguments](https://docs.dagger.io/api/arguments#secret-arguments)
```bash
generatePodcast   
--cloudflare-account-id=env://CLOUDFLARE_ACCOUNT_ID \
  --cloudflare-database-id=env://CLOUDFLARE_D1_DATABASE_ID \
  --cloudflare-api-token=env://CLOUDFLARE_API_TOKEN
  ```
