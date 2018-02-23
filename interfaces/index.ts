import { NewDocument } from 'documentdb';

import Commander from '../migrator/commander';

export interface IMigration {
    name: string;
    migration: IMigrationFile;
}

export interface IMigrationFile {
    type: MigrationType;
    database: string;
    collection: string;
    id: string;
    data?: IMigrationDataFunction;
    body: (v1: any) => any;
}

export interface IMigrationDocument {
    id: string;
}

export enum MigrationType {
    STOREDPROCEDURE = 'STOREDPROCEDURE',
    SCRIPT = 'SCRIPT',
}

type IMigrationDataFunction = (commander: Commander) => Promise<any[]> | any[];
type IMigrationFunction = (doc: NewDocument) => void;
type IMigrationScriptFunction = (commander: Commander) => Promise<void>;

export interface IConfig {
    connection: {
        host: string;
        masterKey: string;
    };
    directory: string;
    extension: string;
    loadExtensions: string[];
    stub?: string;
    variables?: any;
    database: string;
    collection: string;
}
