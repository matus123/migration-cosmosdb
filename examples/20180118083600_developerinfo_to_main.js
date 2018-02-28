module.exports = {
    type: 'STOREDPROCEDURE',
    database: 'catalog',
    collection: 'main',
    id: '20180118083500_developerinfo_to_main',
    data: async function(commander) {
        const databaseID = 'developerinfo';
        const collectionID = 'developerinfo';

        const databaseLink = await commander.getDatabaseLink(databaseID);
        const collectionLink = await commander.getCollectionLink(databaseLink, collectionID);

        const documents = await commander.queryDocuments(collectionLink, 'SELECT * FROM c');

        return documents;
    },
    body: function(obj, documents) {
        const context = getContext();
        const collection = context.getCollection();
        const collectionLink = collection.getSelfLink();
        const response = context.getResponse();

        let mainContinuation = obj.continuation;

        const responseBody = {
            processed: 0,
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

        function updateDocument(index, continuation) {
            const mainDocument = documents[index];

            if (mainDocument == null) {
                return responseDone();
            }

            var requestOptions = { continuation : continuation };

            const querySpec = {
                query: 'select * from root r where r.details.aboutDeveloperId=@id',
                parameters: [
                    {
                        name: '@id',
                        value: mainDocument.id,
                    },
                ],
            };
            var isAccepted = collection.queryDocuments(collectionLink, querySpec, requestOptions, function(err, retrievedDocs, responseOptions) {
                if (err) {
                    throw err;
                }

                if (retrievedDocs.length > 0) {
                    for (let document of retrievedDocs) {
                        const modifiedDocument = transform(document, mainDocument);
                        tryUpdateDocument(modifiedDocument);
                        if (!canContinue()) {
                            return;
                        };
                    }
                    if (responseOptions.continuation) {
                        mainContinuation = responseOptions.continuation;
                        updateDocument(index, mainContinuation);
                    } else {
                        return updateDocument(++index);
                    }
                } else if (responseOptions.continuation) {
                    mainContinuation = responseOptions.continuation
                    // Else if the query came back empty, but with a continuation token; repeat the query w/ the token.
                    updateDocument(index, mainContinuation);
                } else {
                    updateDocument(++index); 
                }
            });
            if (!isAccepted) { 
                return responseError('Unable to query documents', continuation);
            }
        }

        function tryUpdateDocument(document) {
            const isAccepted = collection.replaceDocument(document._self, document, (err, responseOptions) => {
                if (err) throw err;

                responseBody.processed += 1;
            });

            // If we hit execution bounds - return continuation: true.
            if (!isAccepted) {
                return responseError('Unable to replace document', mainContinuation);
            }
        }

        function transform(doc, developerInfo) {
            if (developerInfo.contacts && developerInfo.contacts.length > 0) {
                doc.contact = developerInfo.contacts;
            } else {
                doc.contact = [];
            }
            
            if (developerInfo.customerSupport && developerInfo.customerSupport.length > 0) {
                doc.customerSupport = developerInfo.contacts;
            } else {
                doc.customerSupport = [];
            }

            if (developerInfo.companyInfo) {
                doc.companyInfo.name = doc.companyInfo.name || developerInfo.companyInfo || '';
                doc.companyInfo.address = developerInfo.companyInfo.address || doc.companyInfo.address;
            }

            return doc;
        }

        updateDocument(0, mainContinuation);
    }
};
