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
 * Test size of album art image when above twitter threshold (5MB). Refetch smaller image file for covers. Currently the media is abandoned and the post is made without an image attached.
