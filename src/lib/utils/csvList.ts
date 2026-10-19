/** Format an editable CSV list without losing commas, quotes, or line breaks in values. */
export function formatCsvList(values: string[]): string {
  return values.map((value) => {
    if (!value || /[",\r\n]/.test(value) || /^\s|\s$/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }).join(", ");
}

/** Read comma-separated values, including fields escaped with standard CSV quotes. */
export function parseCsvList(source: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  let inQuotes = false;
  let afterQuote = false;

  const appendValue = () => {
    const normalized = quoted ? value : value.trim();
    if (normalized || quoted) values.push(normalized);
    value = "";
    quoted = false;
    afterQuote = false;
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inQuotes) {
      if (character !== '"') {
        value += character;
      } else if (source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = false;
        afterQuote = true;
      }
    } else if (character === ",") {
      appendValue();
    } else if (character === '"' && !quoted && !value.trim()) {
      value = "";
      quoted = true;
      inQuotes = true;
    } else if (!afterQuote || !/\s/.test(character)) {
      value += character;
    }
  }

  appendValue();
  return values;
}
