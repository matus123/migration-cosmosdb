module.exports = {
    type: 'STOREDPROCEDURE',
    database: 'catalog',
    collection: 'main',
    id: '20180118084500_remove_unnecessary_from_main',
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

        function transform(doc) {
            if (doc.imageFilePath !== undefined) {
                delete doc.imageFilePath;
            }

            if (doc.backgroundPicturePath !== undefined) {
                delete doc.backgroundPicturePath;
            }

            if (doc.appStates !== undefined) {
                delete doc.appStates;
            }

            if (doc.status !== undefined) {
                delete doc.status;
            }

            if (doc.termsAndConditions !== undefined && doc.termsAndConditions.length > 0) {
                for (let termsAndCondition of doc.termsAndConditions) {
                    if (termsAndCondition.id != null) {
                        delete termsAndCondition.id;
                    }
                }
            }

            if (doc.details) {
                const details = doc.details;
                
                doc.version = details.version || null;
                doc.availabilityDate = details.availabilityDate || null;
                doc.appType = details.appType || null;
                doc.area = details.area || null;

                doc.dataPrivacy = details.dataPrivacy || null;
                doc.instructionForUse = details.instructionForUse || null;
                doc.termsAndConditionsWebPage = details.termsAndConditions || null;

                doc.videos = details.videos || null;
                doc.pictures = details.pictures || null;
                doc.patientDataPrivacy = details.patientDataPrivacy || null;

                delete doc.details;
            }

            return doc;
        }

        readDocuments(mainContinuation);
    }
};
