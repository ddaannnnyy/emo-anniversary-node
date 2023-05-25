# emo-anniversary-node
A node rewrite of twitter.com/emoanniversary

## Endpoints needed: 
* MusicBrainz
    * ReleaseGroups
    * Artists
* Cover Archive
    * ReleaseGroups
* Twitter
    * Update PFP
    * Attach Media
    * Send Tweet

## TODO
 * Re-link twitter accounts for accounts that are listed in MusicBrainz.
 * Test size of album art image when above twitter threshold (5MB). Refetch smaller image file for covers. Currently the media is abandoned and the post is made without an image attached.
 * Write in an email notification of albums and images that have been collected to make it easier to debug problem days vs 0 release days.
 * Maybe link the album in a threaded tweet, this might need a refactor.
