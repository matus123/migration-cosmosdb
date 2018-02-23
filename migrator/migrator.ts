import * as debug from 'debug';
import { DocumentClient } from 'documentdb';
import * as fs from 'fs-extra';
import {
    assign, difference, filter, includes,
    isArray, isFunction, isUndefined, map, max, template, TemplateExecutor,
} from 'lodash';
import * as path from 'path';

import { validateConfig, validateMigrationList, validateMigrationStructure } from '../helpers/validators';
import { IConfig, IMigration, IMigrationDocument, IMigrationFile, MigrationType } from '../interfaces';
import { yyyymmddhhmmss } from './utils';

import Commander from './commander';

import CONSTANTS from './constants';

const dlog = debug('migration:migrator');

const CONFIG_DEFAULT: IConfig = {
    connection: {
        host: '',
        masterKey: '',
    },
    directory: './migrations',
    extension: 'js',
    loadExtensions: ['.js', '.ts'],
    database: 'migrations',
    collection: 'migrations',
};

export default class Migrator {

    public static async init() {
        const stubFile = await fs.readFile('./stub/config.stub');

        await fs.writeFile('./migrate_config.js', stubFile);

        return;
    }

    private commander: Commander;
    private client: DocumentClient;
    private config: IConfig;
    private links: {
        migrationLink: string;
        migretionLockLink: string;
    };

    constructor(config?: IConfig) {
        validateConfig(config);

        this.config = this.setConfig(config);

        this.client = new DocumentClient(this.config.connection.host, { masterKey: this.config.connection.masterKey });

        this.commander = new Commander(this.client);
    }

    // Migrators to the latest configuration.
    public async latest() {
        await this._ensureTable();

        const [all, completed] = await this._migrationData();

        validateMigrationList(all, completed);

        const migrationsNames = difference(all, completed);

        const migrations = map(migrationsNames, (fileName) => {
            const migrationFile = require(path.join(this._absoluteConfigDir(), fileName)) as IMigrationFile;
            return {
                name: fileName,
                migration: migrationFile,
            };
        });

        return this._runBatch(migrations);
    }

    // Retrieves and returns the current migration version we're on, as a promise.
    // If no migrations have been run yet, return "none".
    public async currentVersion() {
        const completed = await this._listCompleted();

        const val = max(map(completed, (value) => value.split('_')[0]));
        return (isUndefined(val) ? 'none' : val);
    }

    public async forceFreeMigrationsLock() {
        await this._freeLock();
    }

    // Creates a new migration, with a given name.
    public async make(name: string) {
        if (!name) {
            return Promise.reject(new Error('A name must be specified for the generated migration'));
        }

        await fs.ensureDir(this._absoluteConfigDir());

        const templ = await this._generateStubTemplate();

        return this._writeNewMigration(name, templ);
    }

    // Lists all available migration versions, as a sorted array.
    private async _listAll() {
        const loadExtensions = this.config.loadExtensions;
        const files = await fs.readdir(this._absoluteConfigDir());

        const filteredFiles = filter(files, (value) => {
            const extension = path.extname(value);
            return includes(loadExtensions, extension);
        }).sort();

        return filteredFiles;
    }

    // Ensures that a proper table has been created, dependent on the migration
    // config settings.
    private async _ensureTable() {
        const databaseId = this.config.database;
        const collectionId = this.config.collection;
        const lockTableId = this._getLockTableName();

        const database = await this.commander.getOrCreateDatabase(databaseId);
        const migrationCollection = await this.commander.getOrCreateCollection(database._self, collectionId);
        const migrationLockCollection = await this.commander.getOrCreateCollection(database._self, lockTableId);

        await this.commander.upsertDocument(migrationLockCollection._self, { id: 'lock', is_locked: false });

        this.links = {
            migrationLink: migrationCollection._self,
            migretionLockLink: migrationLockCollection._self,
        };
    }

    private _getLockTableName() {
      return this.config.collection + '_lock';
    }

    private async _getLock() {
        const databaseId = this.config.database;
        const lockTableId = this._getLockTableName();

        const database = await this.commander.getOrCreateDatabase(databaseId);
        const migrationLockCollection = await this.commander.getOrCreateCollection(database._self, lockTableId);

        const querySpec = {
            query: 'SELECT * FROM root r WHERE r.id=@id',
            parameters: [
                {
                    name: '@id',
                    value: 'lock',
                },
            ],
        };

        const lockDocuments = await this.commander.queryDocuments(migrationLockCollection._self, querySpec);

        if (lockDocuments.length === 0) {
            throw new Error('Could not find lock document!!!');
        }
        if (lockDocuments[0].is_locked === true) {
            throw new Error('Migration table is already locked');
        }

        await this.commander.upsertDocument(migrationLockCollection._self, { id: 'lock', is_locked: true });
    }

    private async _freeLock() {
        const databaseId = this.config.database;
        const lockTableId = this._getLockTableName();

        const database = await this.commander.getOrCreateDatabase(databaseId);
        const migrationLockCollection = await this.commander.getOrCreateCollection(database._self, lockTableId);

        await this.commander.upsertDocument(migrationLockCollection._self, { id: 'lock', is_locked: false });
    }

    // Run a batch of current migrations, in sequence.
    private async _runBatch(migrations: IMigration[]) {
        try {
          await this._getLock();
          await Promise.all(map(migrations, (migration) => validateMigrationStructure(migration)));

          return this._waterfallBatch(migrations);
        } catch (err) {
          throw err;
        } finally {
          await this._freeLock();
        }
    }

    // Lists all migrations that have been completed for the current db, as an
    // array.
    private async _listCompleted() {
        const query = 'SELECT r.id FROM root r ';

        const documents: IMigrationDocument[] = await this.commander.queryDocuments(this.links.migrationLink, query);

        const completed = map(documents, (document) => document.id);

        documents.sort((itemA, itemB) => {
            if (itemA < itemB) {
                return -1;
            }
            if (itemA > itemB) {
                return 1;
            }
            return 0;
        });
        return completed;
    }

    // Gets the migration list from the specified migration directory, as well as
    // the list of completed migrations to check what should be run.
    private _migrationData() {
      return Promise.all([
        this._listAll(),
        this._listCompleted(),
      ]);
    }

    // Generates the stub template for the current migration, returning a compiled
    // template.
    private async _generateStubTemplate() {
        const stubPath = this.config.stub || path.join(__dirname, 'stub', this.config.extension + '.stub');
        const stub = await fs.readFile(stubPath);

        return template(stub.toString(), {variable: 'd'});
    }

    // Write a new migration to disk, using the config and generated filename,
    // passing any `variables` given in the config to the template.
    private async _writeNewMigration(name: string, templ: TemplateExecutor) {
        const dir = this._absoluteConfigDir();
        if (name[0] === '-') {
            name = name.slice(1);
        }
        const filename = `${yyyymmddhhmmss()}_${name}.${this.config.extension}`;
        await fs.writeFile(
            path.join(dir, filename),
            templ(this.config.variables || {}),
        );

        return path.join(dir, filename);
    }

    // Runs a batch of `migrations` in a specified `direction`, saving the
    // appropriate database information as the migrations are run.
    private async _waterfallBatch(migrations: IMigration[]) {
        const dir = this._absoluteConfigDir();
        const log = [];

        for (const migration of migrations) {
            await this._runMigration(migration);
            log.push({
                fullPath: path.join(dir, migration.name),
                status: 'DONE',
                name: migration.name,
            });

            // TODO uncomment
            await this._saveMigration(migration.name);
        }

        return log;
    }

    private async _runMigration(migration: IMigration) {
        let data = [];

        if (isArray(migration.migration.data)) {
            data = migration.migration.data;
        }

        if (isFunction(migration.migration.data)) {
            data = await migration.migration.data(this.commander);
        }

        if (migration.migration.type.toUpperCase() === MigrationType.SCRIPT) {
            await this._executeScript(migration);
        } else if (migration.migration.type.toUpperCase() === MigrationType.STOREDPROCEDURE) {
            await this._executeProc(migration, data);
        }
    }

    private async _executeScript(migration: IMigration) {
        await migration.migration.body(this.commander);
    }

    private async _executeProc(migration: IMigration, data: any[] = []) {
        const databaseId = migration.migration.database;
        const collectionId = migration.migration.collection;

        const databaseLink = await this.commander.getDatabaseLink(databaseId);

        if (!databaseLink) {
            throw new Error(`Could not find database ${databaseId} for migration ${migration.name}`);
        }

        const collectionLink = await this.commander.getCollectionLink(databaseLink, collectionId);

        if (!collectionLink) {
            throw new Error(`Could not find collection ${collectionId} for migration ${migration.name}`);
        }

        const procedure = await this.commander.upsertSproc(collectionLink, {
            id: migration.migration.id,
            serverScript: migration.migration.body,
        });

        const obj: any = {};
        const result: any = {
            processed: 0,
        };
        let workData = data;

        while (1) {
            const { response, headers } = await this.commander.executeSproc(procedure._self, [obj, workData], { enableScriptLogging: true });

            dlog(`'${migration.name}': scripting log: ${headers[CONSTANTS.ScriptLogResultsHeader]}`);
            dlog(`'${migration.name}': response: ${JSON.stringify(response)}`);

            if (!response) {
                throw new Error('Received empty response object');
            }
            if (!response.status) {
                throw new Error('Received empty response status');
            }

            if (response.continuation) {
                obj.continuation = response.continuation;
            }

            if (response && response.index) {
                workData = workData.slice(response.index);
            }

            if (response && response.processed) {
                result.processed += response.processed;
            }

            if (response.status === 'DONE' ) {
                break;
            } else if (response.status !== 'ERROR') {
                throw new Error('Invalid response status');
            }
        }

        await this.commander.deleteStoredProcedure(procedure._self);

        return result;
    }

    private _saveMigration(name: string) {
        const migrationLink = this.links.migrationLink;
        return this.commander.createDocument(migrationLink, { id: name });
    }

    private _absoluteConfigDir() {
        return path.resolve(process.cwd(), this.config.directory);
    }

    private setConfig(config?: IConfig) {
        return assign({}, CONFIG_DEFAULT, this.config || {}, config);
    }
}
