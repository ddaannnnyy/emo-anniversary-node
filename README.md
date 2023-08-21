# emo-anniversary-node

A node rewrite of twitter.com/emoanniversary

## Endpoints needed:

- MusicBrainz
  - ReleaseGroups
  - Artists
- Cover Archive
  - ReleaseGroups
- Twitter
  - Update PFP
  - Attach Media
  - Send Tweet

## TODO

- Write in an email notification of albums and images that have been collected to make it easier to debug problem days vs 0 release days.
- Rewrite this, maybe in TS. There are a lot of nested ifs and the async handling is gross as I was learning how promises and async/await works.
