import { difference, isEmpty } from 'lodash';

import { IConfig, IMigration } from '../interfaces';

export function validateConfig(config?: IConfig) {
    if (!config) {
        throw new Error('config object shoud be provided');
    }
    if (isEmpty(config.connection)) {
        throw new Error('connection object should contain host and masterKey values');
    }
    if (isEmpty(config.connection.host)) {
        throw new Error('connection object should contain host and masterKey values');
    }
    if (isEmpty(config.connection.masterKey)) {
        throw new Error('connection object should contain host and masterKey values');
    }
}

// Validates that migrations are present in the appropriate directories.
export function validateMigrationList(all: string[], completed: string[]) {
    const diff = difference(completed, all);
    if (!isEmpty(diff)) {
      throw new Error(
        `The migration directory is corrupt, the following files are missing: ${diff.join(', ')}`,
      );
    }
}

// Validates some migrations by requiring and checking for an `up` and `down`
// function.
export function validateMigrationStructure(migration: IMigration) {
    if (typeof migration.migration.body !== 'function') {
        throw new Error(`Invalid migration: ${migration.name} must have 'body' function`);
    }
    if (!migration.migration.id) {
        throw new Error(`Invalid migration: ${migration.name} must have 'id' specified`);
    }
    if (!migration.migration.collection) {
        throw new Error(`Invalid migration: ${migration.name} must have 'collection' specified`);
    }
    if (!migration.migration.database) {
        throw new Error(`Invalid migration: ${migration.name} must have 'database' specified`);
    }
    return migration.name;
}
