const flatten = (c) => c.reduce((acc, group) => acc.concat(group), []);

const isOption = (raw) => raw.startsWith('-');
const getOptionName = (raw) => raw.startsWith('--') ? raw.substr(2) : raw.substr(1);

const prepare = (argv) => {
    return flatten(
        argv.map((arg) => {
            // -pXXXXX or -p=XXXX
            if (arg[0] === '-' && arg[1] !== '-' && arg.length > 2) {
                if (arg[2] === '=') {
                    return [arg.substr(0, 2), arg.substr(3)];
                } else {
                    return [arg.substr(0, 2), arg.substr(2)];
                }
            }

            // --value=10
            // if (arg.startsWith('--') && arg.indexOf('=') {
            //     return 
            //     // if (arg[2] === '=') {
            //     //     return [arg.substr(0, 2), arg.substr(3)];
            //     // } else {
            //     //     return [arg.substr(0, 2), arg.substr(2)];
            //     // }
            // }

            return [arg];
        })
    );
};

const parse = (argv) => {
    let args = [];
    let opts = {};
    let rest = [];

    let optionName = null;

    for (let index = 0; index < argv.length; ++index) {
        const raw = argv[index];

        if (raw === '--') {
            if (optionName !== null) {
                opts[optionName] = true;
            }

            rest = argv.slice(index + 1);
            break;
        }

        if (isOption(raw)) {
            if (optionName !== null) {
                opts[optionName] = true;
            }

            optionName = getOptionName(raw);
            continue;
        }

        if (optionName !== null) {
            opts[optionName] = raw;
            optionName = null;
            continue;
        }

        args.push(raw);
    }

    return { args, opts, rest };
};

const extract = (argv) => parse(prepare(argv));

module.exports = { extract };
