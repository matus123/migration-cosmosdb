module.exports = {
    type: 'STOREDPROCEDURE',
    database: 'states',
    collection: 'states',
    id: '20180118083500_create_states_status',
    data: async function(commander) {
        const databaseID = 'catalog';
        const collectionID = 'main';

        const databaseLink = await commander.getDatabaseLink(databaseID);
        const collectionLink = await commander.getCollectionLink(databaseLink, collectionID);

        const documents = await commander.queryDocuments(collectionLink, 'SELECT c.id, c.status, c.appStates FROM c');

        return documents;
    },
    body: function(obj, documents) {
        const context = getContext();
        const collection = context.getCollection();
        const collectionLink = collection.getSelfLink();
        const response = context.getResponse();

        const responseBody = {
            processed: 0,
            index: 0,
        };

        function canContinue() {
            if (!responseBody.status) {
                return true;
            }
            return false;
        }

        function responseError(message, continuation) {
            responseBody.status = 'ERROR';
            responseBody.continuation = continuation;
            responseBody.message = message;
            response.setBody(responseBody);
        }

        function responseDone() {
            responseBody.status = 'DONE';
            response.setBody(responseBody);
        }

        function createDocument(documents, index) {
            const document = documents[index];

            if (document == null) {
                return responseDone();
            }

            const doc = transform(document);

            const isAccepted = collection.createDocument(collectionLink, doc, (err, resource, headers) => {
                if (err) throw err;

                responseBody.processed += 1;
                responseBody.index += 1;

                createDocument(documents, ++index);
            });

            if (!isAccepted) {
                return responseError('Failed to create document');
            }
        }

        function transform(doc) {
            const appId = doc.id;

            let availability = [];
            let appStates = [];

            if (doc.status instanceof Array) {
                availability = doc.status.map((status) => {
                    return {
                        countryId: status.countryId,
                        statusId: status.statusId,
                    };
                });
            }

            if (doc.appStates instanceof Array) {
                appStates = doc.appStates.map((appState) => {
                    return {
                        instituteId: appState.instituteId,
                        state: appState.state,
                    };
                });
            }
            
            return {
                id: appId,
                availability: availability,
                appStates: appStates,
            };
        }

        createDocument(documents, 0);
    }
};
