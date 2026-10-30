export type MarkdownImageDefinition = {
  destination: string;
  title?: string;
  destinationStart: number;
  destinationEnd: number;
};

export type MarkdownImage = MarkdownImageDefinition & {
  start: number;
  end: number;
  alt: string;
};

const unescapeMarkdown = (value: string) => value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1");
const referenceKey = (value: string) => unescapeMarkdown(value).trim().replace(/\s+/g, " ").toLowerCase();

/** Split table delimiters before unescaping pipes, respecting backslash parity. */
export function markdownTableCells(row: string): string[] {
  const source = row.trim();
  const cells: string[] = [];
  let cell = "";
  let lastWasDelimiter = false;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\\") {
      const start = index;
      while (source[index] === "\\") index += 1;
      const count = index - start;
      if (source[index] === "|" && count % 2 === 1) {
        cell += "\\".repeat(count - 1) + "|";
        lastWasDelimiter = false;
        continue;
      }
      cell += "\\".repeat(count);
      index -= 1;
      lastWasDelimiter = false;
      continue;
    }
    if (source[index] === "|") {
      cells.push(cell.trim());
      cell = "";
      lastWasDelimiter = true;
    } else {
      cell += source[index];
      lastWasDelimiter = false;
    }
  }
  cells.push(cell.trim());
  if (source.startsWith("|")) cells.shift();
  if (lastWasDelimiter) cells.pop();
  return cells;
}

function bracketEnd(source: string, start: number): number | null {
  if (source[start] !== "[") return null;
  let depth = 1;
  // Bound malformed label work when a large import contains repeated unmatched ![.
  const limit = Math.min(source.length, start + 4097);
  for (let index = start + 1; index < limit; index += 1) {
    if (source[index] === "\\") { index += 1; continue; }
    if (source[index] === "[" && ++depth > 32) return null;
    if (source[index] === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

function skipSpace(source: string, start: number): number {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function readDestination(source: string, start: number): (MarkdownImageDefinition & { end: number }) | null {
  let index = start;
  const angle = source[index] === "<";
  const destinationStart = angle ? ++index : index;
  let depth = 0;
  for (; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) { index += 1; continue; }
    if (angle) {
      if (char === "\n" || char === "\r" || char === "<") return null;
      if (char === ">") break;
    } else {
      if (/\s/.test(char) || (char === ")" && depth === 0)) break;
      if (char === "(" && ++depth > 32) return null;
      if (char === ")") depth -= 1;
      if (char === "<" || /[\u0000-\u001f]/.test(char)) return null;
    }
  }
  if (depth !== 0 || (angle && source[index] !== ">")) return null;
  return {
    destination: unescapeMarkdown(source.slice(destinationStart, index)),
    destinationStart,
    destinationEnd: index,
    end: angle ? index + 1 : index,
  };
}

function readTitle(source: string, start: number): { title: string; end: number } | null {
  const opener = source[start];
  const closer = opener === "(" ? ")" : opener;
  if (opener !== '"' && opener !== "'" && opener !== "(") return null;
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") { index += 1; continue; }
    if (source[index] === closer) return { title: unescapeMarkdown(source.slice(start + 1, index)), end: index + 1 };
    if (source[index] === "\n" && source[index + 1] === "\n") return null;
  }
  return null;
}

/** Parse one image without treating its URL/title as executable markup. */
export function parseMarkdownImageAt(
  source: string,
  start: number,
  definitions: ReadonlyMap<string, MarkdownImageDefinition> = new Map(),
): MarkdownImage | null {
  if (source.slice(start, start + 2) !== "![") return null;
  const labelEnd = bracketEnd(source, start + 1);
  if (labelEnd === null) return null;
  const label = source.slice(start + 2, labelEnd);
  const alt = unescapeMarkdown(label).replace(/\s+/g, " ");
  let index = labelEnd + 1;
  if (source[index] === "(") {
    const destination = readDestination(source, skipSpace(source, index + 1));
    if (!destination) return null;
    index = skipSpace(source, destination.end);
    let title: string | undefined;
    if (source[index] !== ")") {
      if (index === destination.end) return null;
      const parsedTitle = readTitle(source, index);
      if (!parsedTitle) return null;
      title = parsedTitle.title;
      index = skipSpace(source, parsedTitle.end);
    }
    if (source[index] !== ")") return null;
    return { ...destination, start, end: index + 1, alt, title };
  }

  let key = label;
  if (source[index] === "[") {
    const referenceEnd = bracketEnd(source, index);
    if (referenceEnd === null) return null;
    key = source.slice(index + 1, referenceEnd) || label;
    index = referenceEnd + 1;
  }
  const definition = definitions.get(referenceKey(key));
  return definition ? { ...definition, start, end: index, alt } : null;
}

function fence(line: string): { marker: string; length: number } | null {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
  return match ? { marker: match[1][0], length: match[1].length } : null;
}

function codeSpanEnd(source: string, start: number): number | null {
  const run = source.slice(start).match(/^`+/)?.[0];
  if (!run) return null;
  let close = source.indexOf(run, start + run.length);
  while (close >= 0 && (source[close - 1] === "`" || source[close + run.length] === "`")) {
    close = source.indexOf(run, close + run.length);
  }
  // An inline code span cannot continue into the next paragraph.
  return close >= 0 && !/\n[ \t]*\r?\n/.test(source.slice(start, close)) ? close + run.length : null;
}

/** Remove valid reference definitions from displayed prose, preserving offsets. */
export function collectMarkdownImageDefinitions(source: string): {
  definitions: Map<string, MarkdownImageDefinition>;
  content: string;
} {
  const definitions = new Map<string, MarkdownImageDefinition>();
  const lines = source.match(/[^\n]*(?:\n|$)/g) || [];
  const content: string[] = [];
  let offset = 0;
  let inlineCodeThrough = 0;
  let activeFence: { marker: string; length: number } | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const marker = fence(line);
    if (activeFence) {
      if (marker && marker.marker === activeFence.marker && marker.length >= activeFence.length &&
          /^ {0,3}(?:`+|~+)\s*$/.test(line)) activeFence = null;
      content.push(line); offset += line.length; continue;
    }
    if (marker) {
      activeFence = marker;
      content.push(line); offset += line.length; continue;
    }

    const leading = line.match(/^ {0,3}(?=\[)/)?.[0].length;
    const end = leading === undefined ? null : bracketEnd(line, leading);
    let definition: MarkdownImageDefinition | null = null;
    let titleLine = "";
    if (offset >= inlineCodeThrough && leading !== undefined && end !== null && line[end + 1] === ":") {
      const destination = readDestination(line, skipSpace(line, end + 2));
      if (destination && destination.destination) {
        let rest = skipSpace(line, destination.end);
        let title: string | undefined;
        if (rest < line.trimEnd().length && rest > destination.end) {
          const parsedTitle = readTitle(line, rest);
          if (parsedTitle) { title = parsedTitle.title; rest = skipSpace(line, parsedTitle.end); }
        }
        if (rest === line.length) {
          const nextLine = lines[lineIndex + 1];
          if (title === undefined && nextLine && /^ {0,3}["'(]/.test(nextLine)) {
            const parsedTitle = readTitle(nextLine, skipSpace(nextLine, 0));
            if (parsedTitle && skipSpace(nextLine, parsedTitle.end) === nextLine.length) {
              title = parsedTitle.title;
              titleLine = nextLine;
            }
          }
          definition = {
            destination: destination.destination, title,
            destinationStart: offset + destination.destinationStart,
            destinationEnd: offset + destination.destinationEnd,
          };
          const key = referenceKey(line.slice(leading + 1, end));
          if (key && !definitions.has(key)) definitions.set(key, definition);
        }
      }
    }
    content.push(definition ? line.replace(/[^\r\n]/g, " ") : line);
    if (!definition) {
      for (let index = Math.max(offset, inlineCodeThrough); index < offset + line.length; index += 1) {
        if (source[index] === "\\") { index += 1; continue; }
        if (source[index] === "`") {
          const end = codeSpanEnd(source, index);
          if (end !== null) { inlineCodeThrough = end; index = end - 1; }
          else index += source.slice(index).match(/^`+/)![0].length - 1;
        }
      }
    }
    offset += line.length;
    if (titleLine) {
      content.push(titleLine.replace(/[^\r\n]/g, " "));
      offset += titleLine.length;
      lineIndex += 1;
    }
  }
  return { definitions, content: content.join("") };
}

/** Find uploadable image references, excluding fenced/indented/inline code and escapes. */
export function findMarkdownImages(source: string): MarkdownImage[] {
  const { definitions, content } = collectMarkdownImageDefinitions(source);
  const images: MarkdownImage[] = [];
  let activeFence: { marker: string; length: number } | null = null;
  for (let index = 0; index < content.length;) {
    if (index === 0 || content[index - 1] === "\n") {
      const nextLine = content.indexOf("\n", index);
      const end = nextLine < 0 ? content.length : nextLine + 1;
      const line = content.slice(index, end);
      const marker = fence(line);
      if (activeFence) {
        if (marker && marker.marker === activeFence.marker && marker.length >= activeFence.length &&
            /^ {0,3}(?:`+|~+)\s*$/.test(line)) activeFence = null;
        index = end; continue;
      }
      if (marker) { activeFence = marker; index = end; continue; }
      if (/^(?: {4}|\t)/.test(line)) { index = end; continue; }
    }
    if (content[index] === "\\") { index += 2; continue; }
    if (content[index] === "`") {
      const run = content.slice(index).match(/^`+/)![0];
      index = codeSpanEnd(content, index) ?? index + run.length;
      continue;
    }
    const image = parseMarkdownImageAt(content, index, definitions);
    if (image) { images.push(image); index = image.end; }
    else index += 1;
  }
  return images;
}
