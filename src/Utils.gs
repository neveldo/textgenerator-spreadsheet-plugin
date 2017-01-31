/**
 * TextGenerator helper functions
 */

/**
 * Transform the text parameter into a valid tag for the TextGenerator
 * @param {string} text The text to transform as a tag
 * @return {string} Tag name
 */
function tagify(text) {
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '_')
}

/**
 * Transform a column index (starting from 1) into a letter
 * @param {int} column The column index
 * @return {string} the related letter
 */
function columnToLetter(column) {
    var temp, letter = '';

    while (column > 0) {
        temp = (column - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = (column - temp - 1) / 26;
    }
    return letter;
}

/**
 * Transform a letter into a column index (starting from 1)
 * @param {string} letter the related letter
 * @return {int} The column index
 */
function letterToColumn(letter) {
    var column = 0, length = letter.length;

    for (var i = 0; i < length; i++) {
        column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
    }
    return column;
}