import * as program from 'commander';

import Migrator from './migrator';
import { loadConfig } from './helpers/config-reader';

let promise = null;

program
    .version('1.0.0')
    .description('Cosmosdb Migration Tool')
    .option('-c, --config <config_file>', 'Add config path');

program
    .command('init')
    .description('create basic config file')
    .action(() => {
        promise = Migrator.init().then(() => 'configuration file "migrate_config.js" was created');

        // migrator.init();
    });

program
    .command('migrate:create <name>')
    .description('create new migrate file')
    .action((name) => {
        const config = loadConfig(program.config);
        const migrator = new Migrator(config);

        promise = migrator.make(name);
    });

program
    .command('migrate:latest')
    .description('run migrations')
    .action(() => {
        const config = loadConfig(program.config);
        const migrator = new Migrator(config);

        promise = migrator.latest().then((log) => {
            if (log && log.length === 0) {
                return 'Already up to date';
            }
        });
    });

program.parse(process.argv);

if (promise == null) {
    program.help();
    process.exit(0);
} else {
    Promise.resolve(promise).then((response) => {
        console.log(response);
    }).catch((err) => {
        console.error(err);
    })
}
