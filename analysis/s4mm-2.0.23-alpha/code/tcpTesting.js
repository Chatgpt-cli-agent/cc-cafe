var path = require('path');
var express = require('express');
var app = express();
var cors = require('cors');
var isMac = process.platform === "darwin";

console.log("Preparing Server");

var dir = "C:\\Users\\Xeon\\Documents\\Sims 4 Mod Manager Data\\images";
if(isMac) dir = "/Users/Fabian/Documents/Sims 4 Mod Manager Data/images";

app.use(express.static(dir));
app.use(cors())

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    //res.header('Access-Control-Allow-Headers', 'Content-Type');
    console.log("OK");
   next();
});

app.listen(3000, function () {
    console.log('Listening on http://localhost:3000/');
});

app.get('/', (req, res) => {
    console.log(req.query);
    //console.log(req);
    res.send({"test":"ICH BIN JSON"});
});

