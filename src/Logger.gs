/**
 * Set of function that allow log messages to be retrieved from the view in order to be displayed
 * into the regular JS console
 */

/**
 * Push one or several objects into the log stack
 * @param obj1 ... objN A list of JavaScript objects to log.
 */
function log() {
    var logs = getLogsFromCache();

    for (var i = 0; i < arguments.length; i++) {
        logs.push(arguments[i]);
    }

    saveLogsIntoCache(logs);
}

/**
 * Pops and returns the logged objects
 * @return {array} logged objects
 */
function popLogs() {
    var logs = getLogsFromCache();
    saveLogsIntoCache([]);
    return logs;
}

/**
 * Returns the logged messages
 * @return {array} logged messages
 */
function getLogsFromCache() {
    var logs = CacheService.getDocumentCache().get('logs');

    if (logs) {
        return JSON.parse(logs);
        ;
    }

    return [];
}

/**
 * Save log stack
 * @param {array} logs The logs stack
 */
function saveLogsIntoCache(logs) {
    CacheService.getDocumentCache().put('logs', JSON.stringify(logs));
}