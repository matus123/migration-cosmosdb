import {
    CollectionMeta, DatabaseMeta, DocumentClient, DocumentQuery, FeedOptions, NewDocument,
    Procedure, ProcedureMeta, RetrievedDocument, UniqueId, RequestOptions,
} from 'documentdb';

export default class DbCaller {
    constructor(private client: DocumentClient) {

    }

    public getClient() {
        return this.client;
    }

    public queryDatabases(
        querySpec: DocumentQuery,
        options?: FeedOptions,
    ): Promise<DatabaseMeta[]> {
        return new Promise((resolve, reject) => {
            this.client.queryDatabases(querySpec, options).toArray((err, results) => {
                if (err) {
                    return reject(err);
                }
                return resolve(results);
            });
        });
    }

    public queryCollections(
        databaseLink: string,
        querySpec: DocumentQuery,
        options?: FeedOptions,
    ): Promise<CollectionMeta[]> {
        return new Promise((resolve, reject) => {
            this.client.queryCollections(databaseLink, querySpec, options).toArray((err, results) => {
                if (err) {
                    return reject(err);
                }
                return resolve(results);
            });
        });
    }

    public queryDocuments(
        collectionLink: string,
        querySpec: DocumentQuery,
        options?: FeedOptions,
    ): Promise<RetrievedDocument[]> {
        return new Promise((resolve, reject) => {
            this.client.queryDocuments(collectionLink, querySpec, options).toArray((err, results) => {
                if (err) {
                    return reject(err);
                }
                return resolve(results);
            });
        });
    }

    public createDatabase( databaseDef: UniqueId): Promise<DatabaseMeta> {
        return new Promise((resolve, reject) => {
            this.client.createDatabase(databaseDef, (err, created, headers) => {
                if (err) {
                    return reject(err);
                }
                return resolve(created);
            });
        });
    }

    public createCollection( databaseLink: string, collectionDef: UniqueId): Promise<CollectionMeta> {
        return new Promise((resolve, reject) => {
            this.client.createCollection(databaseLink, collectionDef, (err, created, headers) => {
                if (err) {
                    return reject(err);
                }
                return resolve(created);
            });
        });
    }

    public createDocument( collectionLink: string, document: NewDocument): Promise<RetrievedDocument> {
        return new Promise((resolve, reject) => {
            this.client.createDocument(collectionLink, document, (err, created, headers) => {
                if (err) {
                    return reject(err);
                }
                return resolve(created);
            });
        });
    }

    public deleteDatabase( databaseLink: string) {
        return new Promise((resolve, reject) => {
            this.client.deleteDatabase(databaseLink, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    public deleteCollection( collectionLink: string) {
        return new Promise((resolve, reject) => {
            this.client.deleteCollection(collectionLink, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    public deleteDocument( documentLink: string) {
        return new Promise((resolve, reject) => {
            this.client.deleteDocument(documentLink, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    public upsertDocument( collectionLink: string, document: NewDocument): Promise<RetrievedDocument> {
        return new Promise((resolve, reject) => {
            this.client.upsertDocument(collectionLink, document, (err, resource) => {
                if (err) {
                    return reject(err);
                }
                return resolve(resource);
            });
        });
    }

    public async getOrCreateDatabase( databaseId: string) {
        const querySpec = {
            query: 'SELECT * FROM root r WHERE  r.id = @id',
            parameters: [
                {
                    name: '@id',
                    value: databaseId,
                },
            ],
        };
        const databases = await this.queryDatabases(querySpec);
        if (databases.length === 0) {
            const database = await this.createDatabase({ id: databaseId });
            return database;
        }
        return databases[0];
    }

    public async getOrCreateCollection( databaseLink: string, collectionId: string) {
        const querySpec = {
            query: 'SELECT * FROM root r WHERE r.id=@id',
            parameters: [
                {
                    name: '@id',
                    value: collectionId,
                },
            ],
        };

        const collections = await this.queryCollections(databaseLink, querySpec);
        if (collections.length === 0) {
            const collection = await this.createCollection(databaseLink, { id: collectionId });
            return collection;
        }
        return collections[0];
    }

    public async getOrCreateDocument( collectionLink: string, document: NewDocument) {
        const querySpec = {
            query: 'SELECT * FROM root r WHERE r.id=@id',
            parameters: [
                {
                    name: '@id',
                    value: document.id,
                },
            ],
        };

        const documents = await this.queryDocuments(collectionLink, querySpec);

        if (documents.length === 0) {
            const collection = await this.createDocument(collectionLink, document);
            return collection;
        }
        return documents[0];
    }

    public queryStoredProcedures( collectionLink: string, query: DocumentQuery): Promise<ProcedureMeta[]> {
        return new Promise((resolve, reject) => {
            this.client.queryStoredProcedures(collectionLink, query).toArray((err, results) => {
                if (err) {
                    return reject(err);
                }
                return resolve(results);
            });
        });
    }

    public deleteStoredProcedure( procedureLink: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.deleteStoredProcedure(procedureLink, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    public createStoredProcedure( collectionLink: string, procedure: Procedure): Promise<ProcedureMeta> {
        return new Promise((resolve, reject) => {
            this.client.createStoredProcedure(collectionLink, procedure, (err, resource) => {
                if (err) {
                    return reject(err);
                }
                return resolve(resource);
            });
        });
    }

    public async upsertSproc( collectionLink: string, sprocDefinition: Procedure) {
        const query = {
            query: 'SELECT * FROM sprocs s WHERE s.id = @id',
            parameters: [{
                name: '@id',
                value: sprocDefinition.id,
            }],
        };

        const procs = await this.queryStoredProcedures(collectionLink, query);

        if (procs.length > 0) {
            const foundProcedure = procs[0];
            await this.deleteStoredProcedure(foundProcedure._self);
        }

        const procedure = await this.createStoredProcedure(collectionLink, sprocDefinition);
        return procedure;
    }

    public async getDatabaseLink( databaseId: string, options?: FeedOptions): Promise<string|undefined> {
        const querySpec = {
            query: 'SELECT * FROM root r WHERE r.id=@id',
            parameters: [
                {
                    name: '@id',
                    value: databaseId,
                },
            ],
        };

        const databases = await this.queryDatabases(querySpec, options);
        if (databases.length > 0) {
            return databases[0]._self;
        }
        return undefined;
    }

    public async getCollectionLink( databaseLink: string, collectionId: string, options?: FeedOptions): Promise<string|undefined> {
        const querySpec = {
            query: 'SELECT * FROM root r WHERE r.id=@id',
            parameters: [
                {
                    name: '@id',
                    value: collectionId,
                },
            ],
        };

        const collections = await this.queryCollections(databaseLink, querySpec, options);
        if (collections.length > 0) {
            return collections[0]._self;
        }
        return undefined;
    }

    public executeSproc(sprocLink: string, sprocParams: any[] = [], options: any = {}): Promise<{ response: any, headers: any }> {
        return new Promise((resolve, reject) => {
            this.client.executeStoredProcedure(sprocLink, sprocParams, options, (err, response, headers) => {
                if (err) {
                    return reject(err);
                }
                return resolve({ response, headers });
            });
        });
    }
}
