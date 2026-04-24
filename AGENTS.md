## Coding Style

- Prefer direct mutation over spread-based object construction. Use `obj.prop = value` and `obj.nested ??= {}; obj.nested[key] = value` rather than `{ ...obj, prop: value, ...(cond && { nested: { ...obj.nested, [key]: value } }) }`.
