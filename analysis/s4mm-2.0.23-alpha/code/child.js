console.log('In Child.js')

// If the send method is available
if (process.send) {

    // Send Hello
    process.send("Hello, this is child process.");
}