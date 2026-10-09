import { canonicalNumber, maxAbs } from './numeric.js';

export const PLANAR_TRANSLATION_NULLSPACE_SCHEMA = 'planar-translation-nullspace/v1';
export const PLANAR_TRANSLATION_NULLSPACE_METHOD = 'SYMMETRIC_DEPENDENT_NODE_BLOCK_RECONSTRUCTION_V1';

const CORRECTION_EPSILON_FACTOR = 4096;

/**
 * Restore the two exact rigid translations of a 2-D displacement element
 * without changing its retained independent/deformational block.
 *
 * DOFs are ordered [UX1, UY1, UX2, UY2, ...]. The first node is treated as
 * the dependent translation node. If H is the retained block for all other
 * DOFs and R maps the dependent [UX, UY] translation to those DOFs, the
 * reconstructed symmetric matrix is
 *
 *   K = [ R^T H R   -R^T H ]
 *       [   -H R        H   ]
 *
 * so K*[1,0,1,0,...]^T = 0 and K*[0,1,0,1,...]^T = 0 by construction.
 * This is a floating-point representation repair only: a roundoff-scale
 * correction limit rejects matrices that are not already physically
 * translation invariant.
 */
export function preservePlanarTranslationNullspace(input) {
  const matrix = requireMatrix(input);
  const size = matrix.length;
  const retainedIndices = Array.from({ length: size - 2 }, (_, index) => index + 2);

  const retained = retainedIndices.map((rowIndex, row) => retainedIndices.map(
    (columnIndex, column) => symmetricAverage(
      matrix[rowIndex][columnIndex],
      matrix[columnIndex][rowIndex],
      `translation-nullspace retained ${row}:${column}`,
    ),
  ));

  const coupling = retained.map((row, retainedRow) => [0, 1].map((axis) => -compensatedSum(
    row.filter((_, retainedColumn) => retainedIndices[retainedColumn] % 2 === axis),
  )));

  const dependent = [0, 1].map((rowAxis) => [0, 1].map((columnAxis) => compensatedSum(
    retained
      .filter((_, retainedRow) => retainedIndices[retainedRow] % 2 === rowAxis)
      .flatMap((row) => row.filter(
        (_, retainedColumn) => retainedIndices[retainedColumn] % 2 === columnAxis,
      )),
  )));

  // Force the tiny cross-term disagreement from independent compensated sums
  // to one symmetric value before publishing the matrix.
  const cross = symmetricAverage(
    dependent[0][1], dependent[1][0], 'translation-nullspace dependent cross term',
  );
  dependent[0][1] = cross;
  dependent[1][0] = cross;

  const output = Array.from({ length: size }, () => Array(size).fill(0));
  output[0][0] = dependent[0][0];
  output[0][1] = dependent[0][1];
  output[1][0] = dependent[1][0];
  output[1][1] = dependent[1][1];

  retainedIndices.forEach((globalRow, retainedRow) => {
    output[globalRow][0] = coupling[retainedRow][0];
    output[globalRow][1] = coupling[retainedRow][1];
    output[0][globalRow] = coupling[retainedRow][0];
    output[1][globalRow] = coupling[retainedRow][1];
    retainedIndices.forEach((globalColumn, retainedColumn) => {
      output[globalRow][globalColumn] = retained[retainedRow][retainedColumn];
    });
  });

  const stiffnessScale = Math.max(1, maxAbs(matrix));
  const maximumCorrection = maxAbs(output.map((row, i) => row.map(
    (value, j) => value - matrix[i][j],
  )));
  const relativeCorrection = maximumCorrection / stiffnessScale;
  const correctionLimit = CORRECTION_EPSILON_FACTOR * Number.EPSILON * size;
  if (!(relativeCorrection <= correctionLimit)) {
    const error = new Error(
      `LAFEA_BBAR_TRANSLATION_NULLSPACE_CORRECTION_EXCEEDS_ROUNDOFF_ENVELOPE: ${relativeCorrection} > ${correctionLimit}`,
    );
    error.code = 'LAFEA_BBAR_TRANSLATION_NULLSPACE_CORRECTION_EXCEEDS_ROUNDOFF_ENVELOPE';
    throw error;
  }

  const xTranslation = translationVector(size, 0);
  const yTranslation = translationVector(size, 1);
  const beforeX = maxAbs(matrixVectorCompensated(matrix, xTranslation));
  const beforeY = maxAbs(matrixVectorCompensated(matrix, yTranslation));
  const afterX = maxAbs(matrixVectorCompensated(output, xTranslation));
  const afterY = maxAbs(matrixVectorCompensated(output, yTranslation));

  return Object.freeze({
    stiffness: Object.freeze(output.map((row) => Object.freeze(
      row.map((value) => canonicalNumber(value, 'translation-nullspace stiffness')),
    ))),
    evidence: Object.freeze({
      schema: PLANAR_TRANSLATION_NULLSPACE_SCHEMA,
      method: PLANAR_TRANSLATION_NULLSPACE_METHOD,
      dependentDofIndices: Object.freeze([0, 1]),
      retainedDofCount: size - 2,
      stiffnessScale: canonicalNumber(stiffnessScale),
      maximumCorrection: canonicalNumber(maximumCorrection),
      relativeCorrection: canonicalNumber(relativeCorrection),
      correctionLimit: canonicalNumber(correctionLimit),
      beforeTranslationResidualInfinity: Object.freeze({
        UX: canonicalNumber(beforeX),
        UY: canonicalNumber(beforeY),
      }),
      afterTranslationResidualInfinity: Object.freeze({
        UX: canonicalNumber(afterX),
        UY: canonicalNumber(afterY),
      }),
      physicalFormulationChanged: false,
      rotationProjected: false,
    }),
  });
}

function requireMatrix(input) {
  if (!Array.isArray(input) || input.length < 4 || input.length % 2 !== 0
    || input.some((row) => !Array.isArray(row) || row.length !== input.length
      || row.some((value) => !Number.isFinite(value)))) {
    throw new TypeError('Planar translation nullspace reconstruction requires a finite even square matrix.');
  }
  return input;
}

function translationVector(size, axis) {
  return Array.from({ length: size }, (_, index) => index % 2 === axis ? 1 : 0);
}

function matrixVectorCompensated(matrix, vector) {
  return matrix.map((row) => compensatedSum(row.map((value, index) => value * vector[index])));
}

function symmetricAverage(left, right, path) {
  return canonicalNumber(left + (right - left) / 2, path);
}

function compensatedSum(values) {
  let sum = 0;
  let compensation = 0;
  for (const value of values) {
    const next = sum + value;
    compensation += Math.abs(sum) >= Math.abs(value)
      ? (sum - next) + value
      : (value - next) + sum;
    sum = next;
  }
  return sum + compensation;
}
