// Aggregation expressions that read a line's quantity in base units.
//
// Lines saved before package units existed carry no baseQuantity or baseUnit;
// they were always recorded in the base unit, so quantity and unit stand in.
// Mirrors lineBaseQuantity in lib/utils/units.ts.

// `line` is the aggregation path of the line, e.g. "$items", "$returnItems",
// "$$item", or "$" for a top-level receipt document.
function field(line: string, name: string) {
  return line === "$" ? `$${name}` : `${line}.${name}`
}

export function baseQuantityExpr(line: string) {
  return { $ifNull: [field(line, "baseQuantity"), field(line, "quantity")] }
}

export function baseUnitExpr(line: string) {
  return { $ifNull: [field(line, "baseUnit"), field(line, "unit")] }
}
