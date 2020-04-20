"use strict";

var global = {
    Log: function (str) {
        console.log(str);
    },
    Error: function (str) {
        console.error('ERROR: ' + str);
    },
    Exists: function (object) {
        return typeof (object) != 'undefined';
    }
};