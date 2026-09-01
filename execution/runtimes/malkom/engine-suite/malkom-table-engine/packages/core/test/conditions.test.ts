/**
 * Tests for the smart-prefilter condition module (conditions.ts).
 */
import { describe, expect, test } from 'vitest';
import {
  cloneCondition,
  compileCondition,
  describeCondition,
  emptyGroup,
  emptyRule,
  operatorsForType,
  validateCondition,
  DEFAULT_OPERATOR_LABELS,
  VALUELESS_OPERATORS
} from '@malkom/table-core';
import type {
  ConditionFieldInfo,
  ConditionGroup,
  ConditionNode,
  ConditionOperator,
  ConditionRule,
  GroupDescription,
  RuleDescription
} from '@malkom/table-core';

const ALL_OPERATORS: ConditionOperator[] = [
  'equals',
  'notEquals',
  'lessThan',
  'lessThanOrEqual',
  'greaterThan',
  'greaterThanOrEqual',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'oneOf',
  'empty',
  'notEmpty',
  'regex'
];

const fields: ConditionFieldInfo[] = [
  { field: 'name', label: 'Name', type: 'string' },
  { field: 'age', label: 'Age', type: 'number' },
  { field: 'joined', label: 'Joined', type: 'date' },
  { field: 'active', label: 'Active', type: 'boolean' },
  { field: 'user.city', label: 'City', type: 'string' }
];

const rule = (
  field: string,
  operator: ConditionOperator,
  value?: string
): ConditionRule => ({ kind: 'rule', field, operator, value });

const group = (
  logic: 'and' | 'or',
  ...children: ConditionNode[]
): ConditionGroup => ({ kind: 'group', logic, children });

/** Evaluate a single rule against a row using the shared field metadata. */
const evalRule = (
  field: string,
  operator: ConditionOperator,
  value: string | undefined,
  row: Record<string, unknown>
): boolean => compileCondition(group('and', rule(field, operator, value)), fields)(row);

// ---------------------------------------------------------------------------
// operatorsForType
// ---------------------------------------------------------------------------

describe('operatorsForType', () => {
  test('number fields get comparison and emptiness operators in display order', () => {
    expect(operatorsForType('number')).toEqual([
      'equals',
      'notEquals',
      'lessThan',
      'lessThanOrEqual',
      'greaterThan',
      'greaterThanOrEqual',
      'empty',
      'notEmpty'
    ]);
  });

  test('date fields get the same operator list as number fields', () => {
    expect(operatorsForType('date')).toEqual(operatorsForType('number'));
  });

  test('boolean fields only get equality and emptiness operators', () => {
    expect(operatorsForType('boolean')).toEqual([
      'equals',
      'notEquals',
      'empty',
      'notEmpty'
    ]);
  });

  test('string fields get the full text operator list in display order', () => {
    expect(operatorsForType('string')).toEqual([
      'contains',
      'notContains',
      'equals',
      'notEquals',
      'startsWith',
      'endsWith',
      'oneOf',
      'regex',
      'empty',
      'notEmpty'
    ]);
  });
});

// ---------------------------------------------------------------------------
// validateCondition
// ---------------------------------------------------------------------------

describe('validateCondition', () => {
  test('an empty root group is invalid with a "no conditions" error', () => {
    const result = validateCondition(emptyGroup(), fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Condition: group has no conditions.']);
  });

  test('an empty nested group is reported with its numbered path', () => {
    const root = group('and', rule('name', 'contains', 'x'), group('or'));
    const result = validateCondition(root, fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Condition > 2: group has no conditions.']);
  });

  test('a rule with no field asks to pick a field and reports nothing else', () => {
    const result = validateCondition(group('and', rule('', 'equals', '')), fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Condition > 1: pick a field.']);
  });

  test('a rule with an unknown field is flagged but value checks still run', () => {
    const result = validateCondition(group('and', rule('bogus', 'equals', '')), fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'Condition > 1: unknown field "bogus".',
      'Condition > 1: a value is required.'
    ]);
  });

  test('a rule with a missing operator asks to pick an operator', () => {
    const bad = { kind: 'rule', field: 'name', operator: '' } as unknown as ConditionRule;
    const result = validateCondition(group('and', bad), fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Condition > 1: pick an operator.']);
  });

  test('a value-taking operator with an undefined value requires a value', () => {
    const result = validateCondition(group('and', rule('name', 'contains')), fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Condition > 1: a value is required.']);
  });

  test('a whitespace-only value counts as missing', () => {
    const result = validateCondition(group('and', rule('name', 'equals', '   ')), fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Condition > 1: a value is required.']);
  });

  test('valueless operators empty and notEmpty do not require a value', () => {
    const root = group('and', rule('name', 'empty'), rule('age', 'notEmpty'));
    expect(validateCondition(root, fields)).toEqual({ valid: true, errors: [] });
  });

  test('an invalid regular expression value is rejected', () => {
    const result = validateCondition(group('and', rule('name', 'regex', '(')), fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Condition > 1: invalid regular expression.']);
  });

  test('a valid regular expression value passes', () => {
    const result = validateCondition(group('and', rule('name', 'regex', '[a-z]+')), fields);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('a valid nested tree passes with no errors', () => {
    const root = group(
      'and',
      rule('name', 'contains', 'al'),
      group('or', rule('age', 'greaterThan', '30'), rule('active', 'equals', 'yes'))
    );
    expect(validateCondition(root, fields)).toEqual({ valid: true, errors: [] });
  });

  test('errors in nested groups carry the full numbered path', () => {
    const root = group(
      'and',
      rule('name', 'contains', 'x'),
      group('or', rule('age', 'greaterThan', '1'), rule('', 'equals', 'v'))
    );
    const result = validateCondition(root, fields);
    expect(result.errors).toEqual(['Condition > 2 > 2: pick a field.']);
  });

  test('multiple broken rules all get reported', () => {
    const root = group('and', rule('', 'equals', 'x'), rule('name', 'equals', ''));
    const result = validateCondition(root, fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// compileCondition — string operators
// ---------------------------------------------------------------------------

describe('compileCondition on string fields', () => {
  test('equals is case-insensitive and trims both sides', () => {
    expect(evalRule('name', 'equals', 'alice', { name: '  ALICE  ' })).toBe(true);
    expect(evalRule('name', 'equals', '  Alice ', { name: 'alice' })).toBe(true);
    expect(evalRule('name', 'equals', 'alice', { name: 'bob' })).toBe(false);
  });

  test('equals treats null and undefined row values as empty strings', () => {
    expect(evalRule('name', 'equals', 'alice', { name: null })).toBe(false);
    expect(evalRule('name', 'equals', 'alice', {})).toBe(false);
  });

  test('notEquals is true for differing strings including against null', () => {
    expect(evalRule('name', 'notEquals', 'alice', { name: 'bob' })).toBe(true);
    expect(evalRule('name', 'notEquals', 'alice', { name: 'ALICE' })).toBe(false);
    expect(evalRule('name', 'notEquals', 'alice', { name: null })).toBe(true);
  });

  test('lessThan and greaterThan compare strings lexicographically', () => {
    expect(evalRule('name', 'lessThan', 'banana', { name: 'apple' })).toBe(true);
    expect(evalRule('name', 'lessThan', 'apple', { name: 'banana' })).toBe(false);
    expect(evalRule('name', 'greaterThan', 'apple', { name: 'banana' })).toBe(true);
    expect(evalRule('name', 'greaterThanOrEqual', 'apple', { name: 'APPLE' })).toBe(true);
    expect(evalRule('name', 'lessThanOrEqual', 'apple', { name: 'apple' })).toBe(true);
  });

  test('contains is case-insensitive and trims the rule value', () => {
    expect(evalRule('name', 'contains', ' WORLD ', { name: 'hello world' })).toBe(true);
    expect(evalRule('name', 'contains', 'mars', { name: 'hello world' })).toBe(false);
  });

  test('contains on a null row value only matches an effectively empty needle', () => {
    expect(evalRule('name', 'contains', 'x', { name: null })).toBe(false);
    expect(evalRule('name', 'contains', '  ', { name: null })).toBe(true);
  });

  test('notContains is the negation of contains', () => {
    expect(evalRule('name', 'notContains', 'mars', { name: 'hello world' })).toBe(true);
    expect(evalRule('name', 'notContains', 'World', { name: 'hello world' })).toBe(false);
    expect(evalRule('name', 'notContains', 'x', { name: null })).toBe(true);
  });

  test('startsWith and endsWith are case-insensitive and trim the rule value', () => {
    expect(evalRule('name', 'startsWith', ' HeLLo ', { name: 'hello world' })).toBe(true);
    expect(evalRule('name', 'startsWith', 'world', { name: 'hello world' })).toBe(false);
    expect(evalRule('name', 'endsWith', ' WORLD ', { name: 'hello world' })).toBe(true);
    expect(evalRule('name', 'endsWith', 'hello', { name: 'hello world' })).toBe(false);
  });

  test('oneOf matches a comma list with whitespace, case-insensitively', () => {
    expect(evalRule('name', 'oneOf', 'red , GREEN ,blue', { name: ' green ' })).toBe(true);
    expect(evalRule('name', 'oneOf', 'red, green, blue', { name: 'BLUE' })).toBe(true);
    expect(evalRule('name', 'oneOf', 'red, green, blue', { name: 'yellow' })).toBe(false);
  });

  test('oneOf ignores empty list entries so a null row value never matches', () => {
    expect(evalRule('name', 'oneOf', 'a,,b', { name: null })).toBe(false);
    expect(evalRule('name', 'oneOf', ' , ,', { name: '' })).toBe(false);
  });

  test('regex matches case-insensitively against the raw row string', () => {
    expect(evalRule('name', 'regex', '^he.*ld$', { name: 'Hello World' })).toBe(true);
    expect(evalRule('name', 'regex', '^\\d+$', { name: 'abc' })).toBe(false);
  });

  test('an invalid regex pattern evaluates to false instead of throwing', () => {
    expect(evalRule('name', 'regex', '(', { name: 'anything' })).toBe(false);
  });

  test('empty is true for null, undefined, empty and whitespace-only values', () => {
    expect(evalRule('name', 'empty', undefined, { name: null })).toBe(true);
    expect(evalRule('name', 'empty', undefined, {})).toBe(true);
    expect(evalRule('name', 'empty', undefined, { name: '' })).toBe(true);
    expect(evalRule('name', 'empty', undefined, { name: '   ' })).toBe(true);
    expect(evalRule('name', 'empty', undefined, { name: 'x' })).toBe(false);
  });

  test('empty is false for values that stringify to non-blank text like 0 and false', () => {
    expect(evalRule('age', 'empty', undefined, { age: 0 })).toBe(false);
    expect(evalRule('active', 'empty', undefined, { active: false })).toBe(false);
  });

  test('notEmpty is the negation of empty', () => {
    expect(evalRule('name', 'notEmpty', undefined, { name: 'x' })).toBe(true);
    expect(evalRule('name', 'notEmpty', undefined, { name: '  ' })).toBe(false);
    expect(evalRule('name', 'notEmpty', undefined, {})).toBe(false);
  });

  test('an unrecognized operator evaluates to false', () => {
    expect(
      evalRule('name', 'bogusOperator' as ConditionOperator, 'x', { name: 'x' })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// compileCondition — number operators
// ---------------------------------------------------------------------------

describe('compileCondition on number fields', () => {
  test('equals compares numerically and coerces numeric strings on both sides', () => {
    expect(evalRule('age', 'equals', '42', { age: 42 })).toBe(true);
    expect(evalRule('age', 'equals', ' 42 ', { age: '42' })).toBe(true);
    expect(evalRule('age', 'equals', '42', { age: '42.0' })).toBe(true);
    expect(evalRule('age', 'equals', '42', { age: 41 })).toBe(false);
  });

  test('a non-numeric row value makes every comparison false, including notEquals', () => {
    expect(evalRule('age', 'equals', '5', { age: 'abc' })).toBe(false);
    expect(evalRule('age', 'notEquals', '5', { age: 'abc' })).toBe(false);
    expect(evalRule('age', 'lessThan', '5', { age: 'abc' })).toBe(false);
    expect(evalRule('age', 'greaterThan', '5', { age: 'abc' })).toBe(false);
  });

  test('a non-numeric rule value makes every comparison false', () => {
    expect(evalRule('age', 'equals', 'abc', { age: 5 })).toBe(false);
    expect(evalRule('age', 'notEquals', 'abc', { age: 5 })).toBe(false);
  });

  test('a non-finite row value like Infinity or NaN compares as invalid', () => {
    expect(evalRule('age', 'equals', '1', { age: Infinity })).toBe(false);
    expect(evalRule('age', 'notEquals', '1', { age: NaN })).toBe(false);
  });

  test('ordering operators respect numeric order, not string order', () => {
    expect(evalRule('age', 'lessThan', '10', { age: 2 })).toBe(true);
    expect(evalRule('age', 'lessThan', '10', { age: '2' })).toBe(true);
    expect(evalRule('age', 'greaterThan', '9', { age: 10 })).toBe(true);
    expect(evalRule('age', 'lessThanOrEqual', '10', { age: 10 })).toBe(true);
    expect(evalRule('age', 'lessThanOrEqual', '10', { age: 11 })).toBe(false);
    expect(evalRule('age', 'greaterThanOrEqual', '10', { age: 10 })).toBe(true);
    expect(evalRule('age', 'greaterThanOrEqual', '10', { age: 9 })).toBe(false);
  });

  test('notEquals is true only when both sides are numeric and differ', () => {
    expect(evalRule('age', 'notEquals', '5', { age: 6 })).toBe(true);
    expect(evalRule('age', 'notEquals', '5', { age: 5 })).toBe(false);
  });

  test('negative and decimal numeric strings coerce correctly', () => {
    expect(evalRule('age', 'equals', '-1.5', { age: -1.5 })).toBe(true);
    expect(evalRule('age', 'greaterThan', '-2', { age: '-1.5' })).toBe(true);
  });

  test('null and missing row values coerce to 0 for numeric comparison', () => {
    // Number(String(null ?? '')) === 0, so a null cell equals the rule value "0".
    expect(evalRule('age', 'equals', '0', { age: null })).toBe(true);
    expect(evalRule('age', 'equals', '0', {})).toBe(true);
    expect(evalRule('age', 'lessThan', '1', { age: null })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// compileCondition — date operators
// ---------------------------------------------------------------------------

describe('compileCondition on date fields', () => {
  test('equals matches a YYYY-MM-DD rule input against an ISO row value', () => {
    expect(
      evalRule('joined', 'equals', '2024-01-15', { joined: '2024-01-15T00:00:00Z' })
    ).toBe(true);
    expect(evalRule('joined', 'equals', '2024-01-15', { joined: '2024-01-15' })).toBe(true);
    expect(evalRule('joined', 'equals', '2024-01-15', { joined: '2024-01-16' })).toBe(false);
  });

  test('a Date instance row value compares by its timestamp', () => {
    const d = new Date(Date.UTC(2024, 0, 15));
    expect(evalRule('joined', 'equals', '2024-01-15', { joined: d })).toBe(true);
    expect(evalRule('joined', 'greaterThan', '2024-01-14', { joined: d })).toBe(true);
  });

  test('a numeric epoch-millis row value compares by time', () => {
    const millis = Date.UTC(2024, 0, 15);
    expect(evalRule('joined', 'equals', '2024-01-15', { joined: millis })).toBe(true);
    expect(evalRule('joined', 'lessThan', '2024-01-16', { joined: millis })).toBe(true);
  });

  test('ordering operators respect chronological order', () => {
    expect(evalRule('joined', 'lessThan', '2024-02-01', { joined: '2024-01-15' })).toBe(true);
    expect(evalRule('joined', 'lessThan', '2024-01-01', { joined: '2024-01-15' })).toBe(false);
    expect(evalRule('joined', 'greaterThan', '2023-12-31', { joined: '2024-01-15' })).toBe(true);
    expect(
      evalRule('joined', 'greaterThanOrEqual', '2024-01-15', { joined: '2024-01-15' })
    ).toBe(true);
    expect(
      evalRule('joined', 'lessThanOrEqual', '2024-01-15', { joined: '2024-01-15' })
    ).toBe(true);
  });

  test('notEquals is true only when both sides parse and the dates differ', () => {
    expect(evalRule('joined', 'notEquals', '2024-01-15', { joined: '2024-01-16' })).toBe(true);
    expect(evalRule('joined', 'notEquals', '2024-01-15', { joined: '2024-01-15' })).toBe(false);
    expect(evalRule('joined', 'notEquals', '2024-01-15', { joined: 'not a date' })).toBe(false);
  });

  test('unparseable, null and invalid Date row values evaluate to false', () => {
    expect(evalRule('joined', 'equals', '2024-01-15', { joined: 'garbage' })).toBe(false);
    expect(evalRule('joined', 'lessThan', '2024-01-15', { joined: null })).toBe(false);
    expect(evalRule('joined', 'equals', '2024-01-15', {})).toBe(false);
    expect(
      evalRule('joined', 'equals', '2024-01-15', { joined: new Date('garbage') })
    ).toBe(false);
  });

  test('an unparseable rule value evaluates to false', () => {
    expect(evalRule('joined', 'equals', 'whenever', { joined: '2024-01-15' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// compileCondition — boolean operators
// ---------------------------------------------------------------------------

describe('compileCondition on boolean fields', () => {
  test('equals accepts the synonyms true/yes/1/y and false/no/0/n', () => {
    for (const truthy of ['true', 'yes', '1', 'y']) {
      expect(evalRule('active', 'equals', truthy, { active: true })).toBe(true);
      expect(evalRule('active', 'equals', truthy, { active: false })).toBe(false);
    }
    for (const falsy of ['false', 'no', '0', 'n']) {
      expect(evalRule('active', 'equals', falsy, { active: false })).toBe(true);
      expect(evalRule('active', 'equals', falsy, { active: true })).toBe(false);
    }
  });

  test('boolean synonyms are matched case-insensitively with surrounding whitespace', () => {
    expect(evalRule('active', 'equals', ' YES ', { active: true })).toBe(true);
    expect(evalRule('active', 'equals', 'No', { active: ' FALSE ' })).toBe(true);
  });

  test('row values that are synonym strings coerce to booleans', () => {
    expect(evalRule('active', 'equals', 'true', { active: '1' })).toBe(true);
    expect(evalRule('active', 'equals', 'false', { active: 'n' })).toBe(true);
    expect(evalRule('active', 'notEquals', 'yes', { active: '0' })).toBe(true);
  });

  test('notEquals is true only when both sides coerce and differ', () => {
    expect(evalRule('active', 'notEquals', 'yes', { active: false })).toBe(true);
    expect(evalRule('active', 'notEquals', 'yes', { active: true })).toBe(false);
    expect(evalRule('active', 'notEquals', 'yes', { active: 'maybe' })).toBe(false);
    expect(evalRule('active', 'notEquals', 'maybe', { active: true })).toBe(false);
  });

  test('null, missing and unrecognized row values never equal a boolean', () => {
    expect(evalRule('active', 'equals', 'true', { active: null })).toBe(false);
    expect(evalRule('active', 'equals', 'false', {})).toBe(false);
    expect(evalRule('active', 'equals', 'true', { active: 'maybe' })).toBe(false);
  });

  test('empty and notEmpty work on boolean fields', () => {
    expect(evalRule('active', 'empty', undefined, { active: null })).toBe(true);
    expect(evalRule('active', 'notEmpty', undefined, { active: false })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// compileCondition — structure: paths, groups, unknown fields
// ---------------------------------------------------------------------------

describe('compileCondition structure', () => {
  test('dot-path fields read nested row values', () => {
    const row = { user: { city: 'Paris' } };
    expect(evalRule('user.city', 'equals', 'paris', row)).toBe(true);
    expect(evalRule('user.city', 'equals', 'lyon', row)).toBe(false);
  });

  test('dot-path fields with a missing or non-object segment read as empty', () => {
    expect(evalRule('user.city', 'empty', undefined, {})).toBe(true);
    expect(evalRule('user.city', 'empty', undefined, { user: null })).toBe(true);
    expect(evalRule('user.city', 'empty', undefined, { user: 'Paris' })).toBe(true);
    expect(evalRule('user.city', 'contains', 'paris', { user: 42 })).toBe(false);
  });

  test('unknown fields evaluate with string semantics', () => {
    // 2 < 10 numerically, but "2" > "10" lexicographically — proving the
    // unknown field falls back to string comparison.
    const root = group('and', rule('mystery', 'lessThan', '10'));
    const predicate = compileCondition(root, fields);
    expect(predicate({ mystery: 2 })).toBe(false);
    expect(predicate({ mystery: '2' })).toBe(false);
    expect(compileCondition(group('and', rule('mystery', 'equals', '2')), fields)({ mystery: 2 })).toBe(true);
  });

  test('an AND group requires every child to match', () => {
    const root = group('and', rule('name', 'contains', 'a'), rule('age', 'greaterThan', '30'));
    const predicate = compileCondition(root, fields);
    expect(predicate({ name: 'alice', age: 35 })).toBe(true);
    expect(predicate({ name: 'alice', age: 20 })).toBe(false);
    expect(predicate({ name: 'bob', age: 35 })).toBe(false);
  });

  test('an OR group requires at least one child to match', () => {
    const root = group('or', rule('name', 'equals', 'alice'), rule('age', 'lessThan', '18'));
    const predicate = compileCondition(root, fields);
    expect(predicate({ name: 'alice', age: 99 })).toBe(true);
    expect(predicate({ name: 'zed', age: 10 })).toBe(true);
    expect(predicate({ name: 'zed', age: 99 })).toBe(false);
  });

  test('nested AND/OR groups combine correctly', () => {
    const root = group(
      'and',
      rule('active', 'equals', 'yes'),
      group('or', rule('age', 'greaterThan', '60'), rule('name', 'startsWith', 'a'))
    );
    const predicate = compileCondition(root, fields);
    expect(predicate({ active: true, age: 65, name: 'zed' })).toBe(true);
    expect(predicate({ active: true, age: 30, name: 'alice' })).toBe(true);
    expect(predicate({ active: true, age: 30, name: 'zed' })).toBe(false);
    expect(predicate({ active: false, age: 65, name: 'alice' })).toBe(false);
  });

  test('an empty root group matches every row', () => {
    const predicate = compileCondition(emptyGroup(), fields);
    expect(predicate({})).toBe(true);
    expect(predicate({ name: 'anything' })).toBe(true);
  });

  test('an empty nested group is vacuously true inside AND and OR parents', () => {
    const andRoot = group('and', rule('name', 'equals', 'alice'), group('or'));
    const andPredicate = compileCondition(andRoot, fields);
    expect(andPredicate({ name: 'alice' })).toBe(true);
    expect(andPredicate({ name: 'bob' })).toBe(false);

    // Inside an OR the vacuously-true empty group makes the whole group match.
    const orRoot = group('or', rule('name', 'equals', 'alice'), group('and'));
    expect(compileCondition(orRoot, fields)({ name: 'nobody' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// describeCondition
// ---------------------------------------------------------------------------

describe('describeCondition', () => {
  test('a rule maps to its field label, default operator label and trimmed value', () => {
    const description = describeCondition(rule('name', 'contains', '  al  '), fields);
    expect(description).toEqual({
      type: 'rule',
      fieldLabel: 'Name',
      operatorLabel: 'contains',
      value: 'al',
      hasValue: true
    });
  });

  test('an unknown field falls back to the raw field name as its label', () => {
    const description = describeCondition(rule('mystery', 'equals', 'x'), fields) as RuleDescription;
    expect(description.fieldLabel).toBe('mystery');
  });

  test('valueless operators get hasValue false, value-taking operators true', () => {
    for (const op of ALL_OPERATORS) {
      const description = describeCondition(rule('name', op, 'v'), fields) as RuleDescription;
      expect(description.hasValue).toBe(!VALUELESS_OPERATORS.has(op));
    }
  });

  test('an undefined value describes as an empty string', () => {
    const description = describeCondition(rule('name', 'empty'), fields) as RuleDescription;
    expect(description.value).toBe('');
  });

  test('operator label overrides win over the defaults, others keep defaults', () => {
    const root = group('and', rule('name', 'equals', 'x'), rule('age', 'lessThan', '5'));
    const description = describeCondition(root, fields, {
      equals: 'IS EXACTLY'
    }) as GroupDescription;
    const [first, second] = description.children as RuleDescription[];
    expect(first.operatorLabel).toBe('IS EXACTLY');
    expect(second.operatorLabel).toBe('is less than');
  });

  test('an operator with no label anywhere falls back to its raw name', () => {
    const description = describeCondition(
      rule('name', 'weirdOp' as ConditionOperator, 'v'),
      fields
    ) as RuleDescription;
    expect(description.operatorLabel).toBe('weirdOp');
  });

  test('groups recurse and preserve logic and child order', () => {
    const root = group(
      'or',
      rule('active', 'notEmpty'),
      group('and', rule('joined', 'greaterThan', '2024-01-01'))
    );
    const description = describeCondition(root, fields) as GroupDescription;
    expect(description.type).toBe('group');
    expect(description.logic).toBe('or');
    expect(description.children).toHaveLength(2);
    expect(description.children[0]).toEqual({
      type: 'rule',
      fieldLabel: 'Active',
      operatorLabel: 'is not empty',
      value: '',
      hasValue: false
    });
    const inner = description.children[1] as GroupDescription;
    expect(inner.logic).toBe('and');
    expect((inner.children[0] as RuleDescription).fieldLabel).toBe('Joined');
  });
});

// ---------------------------------------------------------------------------
// cloneCondition
// ---------------------------------------------------------------------------

describe('cloneCondition', () => {
  test('the clone is structurally equal but shares no references', () => {
    const original = group(
      'and',
      rule('name', 'contains', 'x'),
      group('or', rule('age', 'lessThan', '5'))
    );
    const copy = cloneCondition(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.children).not.toBe(original.children);
    expect(copy.children[1]).not.toBe(original.children[1]);
  });

  test('mutating the clone leaves the original untouched', () => {
    const original = group('and', rule('name', 'equals', 'before'), group('or'));
    const copy = cloneCondition(original);
    (copy.children[0] as ConditionRule).value = 'after';
    (copy.children[1] as ConditionGroup).children.push(rule('age', 'empty'));
    copy.logic = 'or';
    expect((original.children[0] as ConditionRule).value).toBe('before');
    expect((original.children[1] as ConditionGroup).children).toHaveLength(0);
    expect(original.logic).toBe('and');
  });

  test('cloning a bare rule works too', () => {
    const original = rule('name', 'oneOf', 'a,b');
    const copy = cloneCondition(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Labels and helpers
// ---------------------------------------------------------------------------

describe('DEFAULT_OPERATOR_LABELS and helpers', () => {
  test('every operator has a non-empty default label and no extras exist', () => {
    for (const op of ALL_OPERATORS) {
      expect(typeof DEFAULT_OPERATOR_LABELS[op]).toBe('string');
      expect(DEFAULT_OPERATOR_LABELS[op].length).toBeGreaterThan(0);
    }
    expect(Object.keys(DEFAULT_OPERATOR_LABELS).sort()).toEqual([...ALL_OPERATORS].sort());
  });

  test('VALUELESS_OPERATORS contains exactly empty and notEmpty', () => {
    expect(VALUELESS_OPERATORS.size).toBe(2);
    expect(VALUELESS_OPERATORS.has('empty')).toBe(true);
    expect(VALUELESS_OPERATORS.has('notEmpty')).toBe(true);
  });

  test('emptyGroup defaults to AND logic with no children', () => {
    expect(emptyGroup()).toEqual({ kind: 'group', logic: 'and', children: [] });
    expect(emptyGroup('or').logic).toBe('or');
  });

  test('emptyRule defaults to a contains rule with an empty value', () => {
    expect(emptyRule()).toEqual({ kind: 'rule', field: '', operator: 'contains', value: '' });
    expect(emptyRule('name').field).toBe('name');
  });
});
