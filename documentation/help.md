# Help

## How to share (static) files ?

 1. Open the Server panel
 2. Click the "Load from file" Button.
 3. Select the files you want to share. Multiselection is enabled. A zip file will be opened in the process.
 4. Go to step 2 if you want to share more files
 5. Click "Generate Index"
 6. Enable "Make local server available"

## How to view shared files from others ?

 1. Open the Connection panel
 2. Select a connected user in the list. Click "Connect and select" or "Select"
 3. Click the "Visit selected index" link if it appears
 4. If it does not appear, it means the selected user does not share files yet. Go to step 2 to select another connected user.
 5. Click on a filename to view it


## How to host a static website ?

 1. Also See "How to share (static) files ?"
 2. Load all necessary files for your website
 3. Do not generate an index file. Instead make sure your entry point html file is named "index.html"
 4. If your static website is dependent to a certain folder structure, you need to put everything into a .zip file an upload this zip file instead
 5. Enable "Make local server available"


## How to host a dynamic website ?


Server in the browser runs a handported Nodejs environment, the port is not finished yet. Only small parts of express, http and body-parser have been ported. Download /example.zip to see an example. In your package.json make the following change:


Add a new key-value pair as follow, where "index.js" is the entry point of your app. This will do the equivalent of `node index.js` in the command line.


    "serverinthebrowser" : {
        "server": "index.js"
    }


### package.json Example:


    {
      "name": "NAME",
      "author": "AUTHOR",
      "version": "1.0.0",
      "main": "index.js",
      "serverinthebrowser" : {
        "server": "index.js"
      }
    }


Alternatively, it is also possible to manually copy paste the server program in the textarea.


 1. Put your dynamic website inside a single .zip and load it.
 2. Enable "Make local server available"
 3. Enable "Use a node.js program to handle requests"
 4. Look if there are error reports on the screen
 5. To update individual files, reupload a new entire zip.


## How to change name ?


Open the setting Panel, and make a request to change name.


## How to delete all data and exit ?

Open the setting Panel, and click "Delete all data and quit". Then close every tab related to Server in the browser.


## How to report an issue ?

To report an issue , [it is over here](https://github.com/GrosSacASac/server-in-the-browser/issues).
