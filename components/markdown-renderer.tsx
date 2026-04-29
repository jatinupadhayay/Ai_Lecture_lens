import { Fragment } from "react"
import { cn } from "@/lib/utils"

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[1] !== undefined) {
      parts.push(<strong key={match.index} className="font-semibold text-foreground">{match[1]}</strong>)
    } else if (match[2] !== undefined) {
      parts.push(<em key={match.index} className="italic">{match[2]}</em>)
    }
    last = match.index + match[0].length
  }

  if (last < text.length) parts.push(text.slice(last))
  return parts
}

interface Props {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: Props) {
  const lines = content.split("\n")
  const nodes: React.ReactNode[] = []
  let listBuffer: { ordered: boolean; items: string[] } | null = null
  let key = 0

  const flushList = () => {
    if (!listBuffer) return
    const { ordered, items } = listBuffer
    const Tag = ordered ? "ol" : "ul"
    nodes.push(
      <Tag
        key={key++}
        className={cn(
          "my-3 space-y-1 pl-5",
          ordered ? "list-decimal" : "list-disc"
        )}
      >
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed text-foreground/90">
            {parseInline(item)}
          </li>
        ))}
      </Tag>
    )
    listBuffer = null
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    // H2
    if (/^## (.+)/.test(line)) {
      flushList()
      const text = line.replace(/^## /, "")
      nodes.push(
        <h2 key={key++} className="text-base font-semibold text-foreground mt-5 mb-1.5 first:mt-0 border-b border-border/40 pb-1">
          {parseInline(text)}
        </h2>
      )
      continue
    }

    // H3
    if (/^### (.+)/.test(line)) {
      flushList()
      const text = line.replace(/^### /, "")
      nodes.push(
        <h3 key={key++} className="text-sm font-semibold text-foreground mt-4 mb-1">
          {parseInline(text)}
        </h3>
      )
      continue
    }

    // H1
    if (/^# (.+)/.test(line)) {
      flushList()
      const text = line.replace(/^# /, "")
      nodes.push(
        <h1 key={key++} className="text-lg font-bold text-foreground mt-2 mb-2">
          {parseInline(text)}
        </h1>
      )
      continue
    }

    // Unordered list item
    const ulMatch = line.match(/^[-*] (.+)/)
    if (ulMatch) {
      if (listBuffer && listBuffer.ordered) flushList()
      if (!listBuffer) listBuffer = { ordered: false, items: [] }
      listBuffer.items.push(ulMatch[1])
      continue
    }

    // Ordered list item
    const olMatch = line.match(/^\d+\. (.+)/)
    if (olMatch) {
      if (listBuffer && !listBuffer.ordered) flushList()
      if (!listBuffer) listBuffer = { ordered: true, items: [] }
      listBuffer.items.push(olMatch[1])
      continue
    }

    // Empty line = paragraph break
    if (line.trim() === "") {
      flushList()
      continue
    }

    // Regular paragraph line
    flushList()
    nodes.push(
      <p key={key++} className="text-sm leading-relaxed text-foreground/85 my-1.5">
        {parseInline(line)}
      </p>
    )
  }

  flushList()

  return (
    <div className={cn("prose-sm space-y-0", className)}>
      {nodes}
    </div>
  )
}
