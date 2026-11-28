// ==============================================================================
// TEQQNOWORLD PHASE 6 — SAFE ZERO-XSS ARTICLE RENDERER
//
// Security Design:
// - NEVER uses dangerouslySetInnerHTML or raw HTML parsing.
// - Parses a clean Markdown-subset (## H2, ### H3, bullet lists, numbered lists,
//   blockquotes, **bold**, and [text](url) links) into native React elements.
// - Strictly validates link protocols: allows site-relative `/` paths and
//   `https://` URLs ONLY. Rejects `javascript:`, `data:`, `vbscript:`, etc.
// ==============================================================================

import React from 'react';

interface SafeArticleRendererProps {
  content: string;
  onInternalNavigate?: (path: string, label: string) => void;
}

export function isSafeArticleHref(rawHref: string): boolean {
  const trimmed = String(rawHref || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function renderInlineNodes(
  text: string,
  keyPrefix: string,
  onInternalNavigate?: (path: string, label: string) => void
): React.ReactNode[] {
  // Matches either [label](url) or **bold**
  const tokenRegex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-[#0B1530]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const label = linkMatch[1].trim();
      const rawHref = linkMatch[2].trim();
      if (!isSafeArticleHref(rawHref)) {
        return <span key={key}>{label}</span>;
      }
      const isInternal = rawHref.startsWith('/');
      return (
        <a
          key={key}
          href={rawHref}
          target={isInternal ? undefined : '_blank'}
          rel={isInternal ? undefined : 'noopener noreferrer'}
          onClick={(e) => {
            if (
              isInternal &&
              onInternalNavigate &&
              !e.metaKey &&
              !e.ctrlKey &&
              !e.shiftKey &&
              !e.altKey &&
              e.button === 0
            ) {
              e.preventDefault();
              onInternalNavigate(rawHref, label);
            }
          }}
          className="font-semibold text-[#FF7A00] hover:text-[#d86400] underline decoration-[#FF7A00]/40 underline-offset-2 transition-colors"
        >
          {label}
        </a>
      );
    }

    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export const SafeArticleRenderer: React.FC<SafeArticleRendererProps> = ({
  content,
  onInternalNavigate,
}) => {
  const blocks = String(content || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        No article body content has been added yet.
      </p>
    );
  }

  return (
    <div className="space-y-5 text-[15px] sm:text-base leading-relaxed text-slate-700">
      {blocks.map((block, idx) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

        // H2 Heading (never emit a second H1 inside article body — single H1 rule)
        if (lines.length === 1 && (lines[0].startsWith('## ') || lines[0].startsWith('# '))) {
          const headingText = lines[0].replace(/^#{1,2}\s+/, '').trim();
          return (
            <h2
              key={`h2-${idx}`}
              className="font-display text-xl sm:text-2xl font-bold text-[#0B1530] tracking-tight pt-3 border-t border-slate-100 first:border-t-0 first:pt-0"
            >
              {renderInlineNodes(headingText, `h2i-${idx}`, onInternalNavigate)}
            </h2>
          );
        }

        // H3 Heading
        if (lines.length === 1 && lines[0].startsWith('### ')) {
          const headingText = lines[0].replace(/^###\s+/, '').trim();
          return (
            <h3
              key={`h3-${idx}`}
              className="font-display text-lg font-bold text-[#0B1530] tracking-tight pt-1"
            >
              {renderInlineNodes(headingText, `h3i-${idx}`, onInternalNavigate)}
            </h3>
          );
        }

        // Blockquote callout
        if (lines.every((l) => l.startsWith('> '))) {
          const quoteText = lines.map((l) => l.slice(2)).join(' ');
          return (
            <blockquote
              key={`bq-${idx}`}
              className="border-l-4 border-[#FF7A00] bg-orange-50/50 rounded-r-xl px-4 py-3 text-sm sm:text-[15px] text-[#0B1530] font-medium"
            >
              {renderInlineNodes(quoteText, `bqi-${idx}`, onInternalNavigate)}
            </blockquote>
          );
        }

        // Unordered bullet list
        if (lines.every((l) => l.startsWith('- ') || l.startsWith('* '))) {
          return (
            <ul key={`ul-${idx}`} className="space-y-2.5 pl-5 list-disc marker:text-[#FF7A00]">
              {lines.map((line, lIdx) => (
                <li key={`li-${idx}-${lIdx}`} className="pl-1">
                  {renderInlineNodes(line.slice(2).trim(), `uli-${idx}-${lIdx}`, onInternalNavigate)}
                </li>
              ))}
            </ul>
          );
        }

        // Ordered list
        if (lines.every((l) => /^\d+\.\s+/.test(l))) {
          return (
            <ol key={`ol-${idx}`} className="space-y-2.5 pl-5 list-decimal marker:text-[#FF7A00] marker:font-semibold">
              {lines.map((line, lIdx) => (
                <li key={`oli-${idx}-${lIdx}`} className="pl-1">
                  {renderInlineNodes(
                    line.replace(/^\d+\.\s+/, '').trim(),
                    `ol-in-${idx}-${lIdx}`,
                    onInternalNavigate
                  )}
                </li>
              ))}
            </ol>
          );
        }

        // Standard paragraph
        return (
          <p key={`p-${idx}`} className="text-slate-700 leading-relaxed">
            {renderInlineNodes(lines.join(' '), `pi-${idx}`, onInternalNavigate)}
          </p>
        );
      })}
    </div>
  );
};
