const fs = require('fs');
const util = require('util');
const path = require('path');

const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

const isDir = async dir => stat(dir).then(s => s.isDirectory());

const findModuleDirs = async root => {
    const ret = [];

    const recurse = async dir => {
        const list = await readdir(dir);

        if (list.includes('package.json') && list.includes('node_modules')) {
            ret.push(path.relative(root, dir));
        }

        return Promise.all(
            list.map(async item => {
                if (item === 'node_modules') {
                    return;
                }
                const itemPath = path.join(dir, item);
                if (await isDir(itemPath)) {
                    return recurse(path.join(dir, item));
                }
            })
        );
    };

    await recurse(root);
    return ret;
};

module.exports = { findModuleDirs };
