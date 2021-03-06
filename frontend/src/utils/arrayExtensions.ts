
export { }

declare global {
    interface Array<T> {
        remove(obj: T): boolean;
        removeAll(selector: (x: T) => boolean): number;
        sum<T>(this: T[], selector: (x: T) => number): number;
        any<T>(this: T[], selector: (x: T) => boolean): boolean;
        all<T>(this: T[], selector: (x: T) => boolean): boolean;
        groupBy<T, K>(this: T[], selector: (x: T) => K): Map<K, T[]>;
        groupInto<T, K>(this: T[], selector: (x: T) => K): { key: K, items: T[] }[];
        distinct<T>(this: T[], keySelector?: ((x: T) => any)): T[];
    }
}

Array.prototype.remove = function remove<T>(this: T[], obj: T): boolean {
    const index = this.indexOf(obj);
    if (index === -1) return false;
    this.splice(index, 1);
    return true;
};

Array.prototype.removeAll = function removeAll<T>(this: T[], selector: (x: T) => boolean): number {
    let count = 0;
    for (let i = 0; i < this.length; i++) {
        if (selector(this[i])) {
            this.splice(i, 1);
            count++;
        }
    }
    return count;
};

Array.prototype.sum = function sum<T>(this: T[], selector: (x: T) => number) {
    return this.reduce((pre, cur) => pre + selector(cur), 0);
};

Array.prototype.any = function any<T>(this: T[], selector: (x: T) => boolean) {
    for (let e of this) {
        if (selector(e))
            return true;
    }
    return false;
};

Array.prototype.all = function all<T>(this: T[], selector: (x: T) => boolean) {
    for (let e of this) {
        if (!selector(e))
            return false;
    }
    return true;
};

Array.prototype.groupBy = function groupBy<T, K>(this: T[], keySelector: (x: T) => K): Map<K, T[]> {
    const map = new Map();
    this.forEach(item => {
        const key = keySelector(item);
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }
    });
    return map;
};


Array.prototype.groupInto = function groupInto<T, K>(this: T[], keySelector: (x: T) => K): { key: K, items: T[] }[] {
    const map = this.groupBy(keySelector);

    const ar: { key: K, items: T[] }[] = [];
    map.forEach((items, key) => {
        ar.push({ key, items });
    })

    return ar;
};


Array.prototype.distinct = function distinct<T>(this: T[], keySelector?: (x: T) => any): T[] {
    const selector = keySelector ? keySelector : (x: T) => x;

    const set = new Set<any>();
    const ar: T[] = [];

    this.forEach(item => {
        const key = selector(item);
        if (!set.has(key)) {
            set.add(key);
            ar.push(item);
        }
    });

    return ar;
};
