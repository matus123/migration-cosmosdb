module.exports = {
    type: 'STOREDPROCEDURE',
    database: 'developerinfo',
    collection: 'developerinfo',
    id: '20180116153029_country_developerinfo',
    body: function(obj, document) {
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

        const languageMapping = [
            'us',
            'au',
            'cn',
            'de',
            'jp',
            'gb',
            'fr',
        ];

        function readDocuments(continuation) {
            var query = 'select * from root r';
            var requestOptions = { continuation : continuation };
            var isAccepted = collection.queryDocuments(collectionLink, query, requestOptions, function(err, retrievedDocs, responseOptions) {
                if (err) throw err;

                if (retrievedDocs.length > 0) {
                    for (let document of retrievedDocs) {
                        const modifiedDocument = transform(document);
                        tryUpdateDocument(modifiedDocument);
                        if (!canContinue()) {
                            return;
                        };
                    }
                    if (responseOptions.continuation) {
                        mainContinuation = responseOptions.continuation;
                        readDocuments(mainContinuation);
                    } else {
                        return responseDone();
                    }
                } else if (responseOptions.continuation) {
                    mainContinuation = responseOptions.continuation
                    // Else if the query came back empty, but with a continuation token; repeat the query w/ the token.
                    readDocuments(mainContinuation);
                } else {
                    // Else if there are no more documents and no continuation token - we are finished deleting documents.
                    return responseDone();
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

        function countryMapping(id) {
            if (id == null || id >= languageMapping.length || isNaN(id)) {
                return id;
            }
            return languageMapping[id];
        }

        function transform(doc) {
            if (doc.contacts) {
                for (let contact of doc.contacts) {
                    if (contact.countryId != null) {
                        contact.countryId = countryMapping(contact.countryId);
                    }
                }
            }

            return doc;
        }

        readDocuments(mainContinuation);
    }
};
