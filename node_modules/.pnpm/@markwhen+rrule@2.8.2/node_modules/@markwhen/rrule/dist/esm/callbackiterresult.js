import IterResult from './iterresult';
/**
 * IterResult subclass that calls a callback function on each add,
 * and stops iterating when the callback returns false.
 */
export default class CallbackIterResult extends IterResult {
    constructor(method, args, iterator) {
        super(method, args);
        this.iterator = iterator;
    }
    add(date) {
        if (this.iterator(date, this._result.length)) {
            this._result.push(date);
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=callbackiterresult.js.map