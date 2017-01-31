/**
 * TextGenerator App
 *
 * @OnlyCurrentDoc
 */

/**
 * Runs when the add-on is installed.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @param {object} e The event parameter for a simple onInstall trigger. 
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Creates a menu entry in the Google Spreadsheet UI when the sheet is opened.
 * @param {object} e The event parameter for a simple onOpen trigger.
 */
function onOpen(e) {
    SpreadsheetApp.getUi().createAddonMenu()
        .addItem('Generate texts', 'start')
        .addToUi();
}

/**
 * Opens a Sidebar in the document containing the add-on's user interface.
 */
function start() {
    PropertiesService.getDocumentProperties().setProperty("active_column", SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getActiveCell().getColumn());

    var ui = HtmlService.createHtmlOutputFromFile('Sidebar')
        .setTitle('TextGenerator');

    SpreadsheetApp.getUi().showSidebar(ui);
}

/**
 * Opens a Dialog containing the form for editing the template.
 */
function showTemplateForm() {
    var ui = HtmlService.createHtmlOutputFromFile('TemplateForm').setWidth(850).setHeight(460);
    SpreadsheetApp.getUi().showModalDialog(ui, 'Edit template');
}

/**
 * Perfom the text generation from the sheet' data and the provided template
 * @param {string} apiUrl The API URL to query
 * @param {string} template The text template
 * @param {int} rowsByQuery Number of texts to generate for each query to the API
 * @param {int} headRow Head row number (from which retrieve the tags name)
 * @param {int} firstDataRow The first data row number (from where to start the generation)
 * @param {boolean} fillAll True if we want to replace all the cells contents from the active column by generated texts
 */
function runTextGeneration(apiUrl, template, rowsByQuery, headRow, firstDataRow, fillAll) {
    // Reset the current running status
    updateStatus('run');
  
    var result = '',
        ui = SpreadsheetApp.getUi();
  
    if (template === '') {
        ui.alert('Error', "A template must be set in order to generate texts.", ui.ButtonSet.OK);
        return;
    }
      
    if (headRow >= firstDataRow) {
        ui.alert('Error', "The first data row must be below the head row.", ui.ButtonSet.OK);
        return;
    }

    result = forEachRange(rowsByQuery, fillAll, headRow, firstDataRow, function (rowsToUpdate, data) {
        var response = '',
            options = {
                'method': 'post',
                'payload': {'template': template, 'data': JSON.stringify(data)}
            };

        try {
            response = UrlFetchApp.fetch(apiUrl, options).getContentText();
        } catch(e) {
            return 'There was a problem with the server. Please check the API URL.';
        }

        if (response === '') {
            return 'There was a problem with the server, the response is empty.';
        }

        try {
            var json = JSON.parse(response);
        } catch(e) {
            return "The server response is not valid. Check the API URL or try later.";
        }

        if (typeof json.error === 'string' && json.error !== '') {
            return 'There was a error returned by the server : ' + json.error;
        }
      
        if (typeof json.result !== 'object' || json.result.length === 0) {
            return "The server returned no result.";
        }

        var activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(),
            activeColumnIndex = getActiveColumnIndex();

        for (var i = 0; i < rowsToUpdate.length; ++i) {
            // Replace cells content by the generated texts retrieved from the API
            activeSheet.getRange(rowsToUpdate[i], activeColumnIndex, 1, 1).setValue(json.result[i]);
        }
    });
  
    if (result) {
        ui.alert('Error', result, ui.ButtonSet.OK);
    }
}

/**
 * Call a function for each sheet range
 * @param {int} rowsNumber Number of rows of each range
 * @param {boolean} fillAll True if we want to replace all the cells contents from the active column by generated texts
 * @param {int} headRow Head row number (from which retrieve the tags name)
 * @param {int} firstDataRow The first data row number (from where to start the generation)
 * @param {function} callback function to call for each range. The callback must return true, otherwise, it will abort
 * the loop, and it will return the string returned by the callback.
 */
function forEachRange(rowsNumber, fillAll, headRow, firstDataRow, callback) {
    var activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(),
        lastColumn = activeSheet.getLastColumn(),
        lastRow = activeSheet.getLastRow(),
        activeColumnIndex = getActiveColumnIndex(),
        tags = getAvailableTags(headRow),
        cluster = [],
        rowsToUpdate = [],
        lastStatusCheck = Date.now();
  
  
    if (lastRow < 2) {
      return "Your sheet should contain at least two rows : a head row (for tag names), and a row of data.";
    }
  
    if (lastRow < firstDataRow) {
        return "Your sheet doesn't contains any row of data starting from row " + firstDataRow + ". Please add rows before generating texts.";
    }

    for (var i = firstDataRow; i <= lastRow; i += 1) {

        // Check regurlarly if the user stopped the execution
        if (Date.now() - lastStatusCheck > 200) {
            lastStatusCheck = Date.now();
            if (getStatus() === 'stop') {
                return 'Text generation aborted.';
            }
        }

        // Sleep every 50 rows in order to let the sheet get updated properly
        if (i % 50 === 0) {
            Utilities.sleep(125);
        }

        if (fillAll === true || activeSheet.getRange(i, activeColumnIndex, 1, 1).getValues()[0][0] === "") {

            var values = activeSheet.getRange(i, 1, 1, lastColumn).getValues(),
                clusterRow = {};

            for (var col in values[0]) {
                if (typeof tags[(parseInt(col) + 1)] !== 'undefined') {

                    // Check if the cell contains valid JSON object
                    var value = values[0][col];
                    if (typeof value === 'string' && value.substring(0, 1) === '[') {
                        try {
                            var value = JSON.parse(value);
                        } catch(e) {}
                    }
                    clusterRow[tags[(parseInt(col) + 1)]['tag']] = value;
                }
            }

            cluster.push(clusterRow);
            rowsToUpdate.push(i);
        }

        if (cluster.length === rowsNumber || i === lastRow) {
            var result = callback(rowsToUpdate, cluster);

            if (result !== true) {
                return result;
            }

            cluster = [];
            rowsToUpdate = [];
        }
    }
    return  '';
}

/**
 * Get the list of available tags, with tag names and related column indexes
 * @param {int} headRow The head row number
 * @return {object} The list of available tags
 */
function getAvailableTags(headRow) {
    var result = {},
        activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(),
        lastColumn = activeSheet.getLastColumn();
  
    if (lastColumn === 0) {
        return result;
    }
  
    var values = activeSheet.getRange(headRow, 1, 1, lastColumn).getValues();
  
    for (var col in values[0]) {
        // Ignore current column and empty tag name
        if (parseInt(col) + 1 === getActiveColumnIndex() || values[0][col] === '') {
            continue;
        }

        result[parseInt(col) + 1] = {
            'tag': tagify(values[0][col]),
            'columnIndex': parseInt(col) + 1
        };
    }

    return result;
}

/**
 * Save user preferences for the active column
 * @param {string} name preference name
 * @param {string | int | boolean} value preference value
 */
function savePreference(name, value) {
    var activeColumnIndex = getActiveColumnIndex(),
        preferences = getPreferences();
    preferences[name] = value;
    return PropertiesService.getDocumentProperties().setProperty('pref_col' + activeColumnIndex, JSON.stringify(preferences));
}

/**
 * Get user preferences for the active column
 * @return {object} User preferences
 */
function getPreferences() {
    var activeColumnIndex = getActiveColumnIndex(),
        preferences = PropertiesService.getDocumentProperties().getProperty('pref_col' + activeColumnIndex);

    if (preferences) {
        return JSON.parse(preferences);
    }

    return {};
}

/**
 * Get the active column index
 * @returns {int} Active column index
 */
function getActiveColumnIndex() {
    return PropertiesService.getDocumentProperties().getProperty("active_column");
}

/**
 * Get the active column name (ie : 'A', 'E', ...)
 * @returns {string} Active column name
 */
function getActiveColumnName() {
    return columnToLetter(getActiveColumnIndex());
}

/**
 * Update the running status
 * @param {string} status
 */
function updateStatus(status) {
    PropertiesService.getDocumentProperties().setProperty("status", status);
}

/**
 * Get the running status
 * @return {string} status
 */
function getStatus() {
    return PropertiesService.getDocumentProperties().getProperty("status");
}

/**
 * Update the template dialog status
 * @param {string} status
 */
function updateTemplateDialogStatus(status) {
    PropertiesService.getDocumentProperties().setProperty("template_dialog_status", status);
}

/**
 * Get the template dialog status
 * @return {string} status
 */
function getTemplateDialogStatus() {
    return PropertiesService.getDocumentProperties().getProperty("template_dialog_status");
}