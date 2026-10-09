# XML Compare Utilities CII integration — v14 priority

## Objective

Integrate Find & Replace transaction workflow with XML_Compare_Utilities CII capabilities without modifying existing Writer ownership paths.

## Priority

V14 is the first target.

## Ownership boundary

XML_Compare_Utilities CII owns:

- XML comparison primitives
- XML structural identity detection
- CII change classification
- source/target XML evidence

Advanced_Analysis Find Replace owns:

- user transaction intent
- CSV import
- preview
- validation gate
- apply approval
- audit report

## Proposed flow

Input XML v14
  -> CII compare adapter
  -> canonical change candidates
  -> FindReplace transaction model
  -> preview
  -> validation
  -> controlled writer execution

## Safety rules

1. Never directly edit XML source from CII output.
2. Every CII candidate becomes an immutable transaction operation.
3. Before/after hashes are mandatory.
4. Writer modules remain unchanged.
5. Unsupported XML structures fail closed.

## V14 first adapters

Initial adapters:

- node name replacement
- attribute value replacement
- block scoped replacement
- element scoped replacement

Deferred:

- cross-version migration rules
- semantic merge
- automatic conflict resolution

## Next implementation

Add CII adapter layer:

src/find_replace/adapters/
  cii_v14_adapter.js
  cii_change_mapper.js
  cii_validation_bridge.js
