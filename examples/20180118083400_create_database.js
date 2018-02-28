module.exports = {
    type: 'SCRIPT',
    database: 'states',
    collection: 'states',
    id: '20180118083400_create_database',
    body: async function(commander) {
        const dabataseId = 'states';
        const collectionId = 'states';

        const database = await commander.getOrCreateDatabase(dabataseId);
        const databaseLink = database._self;
        const collection = await commander.getOrCreateCollection(databaseLink, collectionId);
    }
};
