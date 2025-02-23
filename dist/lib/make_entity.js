"use strict";
/* Copyright (c) 2012-2022 Richard Rodger and other contributors, MIT License */
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _Entity_private$;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = exports.MakeEntity = void 0;
const util_1 = __importDefault(require("util"));
// const Eraro = require('eraro')
const Jsonic = require('jsonic');
const proto = Object.getPrototypeOf;
// const error = Eraro({
//   package: 'seneca',
//   msgmap: ERRMSGMAP(),
//   override: true,
// })
const toString_map = {
    '': make_toString(),
};
// `null` represents no entity found.
const NO_ENTITY = null;
// `null` represents no error.
const NO_ERROR = null;
function entargs(ent, args) {
    args.role = 'entity';
    args.ent = ent;
    // TODO: should this be: null != ?
    if (this.canon.name !== null) {
        args.name = this.canon.name;
    }
    if (this.canon.base !== null) {
        args.base = this.canon.base;
    }
    if (this.canon.zone !== null) {
        args.zone = this.canon.zone;
    }
    return args;
}
class Entity {
    constructor(canon, seneca) {
        _Entity_private$.set(this, {});
        const private$ = __classPrivateFieldGet(this, _Entity_private$, "f");
        private$.get_instance = function () {
            return seneca;
        };
        private$.canon = canon;
        private$.entargs = entargs;
        private$.promise = false;
        this.private$ = __classPrivateFieldGet(this, _Entity_private$, "f");
        // use as a quick test to identify Entity objects
        // returns compact string zone/base/name
        this.entity$ = this.canon$();
    }
    // Properties without '$' suffix are persisted
    // id property is special: created if not present when saving
    //   lack of id indicates new data record to create
    //   to set id of a new record, use id$
    // func$ functions provide persistence operations
    // args: (<zone>,<base>,<name>,<props>)
    // can be partially specified:
    // make$(name)
    // make$(base,name)
    // make$(zone,base,name)
    // make$(zone,base,null)
    // make$(zone,null,null)
    // props can specify zone$,base$,name$, but args override if present
    // escaped names: foo_$ is converted to foo
    make$(...args) {
        const self = this;
        let first = args[0];
        let last = args[args.length - 1];
        let promise = __classPrivateFieldGet(self, _Entity_private$, "f").promise;
        if ('boolean' === typeof last) {
            promise = last;
            args = args.slice(0, args.length - 1);
        }
        // Set seneca instance, if provided as first arg.
        if (first && first.seneca) {
            const seneca = first;
            __classPrivateFieldGet(self, _Entity_private$, "f").get_instance = function () {
                return seneca;
            };
            first = args[1];
            args = args.slice(1);
        }
        if (first && first.entity$ && 'function' === typeof first.canon$) {
            return first;
        }
        // Pull out props, if present.
        const argprops = args[args.length - 1];
        let props = {};
        if (argprops && typeof argprops === 'object') {
            args.pop();
            props = { ...argprops };
        }
        // Normalize args.
        while (args.length < 3) {
            args.unshift(null);
        }
        let canon;
        if ('string' === typeof props.entity$) {
            canon = parsecanon(props.entity$);
        }
        else if (props.entity$ && 'object' === typeof props.entity$) {
            canon = {};
            canon.zone = props.entity$.zone;
            canon.base = props.entity$.base;
            canon.name = props.entity$.name;
        }
        else {
            let argsname = args.pop();
            argsname = argsname == null ? props.name$ : argsname;
            canon = parsecanon(argsname);
        }
        const name = canon.name;
        let base = args.pop();
        base = base == null ? canon.base : base;
        base = base == null ? props.base$ : base;
        let zone = args.pop();
        zone = zone == null ? canon.zone : zone;
        zone = zone == null ? props.zone$ : zone;
        const new_canon = {};
        new_canon.name = name == null ? __classPrivateFieldGet(self, _Entity_private$, "f").canon.name : name;
        new_canon.base = base == null ? __classPrivateFieldGet(self, _Entity_private$, "f").canon.base : base;
        new_canon.zone = zone == null ? __classPrivateFieldGet(self, _Entity_private$, "f").canon.zone : zone;
        const entity = MakeEntity(new_canon, __classPrivateFieldGet(self, _Entity_private$, "f").get_instance(), { promise });
        for (const p in props) {
            if (Object.prototype.hasOwnProperty.call(props, p)) {
                if (!~p.indexOf('$')) {
                    ;
                    entity[p] = props[p];
                }
                else if (p.length > 2 && p.slice(-2) === '_$') {
                    ;
                    entity[p.slice(0, -2)] = props[p];
                }
            }
        }
        if (Object.prototype.hasOwnProperty.call(props, 'id$')) {
            ;
            entity.id$ = props.id$;
        }
        ;
        self.log$ &&
            self.log$('make', entity.canon$({ string: true }), entity);
        return entity;
    }
    /** Save the entity.
     *  param {object} [data] - Subset of entity field values.
     *  param {callback~save$} done - Callback function providing saved entity.
     */
    save$(data, done) {
        const self = this;
        const si = __classPrivateFieldGet(self, _Entity_private$, "f").get_instance();
        let entmsg = { cmd: 'save', q: {} };
        let done$ = prepareCmd(self, data, entmsg, done);
        entmsg = __classPrivateFieldGet(self, _Entity_private$, "f").entargs(self, entmsg);
        const promise = __classPrivateFieldGet(self, _Entity_private$, "f").promise && !done$;
        let res = promise
            ? entityPromise(si, entmsg)
            : (si.act(entmsg, done$), promise ? NO_ENTITY : self);
        return res; // Sync: Enity self, Async: Entity Promise, Async+Callback: null
    }
    /** Callback for Entity.save$.
     *  @callback callback~save$
     *  @param {error} error - Error object, if any.
     *  @param {Entity} entity - Saved Entity object containing updated data fields (in particular, `id`, if auto-generated).
     */
    // provide native database driver
    native$(done) {
        const self = this;
        const si = __classPrivateFieldGet(self, _Entity_private$, "f").get_instance();
        const promise = __classPrivateFieldGet(self, _Entity_private$, "f").promise;
        let entmsg = { cmd: 'native' };
        let done$ = prepareCmd(self, undefined, entmsg, done);
        entmsg = __classPrivateFieldGet(self, _Entity_private$, "f").entargs(self, entmsg);
        let res = promise && !done
            ? entityPromise(si, entmsg)
            : (si.act(entmsg, done$), promise ? NO_ENTITY : self);
        return res; // Sync: Enity self, Async: Entity Promise, Async+Callback: null
    }
    // load one
    // TODO: qin can be an entity, in which case, grab the id and reload
    // qin omitted => reload self
    /** Load the entity.
     *  param {object|string|number} [query] - Either a entity id, or a query object with field values that must match.
     *  param {callback~load$} done - Callback function providing loaded entity, if found.
     */
    load$(query, done) {
        const self = this;
        if ('function' === typeof query) {
            done = query;
            query = null;
        }
        const si = __classPrivateFieldGet(self, _Entity_private$, "f").get_instance();
        const q = normalize_query(query, self);
        let entmsg = { cmd: 'load', q, qent: self };
        let done$ = prepareCmd(self, undefined, entmsg, done);
        entmsg = __classPrivateFieldGet(self, _Entity_private$, "f").entargs(self, entmsg);
        const promise = __classPrivateFieldGet(self, _Entity_private$, "f").promise && !done$;
        // Empty query gives empty result.
        if (emptyQuery(q)) {
            return promise
                ? NO_ENTITY
                : (done && done.call(si, NO_ERROR, NO_ENTITY), self);
        }
        let res = promise
            ? entityPromise(si, entmsg)
            : (si.act(entmsg, done$), promise ? NO_ENTITY : self);
        // Sync: Enity self, Async: Entity Promise, Async+Callback: null
        return res;
    }
    /** Callback for Entity.load$.
     *  @callback callback~load$
     *  @param {error} error - Error object, if any.
     *  @param {Entity} entity - Matching `Entity` object, if found.
     */
    // TODO: need an update$ - does an atomic upsert
    // list zero or more
    // qin is optional, if omitted, list all
    /** Load the entity.
     *  param {object|string|number} [query] - A query object with field values that must match, can be empty.
     *  param {callback~list$} done - Callback function providing list of matching `Entity` objects, if any.
     */
    // TODO: refactor list, remove, etc, as per save, load
    list$(query, done) {
        const self = this;
        if ('function' === typeof query) {
            done = query;
            query = null;
        }
        const si = __classPrivateFieldGet(self, _Entity_private$, "f").get_instance();
        const q = normalize_query(query, self);
        let entmsg = { cmd: 'list', q, qent: self };
        const done$ = prepareCmd(self, undefined, entmsg, done);
        entmsg = __classPrivateFieldGet(self, _Entity_private$, "f").entargs(self, entmsg);
        const promise = __classPrivateFieldGet(self, _Entity_private$, "f").promise && !done$;
        let res = promise
            ? entityPromise(si, entmsg)
            : (si.act(entmsg, done$),
                promise
                    ? NO_ENTITY // NOTE: [] is *not* valid here, as result is async
                    : self);
        // Sync: Enity self, Async: Entity Promise, Async+Callback: null
        return res;
    }
    /** Callback for Entity.list$.
     *  @callback callback~list$
     *  @param {error} error - Error object, if any.
     *  @param {Entity} entity - Array of `Entity` objects matching query.
     */
    // remove one or more
    // TODO: make qin optional, in which case, use id
    /** Remove the `Entity`.
     *  param {object|string|number} [query] - Either a entity id, or a query object with field values that must match.
     *  param {callback~remove$} done - Callback function to confirm removal.
     */
    remove$(query, done) {
        const self = this;
        if ('function' === typeof query) {
            done = query;
            query = null;
        }
        const si = __classPrivateFieldGet(self, _Entity_private$, "f").get_instance();
        const q = normalize_query(query, self);
        let entmsg = __classPrivateFieldGet(self, _Entity_private$, "f").entargs(self, { cmd: 'remove', q, qent: self });
        let done$ = prepareCmd(self, undefined, entmsg, done);
        const promise = __classPrivateFieldGet(self, _Entity_private$, "f").promise && !done$;
        // empty query means take no action
        if (emptyQuery(q)) {
            return promise
                ? NO_ENTITY
                : (done$ && done$.call(si, NO_ERROR, NO_ENTITY), self);
        }
        let res = promise
            ? entityPromise(si, entmsg)
            : (si.act(entmsg, done$), promise ? NO_ENTITY : self);
        return res; // Sync: Enity self, Async: Entity Promise, Async+Callback: null
    }
    // DEPRECATE: legacy
    delete$(query, done) {
        return this.remove$(query, done);
    }
    /** Callback for Entity.remove$.
     *  @callback callback~remove$
     *  @param {error} error - Error object, if any.
     */
    fields$() {
        const self = this;
        const fields = [];
        for (const p in self) {
            if (Object.prototype.hasOwnProperty.call(self, p) &&
                typeof self[p] !== 'function' &&
                p.charAt(p.length - 1) !== '$') {
                fields.push(p);
            }
        }
        return fields;
    }
    // TODO: remove
    close$(done) {
        const self = this;
        const si = __classPrivateFieldGet(self, _Entity_private$, "f").get_instance();
        const async = is_async(si, done);
        const entmsg = __classPrivateFieldGet(self, _Entity_private$, "f").entargs(self, { cmd: 'close' });
        self.log$ && self.log$('close');
        let done$ = null == done
            ? undefined
            : this.done$
                ? this.done$(done)
                : done;
        return async ? si.post(entmsg) : (si.act(entmsg, done$), self);
    }
    is$(canonspec) {
        const self = this;
        const canon = canonspec
            ? canonspec.entity$
                ? canonspec.canon$({ object: true })
                : parsecanon(canonspec)
            : null;
        if (!canon)
            return false;
        return util_1.default.inspect(self.canon$({ object: true })) === util_1.default.inspect(canon);
    }
    canon$(opt) {
        const self = this;
        const canon = __classPrivateFieldGet(self, _Entity_private$, "f").canon;
        if (opt) {
            if (opt.isa) {
                const isa = parsecanon(opt.isa);
                // NOTE: allow null == void 0
                return (isa.zone == canon.zone &&
                    isa.base == canon.base &&
                    isa.name == canon.name);
            }
            else if (opt.parse) {
                return parsecanon(opt.parse);
            }
            else if (opt.change) {
                // DEPRECATED
                // change type, undef leaves untouched
                canon.zone = opt.change.zone == null ? canon.zone : opt.change.zone;
                canon.base = opt.change.base == null ? canon.base : opt.change.base;
                canon.name = opt.change.name == null ? canon.name : opt.change.name;
                // explicit nulls+undefs delete
                if (null == opt.zone)
                    delete canon.zone;
                if (null == opt.base)
                    delete canon.base;
                if (null == opt.name)
                    delete canon.name;
                self.entity$ = self.canon$();
            }
        }
        return null == opt || opt.string || opt.string$
            ? [
                (opt && opt.string$ ? '$' : '') +
                    (null == canon.zone ? '-' : canon.zone),
                null == canon.base ? '-' : canon.base,
                null == canon.name ? '-' : canon.name,
            ].join('/') // TODO: make joiner an option
            : opt.array
                ? [canon.zone, canon.base, canon.name]
                : opt.array$
                    ? [canon.zone, canon.base, canon.name]
                    : opt.object
                        ? { zone: canon.zone, base: canon.base, name: canon.name }
                        : opt.object$
                            ? { zone$: canon.zone, base$: canon.base, name$: canon.name }
                            : [canon.zone, canon.base, canon.name];
    }
    // data = object, or true|undef = include $, false = exclude $
    data$(data, canonkind) {
        const self = this;
        let val;
        // TODO: test for entity$ consistent?
        // Update entity fields from a plain data object.
        if (data && 'object' === typeof data) {
            // does not remove fields by design!
            for (const f in data) {
                if (f.charAt(0) !== '$' && f.charAt(f.length - 1) !== '$') {
                    val = data[f];
                    if (val && 'object' === typeof val && val.entity$) {
                        self[f] = val.id;
                    }
                    else {
                        self[f] = val;
                    }
                }
            }
            if (data.id$ != null) {
                self.id$ = data.id$;
            }
            if (null != data.merge$) {
                self.merge$ = data.merge$;
            }
            if (null != data.custom$) {
                self.custom$(data.custom$);
            }
            return self;
        }
        // Generate a plain data object from entity fields.
        else {
            const include_$ = null == data ? true : !!data;
            data = {};
            if (include_$) {
                canonkind = canonkind || 'object';
                let canonformat = {};
                canonformat[canonkind] = true;
                data.entity$ = self.canon$(canonformat);
                if (0 < Object.keys(self.custom$).length) {
                    data.custom$ = __classPrivateFieldGet(self, _Entity_private$, "f").get_instance().util.deep(self.custom$);
                }
            }
            const fields = self.fields$();
            for (let fI = 0; fI < fields.length; fI++) {
                if (!~fields[fI].indexOf('$')) {
                    val = self[fields[fI]];
                    if (val && 'object' === typeof val && val.entity$) {
                        data[fields[fI]] = val.id;
                    }
                    // NOTE: null is allowed, but not undefined
                    else if (void 0 !== val) {
                        data[fields[fI]] = val;
                    }
                }
            }
            return data;
        }
    }
    clone$() {
        const self = this;
        let deep = __classPrivateFieldGet(this, _Entity_private$, "f").get_instance().util.deep;
        let clone = self.make$(deep({}, self.data$()));
        if (0 < Object.keys(self.custom$).length) {
            clone.custom$(self.custom$);
        }
        return clone;
    }
    custom$(_props) {
        return {};
    }
}
exports.Entity = Entity;
_Entity_private$ = new WeakMap();
// Return an entity operation result as a promise,
// attaching the meta callback argument to the result object for easier access.
function entityPromise(si, entmsg) {
    var _a;
    let attachMeta = true === ((_a = entmsg.q) === null || _a === void 0 ? void 0 : _a.meta$);
    return new Promise((res, rej) => {
        si.act(entmsg, (err, out, meta) => {
            err
                ? rej((attachMeta ? (err.meta$ = meta) : null, err))
                : res((attachMeta
                    ? (((out === null || out === void 0 ? void 0 : out.entity$)
                        ? proto(out)
                        : out || (out = { entity$: null })).meta$ = meta)
                    : null,
                    out));
        });
    });
}
function prepareCmd(ent, data, entmsg, done) {
    if ('function' === typeof data) {
        done = data;
    }
    else if (data && 'object' === typeof data) {
        // TODO: this needs to be deprecated as first param needed for
        // directives, not data - that's already in entity object
        ent.data$(data);
        entmsg.q = data;
    }
    return null == done ? undefined : ent.done$ ? ent.done$(done) : done;
}
function emptyQuery(q) {
    return null == q || 0 === Object.keys(q).length;
}
// Query values can be a scalar id, array of scalar ids, or a query object.
function normalize_query(qin, ent) {
    let q = qin;
    if ((null == qin || 'function' === typeof qin) && ent.id != null) {
        q = { id: ent.id };
    }
    else if ('string' === typeof qin || 'number' === typeof qin) {
        q = qin === '' ? null : { id: qin };
    }
    else if ('function' === typeof qin) {
        q = null;
    }
    // TODO: test needed
    // Remove undefined values.
    if (null != q) {
        for (let k in q) {
            if (undefined === q[k]) {
                delete q[k];
            }
        }
    }
    return q;
}
// parse a canon string:
// $zone-base-name
// $, zone, base are optional
function parsecanon(str) {
    let out = {};
    if (Array.isArray(str)) {
        return {
            zone: str[0],
            base: str[1],
            name: str[2],
        };
    }
    if (str && 'object' === typeof str && 'function' !== typeof str)
        return str;
    if ('string' !== typeof str)
        return out;
    const m = /\$?((\w+|-)\/)?((\w+|-)\/)?(\w+|-)/.exec(str);
    if (m) {
        const zi = m[4] == null ? 4 : 2;
        const bi = m[4] == null ? 2 : 4;
        out.zone = m[zi] === '-' ? void 0 : m[zi];
        out.base = m[bi] === '-' ? void 0 : m[bi];
        out.name = m[5] === '-' ? void 0 : m[5];
    }
    else {
        throw new Error(`Invalid entity canon: ${str}; expected format: zone/base/name.`);
    }
    return out;
}
function handle_options(entopts) {
    var _a;
    entopts = entopts || Object.create(null);
    if (entopts.hide) {
        //_.each(entopts.hide, function (hidden_fields, canon_in) {
        Object.keys(entopts.hide).forEach((hidden_fields) => {
            //, function (hidden_fields, canon_in) {
            const canon_in = entopts.hide[hidden_fields];
            const canon = parsecanon(canon_in);
            const canon_str = [
                canon.zone == null ? '-' : canon.zone,
                canon.base == null ? '-' : canon.base,
                canon.name == null ? '-' : canon.name,
            ].join('/');
            toString_map[canon_str] = make_toString(canon_str, hidden_fields, entopts);
        });
    }
    if (false === ((_a = entopts.meta) === null || _a === void 0 ? void 0 : _a.provide)) {
        // Drop meta argument from callback
        ;
        Entity.prototype.done$ = (done) => {
            return null == done
                ? undefined
                : function (err, out) {
                    done.call(this, err, out);
                };
        };
    }
    return entopts;
}
function make_toString(canon_str, hidden_fields_spec, opts) {
    opts = opts || { jsonic: {} };
    let hidden_fields = [];
    if (Array.isArray(hidden_fields_spec)) {
        hidden_fields.concat(hidden_fields_spec);
    }
    else if (hidden_fields_spec && 'object' === typeof hidden_fields_spec) {
        Object.keys(hidden_fields_spec).forEach((k) => {
            hidden_fields.push(k);
        });
    }
    hidden_fields.push('id');
    return function () {
        return [
            '$',
            canon_str || this.canon$({ string: true }),
            ';id=',
            this.id,
            ';',
            Jsonic.stringify(this, {
                omit: hidden_fields,
                depth: opts.jsonic.depth,
                maxitems: opts.jsonic.maxitems,
                maxchars: opts.jsonic.maxchars,
            }),
        ].join('');
    };
}
function is_async(seneca, done) {
    const promisify_loaded = true === seneca.root.__promisify$$ || 'function' === typeof seneca.post;
    const has_callback = 'function' === typeof done;
    return promisify_loaded && !has_callback;
}
// type CustomProps = { custom$: (props: any) => any }
function MakeEntity(canon, seneca, opts) {
    opts = handle_options(opts);
    const deep = seneca.util.deep;
    const ent = new Entity(canon, seneca);
    let canon_str = ent.canon$({ string: true });
    let toString = (toString_map[canon_str] || toString_map['']).bind(ent);
    let custom$ = function (props) {
        if (null != props &&
            ('object' === typeof props || 'function' === typeof props)) {
            Object.assign(this.custom$, deep(props));
        }
        return ent;
    };
    // Place instance specific properties into a per-instance prototype,
    // replacing Entity.prototype.prototype
    let hidden = Object.create(Object.getPrototypeOf(ent));
    hidden.toString = toString;
    hidden.custom$ = custom$;
    hidden.private$ = ent.private$;
    hidden.private$.promise = !!opts.promise;
    Object.setPrototypeOf(ent, hidden);
    delete ent.private$;
    return ent;
}
exports.MakeEntity = MakeEntity;
MakeEntity.parsecanon = parsecanon;
//# sourceMappingURL=make_entity.js.map