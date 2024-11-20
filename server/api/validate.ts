import ValidationError from "../errors/validation";
import { DBObjectId, objectIdFromString } from "../services/types/DBObjectId";

export type Validator<T> = (value: any) => T;

const failed = (expected: string, value: any) => {
    return new ValidationError(`Expected ${expected}, but got: ${value.toString().substring(1000)} ${typeof value}`);
}

const primitive = (t: string) => (value: any) => {
    if (value === null || value === undefined || typeof value !== t) {
        throw failed(t, value);
    }

    return value;
}

export const string: Validator<string> = primitive("string");

export const number: Validator<number> = primitive("number");

export const boolean: Validator<boolean> = primitive("boolean");

export const bigInt: Validator<BigInt> = primitive("bigint")

export const anyObject: Validator<Object> = primitive("object");

export const date: Validator<Date> = v => {
    if (typeof v === "string") {
        return new Date(v);
    }

    throw failed("date", v);
}


export const map = <A, B>(mapper: (a: A) => B, validator: Validator<A>): Validator<B> => {
    return v => mapper(validator(v));
}

export const bind = <A, B>(binder: (a: A) => Validator<B>, validator: Validator<A>): Validator<B> => {
    return v => {
        const res: A = validator(v);
        const bi: Validator<B> = binder(res);
        return bi(v);
    }
}

export const named = <A>(name: string, validator: Validator<A>) => {
    return v => {
        try {
            return validator(v);
        } catch (e) {
            throw new ValidationError(`${name} validation failed: ${e}`);
        }
    }
}

export const andR = <A, B>(a: Validator<A>, b: Validator<B>): Validator<B> => {
    return v => {
        a(v);
        return b(v);
    }
}

export const andL = <A, B>(a: Validator<A>, b: Validator<B>): Validator<A> => {
    return v => {
        b(v);
        return a(v);
    }
}

export const or = <A, B>(a: Validator<A>, b: Validator<B>): Validator<A | B> => {
    return v => {
        try {
            return a(v);
        } catch (e) {
            return b(v);
        }
    }
}

export const just = <A>(value: A): Validator<A> => {
    return v => {
        if (v !== value) {
            throw failed(`${value}`, v);
        }

        return value;
    }
}

export const record = <A>(validator: Validator<A>): Validator<Record<string, A>> => {
    return v => {
        if (typeof v !== "object") {
            throw failed("object", v);
        }

        const res: Record<string, A> = {};

        for (const key in v) {
            res[key] = validator(v[key]);
        }

        return res;
    }
}

export const array = <A>(validator: Validator<A>): Validator<A[]> => {
    return v => {
        if (!Array.isArray(v)) {
            throw failed("array", v);
        }

        return v.map(validator);
    }
}

export type ObjectValidator<T> = {
    [Property in keyof T]: Validator<T[Property]>
}

export const object = <T>(objValidator: ObjectValidator<T>): Validator<T> => {
    return v => {
        if (typeof v !== "object") {
            throw failed("object", v);
        }

        let n: any = {};

        for (const key of Object.keys(objValidator)) {
            try {
                const validator: Validator<any> = objValidator[key];
                n[key] = validator(v[key]);
            } catch (e) {
                const err = e as ValidationError;
                throw new ValidationError(`Error in field ${key}: ${err.message}`);
            }
        }

        return n;
    }
}

export const stringEnumeration = <A extends string, M extends A[]>(members: readonly [any, ...M]): Validator<A> => {
    return v => {
        const s = string(v);
        if (members.includes(s as A)) {
            return s as A;
        } else {
            throw failed(members.join(", "), v)
        }
    }
}

export const objectId: Validator<DBObjectId> = map(objectIdFromString, string);

type NumberValidationProps = {
    sign?: 'positive' | 'negative',
    integer?: boolean,
    range?: {
        from: number,
        to: number
    },
}

export const numberAdv = (props: NumberValidationProps) => v => {
    const n = number(v);

    if (props.sign) {
        const sign = Math.sign(n);
        if (props.sign === 'positive') {
            if (sign === -1) {
                throw failed('positive number', v);
            }
        } else if (props.sign === 'negative') {
            if (sign !== -1) {
                throw failed('negative number', v);
            }
        }
    }

    if (props.integer) {
        if (!Number.isInteger(n)) {
            throw failed('integer', v);
        }
    }

    if (props.range) {
        if (n < props.range.from || n > props.range.to) {
            throw failed(`number between ${props.range.from} and ${props.range.to}`, v);
        }
    }

    return n;
}

export const positiveInteger = numberAdv({
    integer: true,
    sign: 'positive'
});

export const withDefault = <A>(defaultValue: A, validator: Validator<A>): Validator<A> => {
    return v => {
        if (v === undefined || v === null) {
            return defaultValue;
        }

        return validator(v);
    }
}