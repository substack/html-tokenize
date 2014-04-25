var fs = require('fs');
var tokenize = require('../');
var through = require('through2');

fs.createReadStream(__dirname + '/table.html')
    .pipe(tokenize())
    .pipe(through.obj(function (row, enc, next) {
        console.log(row);
        next();
    }))
;
