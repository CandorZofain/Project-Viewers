'use strict';

/**
 * Log functions to auto include date
 */
exports.Log = function (str) {
    console.log((new Date()) + ' ' + str);
}
exports.Error = function (str) {
    console.error((new Date()) + ' ERROR: ' + str);
    console.trace();
}
exports.QuietError = function (str) {
    console.error((new Date()) + ' ERROR: ' + str);
}
exports.NotImplemented = function (str) {
    console.warn((new Date()) + ' WARN: ' + str);
}
exports.Exists = function (object) {
    return typeof (object) != 'undefined';
}

/**
 * Element functions
 */
const ELEMENTS = ['neutral', 'fire', 'wind', 'earth', 'water'];
exports.ELEMENTS = ELEMENTS;
const ELEMENT_TO_INT = { neutral: 0, fire: 1, wind: 2, earth: 3, water: 4 };
exports.ELEMENT_TO_INT = ELEMENT_TO_INT;