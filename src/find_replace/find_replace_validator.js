export function validateBeforeApply(source, operations) {
  const errors = [];

  for (const op of operations) {
    const count = source.split(op.findText).length - 1;
    if (count === 0) {
      errors.push(`No match found for ${op.findText}`);
    }
  }

  return {
    pass: errors.length === 0,
    errors
  };
}

export function validateAfterApply(expected, actual) {
  return {
    pass: expected === actual,
    errors: expected === actual ? [] : ['Output validation mismatch']
  };
}
