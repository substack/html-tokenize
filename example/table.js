var fs = require('fs');
var tokenize = require('../');

fs.createReadStream(__dirname + '/table.html')
    .pipe(tokenize())
    .pipe(through2.obj(function (row, enc, next) {
        console.log(row);
        next();
    }))
;
