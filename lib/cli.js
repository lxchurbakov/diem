#!/usr/bin/env node

const path = require('path');
const axios = require('axios');

const { extract } = require('./args');
const { mkdir, writeFile } = require('./utils');

const { args, opts, rest } = extract(process.argv.slice(2));

// Now we proceed to actually run the command
// Our first argument is gonna be the repo

const DEFAULT_CONFIG = {
    files: [],
    entrypoint: 'diem.js',
    installDependencies: false,
};

const makeRepositoryName = (name) => {
    if (name.indexOf('/') === -1) {
        return `${name}/${name}`;
    }

    return name;
};

const checkRepositoryExistance = (repositoryName) => {
    return axios.get(`http://api.github.com/repos/${repositoryName}`).then(({ data }) => !!data).catch(() => false);
};

const mergeConfigs = (...configEntries) => {
    return configEntries.reduce((acc, entry) => {
        return {
            files: [...(acc.files || []), ...(entry.files || [])],
            entrypoint: acc.entrypoint || entry.entrypoint || DEFAULT_CONFIG.entrypoint,
            installDependencies: acc.installDependencies || entry.installDependencies || DEFAULT_CONFIG.installDependencies,
        };
    }, {});
};

const fetchRepositryConfig = async (name, branch) => {
    const diemConfigUrl = `https://raw.githubusercontent.com/${name}/${branch}/.diem.json`;
    const packageJsonUrl = `https://raw.githubusercontent.com/${name}/${branch}/package.json`;

    const configs = await Promise.all([
        axios.get(diemConfigUrl).then(({ data }) => JSON.parse(data)).catch(() => null),
        axios.get(packageJsonUrl).then(({ data }) => JSON.parse(data)).then(({ diem }) => diem).catch(() => null),
    ]);

    return mergeConfigs(...configs.filter(Boolean));
};
    
const generateTemporaryDir = async (seed) => {
    const dirname = `${seed.replaceAll(/[^a-z]/gi, '_')}`;
    const dirpath = path.resolve(process.cwd(), `./tmp/${dirname}`);
    
    await mkdir(dirpath, { recursive: true });

    return dirpath;
};

const downloadFile = (url) => {
    return axios.get(url).then(({ data }) => data);
};

const downloadFiles = async (repositoryName, branch, tmpdir, config) => {
    await Promise.all(config.files.concat([config.entrypoint]).map(async (filename) => {
        const fileUrl = `https://raw.githubusercontent.com/${repositoryName}/${branch}/${filename}`;

        const content = await downloadFile(fileUrl).catch(() => Promise.reject(`Cannot download file ${fileUrl}`));
        const tokens = filename.split('/');

        await mkdir(path.resolve(tmpdir, tokens.slice(0, -1).join('/')), { recursive: true });
        await writeFile(path.resolve(tmpdir, tokens.join('/')), content);
    }));     
};

const installDependencies = async (tmpdir) => {
    await new Promise((resolve, reject) => {
        const childp = require('child_process').exec('npm install', { cwd: tmpdir }, (err) => {
            return err ? reject(err) : resolve();
        });

        childp.stderr.pipe(process.stderr);
    });
};

const extractRunCommand = (config) => {
    return `node ${config.entrypoint}`;
};

const figureOutDefaultBranch = async (repositoryName) => {
    return await axios.get(`http://api.github.com/repos/${repositoryName}`).then(({ data }) => data.default_branch);
};

// Here comes the main async function
// that uses all these helpers listed
// above and fetches / runs stuff

;(async () => {
    const repositoryName = makeRepositoryName(args[0]);

    process.stdout.write(`📣 Diem to ${repositoryName} ...`);

    const doesRepositoryExist = await checkRepositoryExistance(repositoryName);

    if (!doesRepositoryExist) {
        throw new Error(`Looks like ${repositoryName} does not exist`);
    }

    const branch = opts.branch || await figureOutDefaultBranch(repositoryName);

    process.stdout.clearLine(); 
    process.stdout.cursorTo(0);
    process.stdout.write(`🛠️  Fetching the config ...`);

    const diemConfig = mergeConfigs(
        await fetchRepositryConfig(repositoryName, branch),
        // here we will merge parameters from opts
    );
    
    process.stdout.clearLine(); 
    process.stdout.cursorTo(0);
    process.stdout.write(`📦 Downloading files ...`);

    const tmpdir = await generateTemporaryDir(repositoryName);
    
    await downloadFiles(repositoryName, branch, tmpdir, diemConfig);

    if (diemConfig.installDependencies) {
        // Finally run the code
        process.stdout.clearLine(); 
        process.stdout.cursorTo(0);
        process.stdout.write(`🗄 Installing dependencies ... \n\n`);
        process.stdout.write(`> npm install \n\n`);
        
        await installDependencies(tmpdir);

        process.stdout.moveCursor(0, -4);
    }

    const command = extractRunCommand(diemConfig);

    // Finally run the code
    process.stdout.clearLine(); 
    process.stdout.cursorTo(0);
    process.stdout.write(`🚀 Launching the script ... \n\n`);
    process.stdout.write(`> ${command} \n\n`);

    await new Promise((resolve, reject) => {
        const childp = require('child_process').exec(command + ' ' + rest.join((' ')), { cwd: tmpdir }, (err) => {
            return err ? reject(err) : resolve();
        });

        childp.stdout.pipe(process.stdout);
        childp.stderr.pipe(process.stderr);
    });
  
    process.stdout.write(`\n\n👌 Diem complete \n`);
})().catch((err) => {
    process.stdout.write(`❌ ${err.toString()}`);
    process.exit(-1);
});