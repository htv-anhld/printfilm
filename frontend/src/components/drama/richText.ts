/** 把含 {key} 占位的译文拆成 React 片段，占位替换为节点（如 <strong>），用于需要局部加粗的文案 */
import { createElement, Fragment, type ReactNode } from 'react'

export function richText(template: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/(\{\w+\})/g)
  return parts.map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/)
    if (m && Object.prototype.hasOwnProperty.call(nodes, m[1])) {
      return createElement(Fragment, { key: i }, nodes[m[1]])
    }
    return part ? createElement(Fragment, { key: i }, part) : null
  })
}
