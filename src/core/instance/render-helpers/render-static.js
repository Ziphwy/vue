/* @flow */

import { cloneVNode, cloneVNodes } from 'core/vdom/vnode'

/**
 * Runtime helper for rendering static trees.
 *
 * 翻译：
 *  运行时工具，用于渲染静态树
 *
 * 笔记：
 *  绑定在 Vue.prototype._m
 *
 *  q: 什么是静态树？
 *  a: v-once 指令标记的 vnode
 *
 *  staticRenderFns 是模板生成的，v-once 指令标记的节点，但测试发现
 *  所有 v-once 标记的节点 vnode.isStatic = true，
 *  但只有 v-for 内部节点使用 v-once 才存在 vnode.isOnce = true
 *  q: 为什么？
 *
 */
export function renderStatic (
  index: number,
  isInFor?: boolean
): VNode | Array<VNode> {
  // static trees can be rendered once and cached on the contructor options
  // so every instance shares the same cached trees
  // 翻译：静态树可以只渲染一次，并缓存在构造器选项中，所以多个实例可以共享同一个树的缓存
  const renderFns = this.$options.staticRenderFns
  const cached = renderFns.cached || (renderFns.cached = [])
  let tree = cached[index]
  // if has already-rendered static tree and not inside v-for,
  // we can reuse the same tree by doing a shallow clone.
  // 翻译：如果存在已经渲染的静态树，并且不包含 v-for，我们可以进行浅克隆重用相同树
  if (tree && !isInFor) {
    return Array.isArray(tree)
      ? cloneVNodes(tree)
      : cloneVNode(tree)
  }
  // otherwise, render a fresh tree.
  // 否则，渲染一颗全新的树
  tree = cached[index] = renderFns[index].call(this._renderProxy, null, this)
  markStatic(tree, `__static__${index}`, false)
  return tree
}

/**
 * Runtime helper for v-once.
 * Effectively it means marking the node as static with a unique key.
 *
 * 翻译：
 *  运行时工具用于 v-once
 *  实际上这意味着使用一个唯一标识将节点标记为静态
 *
 * 笔记：
 *  绑定在 Vue.prototype._o
 *  用于模板编译的 render 函数，v-once 转化为该函数
 */
export function markOnce (
  tree: VNode | Array<VNode>,
  index: number,
  key: string
) {
  markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
  return tree
}

function markStatic (
  tree: VNode | Array<VNode>,
  key: string,
  isOnce: boolean
) {
  if (Array.isArray(tree)) {
    // 笔记：如果是数组，标记每个节点
    for (let i = 0; i < tree.length; i++) {
      if (tree[i] && typeof tree[i] !== 'string') {
        markStaticNode(tree[i], `${key}_${i}`, isOnce)
      }
    }
  } else {
    markStaticNode(tree, key, isOnce)
  }
}

function markStaticNode (node, key, isOnce) {
  node.isStatic = true
  node.key = key
  node.isOnce = isOnce
}
