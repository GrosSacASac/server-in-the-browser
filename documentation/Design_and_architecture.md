# Design and architecture

## Status

### Draft


## Defintions

 * p2p = Peer to Peer
 * rtc = real time communication
 * `<iframe>` technique to load a document inside a document. Has border effects.

See also FileSystem.md


## Server in the browser works with at least 2 tabs open


This allows 1 dashboard page to keep rtc peer connections alive while other page in other tabs represent the raw files transferred over p2p, without `<iframe>` or such.

To inform the user about connectivity loss which happen often in p2p application, we use Notification API.


## About the Notification API


The Notification API, enables interaction that are impossible to replicate with just HTML + JS.


 * Display a Notification while no tabs are open  (with service worker)
 * Display a Notification while visiting other sites


https://github.com/Nickersoft/push.js


### Alternatives


Before the Notification API was introduced, to get an user attention, one could


 * Change the title text and icon (favicon) repeatedly with an time interval


## Notification Groups


Notification Groups or Tags are grouped by a shared String. When the user uses the application, two notification from the same group will not stack, but collapse instead;the most young overwites the oldest. Example of end visual result of 3 Notification displayed in a short period:


Without Group:


 * You are Offline !
 * You are Online !
 * You are Offline !


With Group


 * You are Offline !


Groups are usefull to reduce clutter from the interface. Groups used:


 * Online State: onLine
 * Selected Peer State: peerState
 * System status: system
 * Chat: chat
