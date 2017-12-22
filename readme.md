# Server in the browser

## Why


Setting up a server against the Internet to run a dynamic web app requires dedicated time investment, with upfront limitations that can go away with money. It can take even more time for beginners. With server in the browser it is possible to run ephemeral application without the cost and hassle of a traditional server. New services appeared lately to tackle those issues in different shapes and forms. Here's one more attempt as many new browser APIs are available now, it was time to explore the possibilities. 

Also, this is a first prototype to explore new forms of decentralized web. Imagine if everyone had it's own personal data locally and external services must ask for it. The owner controls who has access and who has not. Server in the browser is a first step for everyone to claim its data back under control.

## What 

Server in the browser is a dynamic site that allows users to serve their own dynamic site without hassle. The request are then sent from the visitors client directly to the users computer. Users have full control over the response sent to the visitors. Anyone can visit Server in the browser to display a list of available user made dynamic site. It is also possible to chat with other people connected to the site. Serving a static site requires zero configuration, only selection of files.


## How

Server in the browser establishes a two way connection between the user and the server. That connection is then used to update in real time the list of available user made dynamic sites. To serve you own, the system will first display you on the list. Another user may send you a direct request for your site with a peer to peer connection. The connection kept with the central server is used to make the connection between peers happen. Once the request arrives at the user that own the site, the request gets through a customizable function that will answer with a response. A logical component in the visitors browser is then used to let the visitor see the site as if it came from a traditional server without interfering iframes, or other obtrusive techniques.



## Limitations

Node.js is not fully supported. Many of the limitation come from all the double edged swords that are also the strengths of this system. Users are serving, and accessing each others sites, with no control and no limits on what, how and how much. The central server is unaware of what is being proposed and therefore cannot prevent some missuses. A golden rule of security is : Don't trust what is outside of control. This rule is straight up ignored by the system design itself. The project is young and may change alot in the near future.


## Delete informations

Nothing is stored after the session on our side. Locally service workers and local storage is used. Empty those to delete the local informations.


## Future

Custom distributed computing framework with the same model, as worker, trust under mutual suspicion. Streaming, push , http2 alignement, reserve user name, better ui and more




## Status

PAUSED

alpha version. Some bugs need to be fixed. The design and usage flow may change.


## Try


try it out locally:


 * download this repository
 * install node.js from http://nodejs.org/ **version 7** or higher
 * open the node command line interface, go in the correct directory
 * `npm install`
 * `npm run start`
 * open the local host address in 2 different browser context
 * http://localhost:8080/


## HTTPS


The app must be served over https. The server.js is meant for a heroku like environment where https is handled outside the node.js code


## Build from source


The last build result is included for convenience.

 
### only required once:


 * `npm install`
 * `npm install concat-file-array-cli@0.0.2 -g`
 * `npm install browserify@13.0.1 -g`


### build everything 


 * `npm run buildall`
 

### build specific files


 * `npm run buildjs`
 * `npm run buildcss`
 * `npm run buildhtml`
 * `npm run builddoc`


## Tests


Launch `client/js/tests/SpecRunner.html`


## Dependencies


[open_source](client/html/built/open_source.min.html)

also see [package.json](./package.json)


## License


[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/legalcode)


### Warning


Some dependencies inlcuded in this project have other licenses !


## Contribute


### Help 

See [todo](documentation/todo.txt) to see next steps. Before doing anything please consider [discussing with us](https://dystroy.org/miaou/3) (free Github account is required), the what, why and how. 


### Report issue

To report an issue , [it is over here](https://github.com/GrosSacASac/server-in-the-browser/issues).


### Coding Style


JSLint is used. The filename should have an almost identical name to the single variable that is exported. Example `bytes.js` exports `bytes`. Preference for declarative looking code over imperative, using lot of functions named to describing what is happening.


#### Skeleton for a js file:



    /*FILENAME*/
    /*Important comments about the file, design decision, todos, etc*/
    /*jslint directives*/
    1-2 empty line, then the code
    variableExported = assignemnt using the facade pattern
    ...
    1empy line at the end


## Links

https://www.w3.org/TR/webrtc/


## History

 * December 2016
     * Publish github
