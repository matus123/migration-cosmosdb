// Ensure that we have 2 places for each of the date segments.
export function padDate(segment: number) {
    const stringSegment = segment.toString();
    return stringSegment[1] ? stringSegment : `0${stringSegment}`;
}

// Get a date object in the correct format, without requiring a full out library
// like "moment.js".
export function yyyymmddhhmmss() {
    const d = new Date();
    return d.getFullYear().toString() +
        padDate(d.getMonth() + 1) +
        padDate(d.getDate()) +
        padDate(d.getHours()) +
        padDate(d.getMinutes()) +
        padDate(d.getSeconds());
}