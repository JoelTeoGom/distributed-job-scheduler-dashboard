import { Fragment, type ReactNode } from 'react'

import { CopyIconButton } from '@/components/ui/copy-button'

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

function highlightJson(line: string): ReactNode {
  const pieces: ReactNode[] = []
  let cursor = 0

  for (const match of line.matchAll(JSON_TOKEN)) {
    pieces.push(line.slice(cursor, match.index))
    const [token, text, colon] = match
    if (text && colon) {
      pieces.push(<span key={match.index} className="text-[#9ecbff]">{text}</span>, colon)
    } else if (text) {
      pieces.push(<span key={match.index} className="text-[#a5d6a7]">{text}</span>)
    } else {
      pieces.push(<span key={match.index} className="text-amber">{token}</span>)
    }
    cursor = match.index + token.length
  }

  pieces.push(line.slice(cursor))
  return pieces
}

function highlightHeader(line: string): ReactNode {
  const separator = line.indexOf(':')
  if (separator === -1) return line
  return (
    <>
      <span className="text-[#9ecbff]">{line.slice(0, separator)}</span>
      {line.slice(separator)}
    </>
  )
}

export type CodeLine =
  | { kind: 'comment' | 'plain' | 'json' | 'header'; text: string }
  | { kind: 'secret'; name: string; secretName: string }
  | { kind: 'blank' }

function renderLine(line: CodeLine): ReactNode {
  switch (line.kind) {
    case 'blank':
      return ' '
    case 'comment':
      return <span className="text-subtle">{line.text}</span>
    case 'json':
      return highlightJson(line.text)
    case 'header':
      return highlightHeader(line.text)
    case 'secret':
      return (
        <>
          <span className="text-[#9ecbff]">{line.name}</span>: <span className="text-subtle">········ from secret {line.secretName}</span>
        </>
      )
    default:
      return line.text
  }
}

export function CodeBlock({ lines, copyValue }: { lines: CodeLine[]; copyValue?: string }) {
  return (
    <div className="group relative">
      {copyValue !== undefined && (
        <CopyIconButton value={copyValue} label="Copy" className="absolute top-3 right-3" />
      )}
      <pre className="overflow-x-auto rounded-b-card bg-code px-[18px] py-4 font-mono text-[12.5px] leading-[1.65] text-[#d4d4d4]">
        {lines.map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            {renderLine(line)}
            {'\n'}
          </Fragment>
        ))}
      </pre>
    </div>
  )
}

export function jsonLines(text: string): CodeLine[] {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
      .split('\n')
      .map((line) => ({ kind: 'json', text: line }))
  } catch {
    return text.split('\n').map((line) => ({ kind: 'plain', text: line }))
  }
}
