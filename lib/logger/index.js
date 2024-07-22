const os = require('os');

const loglevel = Number(process.env.LOG_LEVEL) || 3;
const Levels = ['error', 'warning', 'info', 'debug', 'system'];

// Set the log functions to the correct output
let log_error = null;
let log_warning = null;
let log_info = null;
let log_debug = null;
let log_system = null;

if(process.env.LOG_TYPE === 'console') {
    log_error = console.error;
    log_warning = console.warn;
    log_info = console.info;
    log_debug = console.debug;
    log_system = console.log;
}

if(process.env.LOG_TYPE === 'stdout') {
    log_error = process.stderr.write;
    log_warning = process.stdout.write;
    log_info = process.stdout.write;
    log_debug = process.stdout.write;
    log_system = process.stdout.write;
}

// If this is a child process, send the log messages to the parent
if(process.send !== undefined) {
    log_error = (text) => process.send({type: 'error', text: text});
    log_warning = (text) => process.send({type: 'warning', text: text});
    log_info = (text) => process.send({type: 'info', text: text});
    log_debug = (text) => process.send({type: 'debug', text: text});
    log_system = (text) => process.send({type: 'system', text: text});
}

/**
 * Returns the current timestamp
 * @returns {String} Timestamp in the format DD.MM.YYYY HH:MM:SS
 */
const getTimestamp = () => {
    const pad = (n, s = 2) => (`${new Array(s).fill(0)}${n}`).slice(-s);
    const d = new Date();

    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${pad(d.getFullYear(), 4)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Will replace all {{Variables}} with the corresponding value of the Key
 * @param {String} templateid 
 * @param {Object} data 
 * @returns {String}
 */
const template = (templateid, data) => {
    if (typeof (templateid) !== 'string' || typeof (data) !== 'object') { throw new Error('Template expects string and object'); }
    return templateid
        .replace(
            /{{2}(\w*)}{2}/g,
            function (m, key) {
                return data.hasOwnProperty(key) ? data[key] : "NULL";
            }
        );
}

/**
 * Return the color and short form for the loglevel
 * @param {number} levelnumber 
 * @returns 
 */
const logColorShort = (levelnumber) => {
    switch (levelnumber) {
        case 1:
            if(process.env.LOG_COLOR == 'true') return '\x1b[31m[E]\x1b[0m';
            return '[E]';
        case 2:
            if(process.env.LOG_COLOR == 'true') return '\x1b[33m[W]\x1b[0m';
            return '[W]';
        case 3:
            if(process.env.LOG_COLOR == 'true') return '\x1b[32m[I]\x1b[0m';
            return '[I]';
        case 4:
            if(process.env.LOG_COLOR == 'true') return '\x1b[35m[D]\x1b[0m';
            return '[D]';
        case 5:
            if(process.env.LOG_COLOR == 'true') return '\x1b[36m[S]\x1b[0m';
            return '[S]';
        default:
            return '\x1b[0m'
    }
}

/**
 * Return the color for the loglevel
 * @param {number} levelnumber 
 * @returns 
 */
const logColor = (levelnumber) => {
    switch (levelnumber) {
        case 1:
            if(process.env.LOG_COLOR == 'true') return '\x1b[31m';
            return '';
        case 2:
            if(process.env.LOG_COLOR == 'true') return '\x1b[33m';
            return '';
        case 3:
            if(process.env.LOG_COLOR == 'true') return '\x1b[32m';
            return '';
        case 4:
            if(process.env.LOG_COLOR == 'true') return '\x1b[35m';
            return '';
        case 5:
            if(process.env.LOG_COLOR == 'true') return '\x1b[36m';
            return '';
        default:
            return ''
    }
}

/**
 * Formats the log message
 * @param {number} levelnumber 
 * @param {string} text 
 * @returns 
 */
const logFormater = (levelnumber, text) => {
    if(process.env.LOG_TEMPLATE) {
        const avaibleVars = {
            levelnumber: levelnumber,
            level: Levels[levelnumber - 1],
            text: text,
            timestamp: getTimestamp(),
            application: process.env.APPLICATION || "Application",
            logcolor: logColor(levelnumber),
            colorreset: '\x1b[0m',
            logcolorshort: logColorShort(levelnumber),
            hostname: os.hostname(),
        }
        return template(process.env.LOG_TEMPLATE, avaibleVars);
    }
    return `[${process.env.APPLICATION || "Application"}] [${getTimestamp()}] ${logColorShort(levelnumber)} ${text}`;
}

/**
 * @param {string} level Loglevel of the to log text
 * @param {string} text Text to log
 */
const logger = function (level, text) {
    const levelnumber = Levels.indexOf(level.toLowerCase()) + 1

    if (levelnumber <= loglevel && levelnumber === 1) {
        log_error(logFormater(levelnumber, text));
    }

    if (levelnumber <= loglevel && levelnumber === 2) {
        log_warning(logFormater(levelnumber, text));
    }

    if (levelnumber <= loglevel && levelnumber === 3) {
        log_info(logFormater(levelnumber, text));
    }

    if (levelnumber <= loglevel && levelnumber === 4) {
        log_debug(logFormater(levelnumber, text));
    }

    if (levelnumber === 5) {
        log_system(logFormater(levelnumber, text));
    }
}

/**
 * logs an error to the console
 * @param {String} text Text to log
 */
const logError = (text) => logger('error', text);

/**
 * logs a warning to the console
 * @param {String} text Text to log
 */
const logWarning = (text) => logger('warning', text);

/**
 * logs a info to the console
 * @param {String} text Text to log
 */
const logInfo = (text) => logger('info', text);

/**
 * logs a debug message to the console
 * @param {String} text 
 * @returns 
 */
const logDebug = (text) => logger('debug', text);

/**
 * logs an system message to the console
 * @param {String} text Text to log
 */
const logSystem = (text) => logger('system', text);

const log = {
    error: logError,
    err: logError,
    warning: logWarning,
    warn: logWarning,
    info: logInfo,
    debug: logDebug,
    system: logSystem,
    sys: logSystem
}

logger('system', `Logger initialized at level ${Levels[loglevel - 1]}`);

module.exports = {
    logger,
    log
};