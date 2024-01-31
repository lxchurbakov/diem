const fs = require('fs');

const promisify = (predicate) => 
    (...args) => 
        new Promise((resolve, reject) => 
            predicate(...args, (err, data) => err ? reject(err) : resolve(data)));

const mkdir = promisify(fs.mkdir.bind(fs));
const writeFile = promisify(fs.writeFile.bind(fs));

module.exports = { promisify, mkdir, writeFile };
