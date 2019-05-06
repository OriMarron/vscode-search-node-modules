const fs = require('fs');
const util = require('util');
const path = require('path');

const glob = util.promisify(require('glob'));

const exists = util.promisify(fs.exists);
const readFile = util.promisify(fs.readFile);

const LERNA_CONFIG_FILE = 'lerna.json';

const flat = arrays => [].concat.apply([], arrays);

const findModuleDirs = async root => {
    if (await exists(path.join(root, LERNA_CONFIG_FILE))) {
        const data = await readFile(path.join(root, LERNA_CONFIG_FILE));

        const config = JSON.parse(data);
        const packagesConfig = config.packages || [];

        const matches = flat(
            await Promise.all(
                packagesConfig.map(pattern => {
                    if (pattern.includes('**')) return [];
                    return glob(path.join(root, pattern, '/package.json'));
                })
            )
        );

        return [ '', ...matches.map(match => path.relative(root, match)) ];
    }
    return [ '' ];
};

module.exports = { findModuleDirs };
