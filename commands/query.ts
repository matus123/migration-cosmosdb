import { DocumentClient } from 'documentdb';

interface IDatabase {
    id: string;
    name: string;
}

interface ICollection {
    id: string;
    name: string;
}

export function getAllDatabases(client: DocumentClient): Promise<IDatabase[]> {
    return new Promise((resolve, reject) => {
        client.queryDatabases('select * from root r').toArray((err, resources, headers) => {
            if (err) {
                return reject(err);
            }
            const databases = resources.map((db) => {
                return { id: db.id, name: db._self };
            });
            return resolve(databases);
        });
    });
}

export function getAllCollections(client: DocumentClient, database: string): Promise<ICollection[]> {
    return new Promise((resolve, reject) => {
        client.queryCollections(database, 'select * from root r').toArray((err, resources, headers) => {
            if (err) {
                return reject(err);
            }
            const collections = resources.map((collection) => {
                return { id: collection.id, name: collection._self };
            });
            return resolve(collections);
        });
    });
}

export function getDocuments(client: DocumentClient, collection: string, query?: string = 'select * from root r') {
    return new Promise((resolve, reject) => {
        client.queryDocuments(collection, query).toArray((err, resources, headers) => {
            if (err) {
                return reject(err);
            }
            console.log(resources);
            // const collections = resources.map((collection) => {
            //     return { id: collection.id, name: collection._self };
            // });
            return resolve();
        });
    });
}
