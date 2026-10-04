// Dependency-free validator for the exact keywords used by the pinned V1 schemas.
// Reject unsupported keywords so future schema changes cannot silently weaken QA.
const supported = new Set(['$schema','$id','title','description','type','required','properties','additionalProperties','$defs','const','enum','$ref','minLength','pattern','minItems','items','minimum','oneOf']);
export function validateFrozenSchema(value, schema, root = schema, path = '$') {
  const errors = [];
  const fail = message => errors.push(`${path}: ${message}`);
  for (const key of Object.keys(schema)) if (!supported.has(key)) fail(`unsupported schema keyword ${key}`);
  if (schema.$ref) {
    if (!schema.$ref.startsWith('#/')) return [`${path}: external schema reference forbidden`];
    const target = schema.$ref.slice(2).split('/').reduce((x,k)=>x?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],root);
    return target ? validateFrozenSchema(value,target,root,path) : [`${path}: unresolved schema reference`];
  }
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  if ('const' in schema && !equal(value,schema.const)) fail('const mismatch');
  if (schema.enum && !schema.enum.some(x=>equal(x,value))) fail('enum mismatch');
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const typeMatches = type => type === 'object' ? isObject : type === 'array' ? Array.isArray(value) : type === 'null' ? value === null : type === 'integer' ? Number.isInteger(value) : typeof value === type;
  if (schema.type && !(Array.isArray(schema.type)?schema.type:[schema.type]).some(typeMatches)) return [...errors,`${path}: type mismatch`];
  if (schema.oneOf && schema.oneOf.filter(s=>validateFrozenSchema(value,s,root,path).length===0).length!==1) fail('oneOf mismatch');
  if (typeof value === 'string') {
    if (schema.minLength!==undefined && [...value].length<schema.minLength) fail('minLength mismatch');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('pattern mismatch');
  }
  if (typeof value === 'number' && schema.minimum!==undefined && value<schema.minimum) fail('minimum mismatch');
  if (Array.isArray(value)) {
    if (schema.minItems!==undefined && value.length<schema.minItems) fail('minItems mismatch');
    if (schema.items) value.forEach((v,i)=>errors.push(...validateFrozenSchema(v,schema.items,root,`${path}[${i}]`)));
  }
  if (isObject) {
    for (const k of schema.required||[]) if (!Object.hasOwn(value,k)) fail(`required ${k}`);
    for (const [k,v] of Object.entries(value)) {
      if (schema.properties?.[k]) errors.push(...validateFrozenSchema(v,schema.properties[k],root,`${path}.${k}`));
      else if (schema.additionalProperties===false) fail(`unknown property ${k}`);
    }
  }
  return errors;
}
