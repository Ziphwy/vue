/* @flow */

import { namespaceMap } from 'web/util/index'

/**
 * 该模块主要是对浏览器原生 DOM API 的封装
 */

export function createElement (tagName: string, vnode: VNode): Element {
  const elm = document.createElement(tagName)
  if (tagName !== 'select') {
    return elm
  }
  /**
   * false or null will remove the attribute but undefined will not
   *
   * 翻译：
   *  节点 data 中 multiple 值是 false 和 null，将移除 multiple
   *
   * 笔记：
   *  如果是 select 元素，multiple 不是 undefined 的话，设置 multiple 为 multiple
   *  q: false 和 null 的时候，vnode.data.attrs 会移除该特性，使得不渲染，但是 undefined 不会？但为什么其他属性不需要呢？
   */
  if (vnode.data && vnode.data.attrs && vnode.data.attrs.multiple !== undefined) {
    elm.setAttribute('multiple', 'multiple')
  }
  return elm
}

/**
 * 笔记：主要是使用命名空间创建 SVG 和 MathML
 */
export function createElementNS (namespace: string, tagName: string): Element {
  return document.createElementNS(namespaceMap[namespace], tagName)
}

export function createTextNode (text: string): Text {
  return document.createTextNode(text)
}

export function createComment (text: string): Comment {
  return document.createComment(text)
}

export function insertBefore (parentNode: Node, newNode: Node, referenceNode: Node) {
  parentNode.insertBefore(newNode, referenceNode)
}

export function removeChild (node: Node, child: Node) {
  node.removeChild(child)
}

export function appendChild (node: Node, child: Node) {
  node.appendChild(child)
}

export function parentNode (node: Node): ?Node {
  return node.parentNode
}

export function nextSibling (node: Node): ?Node {
  return node.nextSibling
}

export function tagName (node: Element): string {
  return node.tagName
}

export function setTextContent (node: Node, text: string) {
  node.textContent = text
}

export function setAttribute (node: Element, key: string, val: string) {
  node.setAttribute(key, val)
}
