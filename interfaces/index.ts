import { DocumentClient, NewDocument } from 'documentdb';

export interface IMigration {
    name: string;
    migration: IMigrationFile;
}

export interface IMigrationFile {
    database: string;
    collection: string;
    id: string;
    body: IMigrationFunction;
}

export interface IMigrationDocument {
    id: string;
}

type IMigrationFunction = (doc: NewDocument, client: DocumentClient) => NewDocument;

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
