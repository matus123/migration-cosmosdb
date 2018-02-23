const lib = require('documentdb');

const ScriptLogResultsHeader = lib.Constants.HttpHeaders.ScriptLogResults;
const Continuation = lib.Constants.HttpHeaders.Continuation;

const Constants = {
    ScriptLogResultsHeader,
    Continuation,
};

export default Constants;
