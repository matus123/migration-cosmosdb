import {
    CollectionMeta, DatabaseMeta, DocumentClient, DocumentQuery, FeedOptions, NewDocument,
    Procedure, ProcedureMeta, RetrievedDocument, UniqueId,
} from 'documentdb';

export function queryDatabases(
    client: DocumentClient,
    querySpec: DocumentQuery,
    options?: FeedOptions,
): Promise<DatabaseMeta[]> {
    return new Promise((resolve, reject) => {
        client.queryDatabases(querySpec, options).toArray((err, results) => {
            if (err) {
                return reject(err);
            }
            return resolve(results);
        });
    });
}

export function queryCollections(
    client: DocumentClient,
    databaseLink: string,
    querySpec: DocumentQuery,
    options?: FeedOptions,
): Promise<CollectionMeta[]> {
    return new Promise((resolve, reject) => {
        client.queryCollections(databaseLink, querySpec, options).toArray((err, results) => {
            if (err) {
                return reject(err);
            }
            return resolve(results);
        });
    });
}

export function queryDocuments(
    client: DocumentClient,
    collectionLink: string,
    querySpec: DocumentQuery,
    options?: FeedOptions,
): Promise<RetrievedDocument[]> {
    return new Promise((resolve, reject) => {
        client.queryDocuments(collectionLink, querySpec, options).toArray((err, results) => {
            if (err) {
                return reject(err);
            }
            return resolve(results);
        });
    });
}

export function createDatabase(client: DocumentClient, databaseDef: UniqueId): Promise<DatabaseMeta> {
    return new Promise((resolve, reject) => {
        client.createDatabase(databaseDef, (err, created, headers) => {
            if (err) {
                return reject(err);
            }
            return resolve(created);
        });
    });
}

export function createCollection(client: DocumentClient, databaseLink: string, collectionDef: UniqueId): Promise<CollectionMeta> {
    return new Promise((resolve, reject) => {
        client.createCollection(databaseLink, collectionDef, (err, created, headers) => {
            if (err) {
                return reject(err);
            }
            return resolve(created);
        });
    });
}

export function createDocument(client: DocumentClient, collectionLink: string, document: NewDocument): Promise<RetrievedDocument> {
    return new Promise((resolve, reject) => {
        client.createDocument(collectionLink, document, (err, created, headers) => {
            if (err) {
                return reject(err);
            }
            return resolve(created);
        });
    });
}

export function deleteDatabase(client: DocumentClient, databaseLink: string) {
    return new Promise((resolve, reject) => {
        client.deleteDatabase(databaseLink, (err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

export function deleteCollection(client: DocumentClient, collectionLink: string) {
    return new Promise((resolve, reject) => {
        client.deleteCollection(collectionLink, (err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

export function deleteDocument(client: DocumentClient, documentLink: string) {
    return new Promise((resolve, reject) => {
        client.deleteDocument(documentLink, (err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

export function upsertDocument(client: DocumentClient, collectionLink: string, document: NewDocument): Promise<RetrievedDocument> {
    return new Promise((resolve, reject) => {
        client.upsertDocument(collectionLink, document, (err, resource) => {
            if (err) {
                return reject(err);
            }
            return resolve(resource);
        });
    });
}

export async function getOrCreateDatabase(client: DocumentClient, databaseId: string) {
    const querySpec = {
        query: 'SELECT * FROM root r WHERE  r.id = @id',
        parameters: [
            {
                name: '@id',
                value: databaseId,
            },
        ],
    };
    const databases = await queryDatabases(client, querySpec);
    if (databases.length === 0) {
        const database = await createDatabase(client, { id: databaseId });
        return database;
    }
    return databases[0];
}

export async function getOrCreateCollection(client: DocumentClient, databaseLink: string, collectionId: string) {
    const querySpec = {
        query: 'SELECT * FROM root r WHERE r.id=@id',
        parameters: [
            {
                name: '@id',
                value: collectionId,
            },
        ],
    };

    const collections = await queryCollections(client, databaseLink, querySpec);
    if (collections.length === 0) {
        const collection = await createCollection(client, databaseLink, { id: collectionId });
        return collection;
    }
    return collections[0];
}

export async function getOrCreateDocument(client: DocumentClient, collectionLink: string, document: NewDocument) {
    const querySpec = {
        query: 'SELECT * FROM root r WHERE r.id=@id',
        parameters: [
            {
                name: '@id',
                value: document.id,
            },
        ],
    };

    const documents = await queryDocuments(client, collectionLink, querySpec);

    if (documents.length === 0) {
        const collection = await createDocument(client, collectionLink, document);
        return collection;
    }
    return documents[0];
}

export function queryStoredProcedures(client: DocumentClient, collectionLink: string, query: DocumentQuery): Promise<ProcedureMeta[]> {
    return new Promise((resolve, reject) => {
        client.queryStoredProcedures(collectionLink, query).toArray((err, results) => {
            if (err) {
                return reject(err);
            }
            return resolve(results);
        });
    });
}

export function deleteStoredProcedure(client: DocumentClient, procedureLink: string): Promise<void> {
    return new Promise((resolve, reject) => {
        client.deleteStoredProcedure(procedureLink, (err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

export function createStoredProcedure(client: DocumentClient, collectionLink: string, procedure: Procedure): Promise<ProcedureMeta> {
    return new Promise((resolve, reject) => {
        client.createStoredProcedure(collectionLink, procedure, (err, resource) => {
            if (err) {
                return reject(err);
            }
            return resolve(resource);
        });
    });
}

export async function upsertSproc(client: DocumentClient, collectionLink: string, sprocDefinition: Procedure) {
    const query = {
        query: 'SELECT * FROM sprocs s WHERE s.id = @id',
        parameters: [{
            name: '@id',
            value: sprocDefinition.id,
        }],
    };

    const procs = await queryStoredProcedures(client, collectionLink, query);

    if (procs.length > 0) {
        const foundProcedure = procs[0];
        await deleteStoredProcedure(client, foundProcedure._self);
    }

    const procedure = await createStoredProcedure(client, collectionLink, sprocDefinition);
    return procedure;
}

export async function getDatabaseLink(client: DocumentClient, databaseId: string, options?: FeedOptions): Promise<string|undefined> {
    const querySpec = {
        query: 'SELECT * FROM root r WHERE r.id=@id',
        parameters: [
            {
                name: '@id',
                value: databaseId,
            },
        ],
    };

    const databases = await queryDatabases(client, querySpec, options);
    if (databases.length > 0) {
        return databases[0]._self;
    }
    return undefined;
}

export async function getCollectionLink(client: DocumentClient, databaseLink: string, collectionId: string, options?: FeedOptions): Promise<string|undefined> {
    const querySpec = {
        query: 'SELECT * FROM root r WHERE r.id=@id',
        parameters: [
            {
                name: '@id',
                value: collectionId,
            },
        ],
    };

    const collections = await queryCollections(client, databaseLink, querySpec, options);
    if (collections.length > 0) {
        return collections[0]._self;
    }
    return undefined;
}

export function executeSproc(client: DocumentClient, sprocLink: string, sprocParams: any[] = []) {
    return new Promise((resolve, reject) => {
        client.executeStoredProcedure(sprocLink, sprocParams, (err, results) => {
            if (err) {
                return reject(err);
            }
            return resolve(results);
        });
    });
}