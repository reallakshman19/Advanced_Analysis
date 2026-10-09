export class ReplaceTransaction {
  constructor(sourceHash = null) {
    this.sourceHash = sourceHash;
    this.operations = [];
    this.validation = {
      before: false,
      after: false,
      errors: []
    };
  }

  addOperation(operation) {
    this.operations.push({
      scope: operation.scope,
      from: operation.from ?? null,
      to: operation.to ?? null,
      block: operation.block ?? null,
      findText: operation.findText,
      replaceText: operation.replaceText
    });
  }
}
