import React from "react";

export function safeHref(value: string): string | undefined {
  if (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value) || /^#[\w-]+$/.test(value)) return value;
  return undefined;
}

function inline(text: string): React.ReactNode[] {
  return text.split(/(!?\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, i) => {
    const link = part.match(/^(!?)\[([^\]]*)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeHref(link[3]);
      if (!href) return <span key={i}>{link[2]}</span>;
      if (link[1]) return <a key={i} href={href} target="_blank" rel="noopener noreferrer">{link[2] || "View image"}</a>;
      return <a key={i} href={href} rel="noopener noreferrer" className="text-blue-700 underline">{link[2]}</a>;
    }
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if (part.startsWith("`")) return <code key={i}>{part.slice(1,-1)}</code>;
    if (part.startsWith("*")) return <em key={i}>{part.slice(1,-1)}</em>;
    return part;
  });
}

type Edge = { from: string; to: string; label: string };
export function parseFlow(source: string): { nodes: [string,string][]; edges: Edge[] } | null {
  const lines = source.trim().split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!/^(flowchart|graph) (TD|TB|LR)$/.test(lines.shift() || "")) return null;
  const nodes = new Map<string,string>(); const edges: Edge[] = [];
  const endpoint = (value: string) => {
    const m = value.trim().match(/^([A-Za-z]\w*)(?:\[([^\]<>]{1,100})\])?$/);
    if (!m) return null;
    if (!nodes.has(m[1]) || m[2]) nodes.set(m[1], m[2] || m[1]);
    return m[1];
  };
  for (const line of lines) {
    const m = line.match(/^(.+?)\s*-->(?:\|([^|<>]{1,60})\|)?\s*(.+?)\s*;?$/);
    if (!m) { if (!endpoint(line)) return null; continue; }
    const from = endpoint(m[1]), to = endpoint(m[3]);
    if (!from || !to || from === to) return null;
    edges.push({ from, to, label: m[2] || "" });
  }
  if (!edges.length || nodes.size > 16) return null;
  return { nodes: [...nodes], edges };
}

function Flow({ source }: { source: string }) {
  const flow = parseFlow(source);
  if (!flow) return <div role="note"><p>Diagram syntax is not supported by the safe flow renderer. Revise before publishing.</p><pre>{source}</pre></div>;
  const h = flow.nodes.length * 110;
  const index = (id: string) => flow.nodes.findIndex(([key]) => key === id);
  return <figure className="my-6 overflow-x-auto rounded border p-3">
    <svg role="img" aria-label="Data flow diagram; connections described below" viewBox={`0 0 660 ${h}`} style={{ width: "100%", maxHeight: h }}>
      {flow.edges.map((edge,i) => {
        const y1 = index(edge.from)*110+65, y2 = index(edge.to)*110+15;
        const adjacent = index(edge.to) === index(edge.from)+1;
        return <g key={i} fill="none" stroke="#475569" strokeWidth="2">
          <path d={adjacent ? `M330 ${y1} L330 ${y2-6}` : `M510 ${y1-25} C610 ${y1-25} 610 ${y2+25} 510 ${y2+25}`} />
          {adjacent ? <path d={`M325 ${y2-12} L330 ${y2-6} L335 ${y2-12}`} /> : <path d={`M518 ${y2+20} L510 ${y2+25} L518 ${y2+30}`} />}
          {adjacent && <text x="340" y={(y1+y2)/2+4} stroke="none" fill="#334155" fontSize="13">{edge.label}</text>}
        </g>;
      })}
      {flow.nodes.map(([id,label], i) => <g key={id}><rect x="150" y={i*110+15} width="360" height="50" rx="8" fill="#eff6ff" stroke="#93c5fd"/><text x="330" y={i*110+45} textAnchor="middle" fill="#0f172a" fontSize={label.length > 42 ? "11" : "14"}>{label}</text></g>)}
    </svg>
    <figcaption className="text-sm text-gray-600">{flow.edges.map(e => `${flow.nodes[index(e.from)][1]} → ${flow.nodes[index(e.to)][1]}${e.label ? ` (${e.label})` : ""}`).join("; ")}</figcaption>
  </figure>;
}

export default function ArticleMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g,"\n").split("\n"), blocks: React.ReactNode[] = [];
  let i = 0;
  const cells = (s: string) => s.trim().replace(/^\||\|$/g,"").split("|").map(x=>x.trim());
  while (i < lines.length) {
    const line = lines[i].trim(), key = i;
    if (!line) { i++; continue; }
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim(); const code: string[] = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(lang === "mermaid" ? <Flow key={key} source={code.join("\n")} /> : <pre key={key} className="my-4 overflow-x-auto rounded bg-gray-100 p-4"><code>{code.join("\n")}</code></pre>); continue;
    }
    if (line.includes("|") && i+1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i+1].trim())) {
      const headings = cells(line); i+=2; const rows: string[][] = [];
      while (i<lines.length && lines[i].includes("|")) rows.push(cells(lines[i++]));
      blocks.push(<div key={key} className="my-5 overflow-x-auto"><table className="w-full border-collapse"><thead><tr>{headings.map((c,j)=><th className="border p-2 text-left" key={j}>{inline(c)}</th>)}</tr></thead><tbody>{rows.map((r,j)=><tr key={j}>{r.map((c,k)=><td className="border p-2 align-top" key={k}>{inline(c)}</td>)}</tr>)}</tbody></table></div>); continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { blocks.push(React.createElement(`h${heading[1].length}`,{key,className:"mt-6 mb-3 text-xl font-semibold"},inline(heading[2]))); i++; continue; }
    if (/^([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\d/.test(line), items: string[] = [];
      const pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (i<lines.length && pattern.test(lines[i].trim())) items.push(lines[i++].trim().replace(pattern,""));
      blocks.push(React.createElement(ordered?"ol":"ul",{key,className:`my-4 pl-6 ${ordered?"list-decimal":"list-disc"}`},items.map((t,j)=><li key={j}>{inline(t)}</li>))); continue;
    }
    if (/^---+$/.test(line)) { blocks.push(<hr key={key}/>); i++; continue; }
    if (line.startsWith("> ")) { blocks.push(<blockquote key={key} className="border-l-4 pl-4">{inline(line.slice(2))}</blockquote>); i++; continue; }
    const paragraph = [line]; i++;
    while (i<lines.length && lines[i].trim() && !/^(#|```|>|[-*] |\d+\. )/.test(lines[i].trim())) {
      if (lines[i].includes('|') && /^\|?\s*:?-{3,}/.test(lines[i+1]?.trim() || '')) break;
      paragraph.push(lines[i++].trim());
    }
    blocks.push(<p key={key} className="my-4 leading-7">{inline(paragraph.join(" "))}</p>);
  }
  return <div className="article-prose break-words">{blocks}</div>;
}
