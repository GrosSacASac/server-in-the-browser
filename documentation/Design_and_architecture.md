#Design and architecture

##Status

###Draft


##Defintions

 * p2p = Peer to Peer
 * rtc = real time communication
 * `<iframe>` technique to load a document inside a document. Has border effects.
 
See also FileSystem.md


##Server in the browser works with at least 2 tabs open


This allows 1 dashboard page to keep rtc peer connections alive while other page in other tabs represent the raw files transferred over p2p, without `<iframe>` or such.

To inform the user about connectivity loss which happen often in p2p application, we use Notification API.

