# File upload system


## File stored on disk and in RAM


### Defintions


Disk storage here is used as a general term for all kind of storage with a long lifecycle. The memory is not cleared when power is shut down. Examples: SSD, USB, hard disk, CD etc.

The RAM here is used as a general term for short term memory, that is used to store variables in computer programs.


### Action for Uploading files Button in this software


Loading is more correct term. Algorithm:

 * Display a progress bar to give user feedback
 * For each file name
    * Check if a fileName with a similar name is already loaded
        * If yes prompt pause and ask the user
            * Overwrite the old fileName
                * and do the same for all the others not yet implemented
            * Do not overwrite the old fileName
            * Overwrite only this one not yet implemented
            * Ignore this new file and continue not yet implemented
            * Cancel everything not yet implemented
    * Load the file content, its file name and other interesting attributes (such as MIME-type) in the memory of the sofware.
 * For each file name
    * Check if the fileName is "package.json"
        * ...
    * Check if it is a zip file
        * ...
 * Display finished


Not yet implemented

## See also

uiFiles.js
