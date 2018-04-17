/* @flow */

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 *
 * 翻译：
 *  运行时工具，用来解析原始子 vnode 为一个 slot 对象
 */
export function resolveSlots (
  children: ?Array<VNode>,
  context: ?Component
): { [key: string]: Array<VNode> } {
  const slots = {}
  if (!children) {
    return slots
  }
  const defaultSlot = []
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]
    const data = child.data
    // remove slot attribute if the node is resolved as a Vue slot node
    /**
     * 翻译：
     *  移除 slot 的特性，如果节点被当做是一个 Vue slot 节点解析的话
     *
     * 笔记：
     *  即如果这个节点是 slot 节点，则 data.attrs 中不应该出现 slot，而是在 data.slot
     *  显然，如果子组件没有 slot，那么 slot 会作为一个正常的 attr 使用
     */
    if (data && data.attrs && data.attrs.slot) {
      delete data.attrs.slot
    }
    // named slots should only be respected if the vnode was rendered in the
    // same context.
    // 翻译：如果 vnode 在相同的组件中渲染，只应该特别对待具名 slot
    // 笔记：q: 不明白什么意思，什么情况下会出现？如果子节点所在的实例和当前实例不一致，会放入 defaultSlot
    if ((child.context === context || child.functionalContext === context) &&
      data && data.slot != null
    ) {
      const name = child.data.slot
      const slot = (slots[name] || (slots[name] = []))
      if (child.tag === 'template') {
        // 笔记：如果是 template 节点，需要把它的子节点都放入 slot
        slot.push.apply(slot, child.children)
      } else {
        slot.push(child)
      }
    } else {
      defaultSlot.push(child)
    }
  }
  // ignore whitespace
  // 笔记：忽略空格注释节点，q: 哪里来的空格？
  if (!defaultSlot.every(isWhitespace)) {
    slots.default = defaultSlot
  }
  return slots
}

// 笔记：是否是空格（注释节点上空格）
function isWhitespace (node: VNode): boolean {
  return node.isComment || node.text === ' '
}

/**
 * 笔记：
 *  绑定在 Vue.prototype._u
 *  在模板编译的 render 函数中使用，解析 scope slot
 *
 *  模板编译会将 scope slot 模板生成如：
 *  ```
 *  scopedSlots: _u([{
 *    key: "hey",
 *    fn: function(ok) {
 *      return _c('span', {}, [_v(_s(ok.test))])
 *    }
 *  }])
 *  ```
 *  该函数提取转换数组为：
 *  ```
 *  {
 *    [key]: [fn]
 *    [key]: [fn]
 *    [key]: [fn]
 *  }
 *  ```
 */
export function resolveScopedSlots (
  fns: ScopedSlotsData, // see flow/vnode
  res?: Object
): { [key: string]: Function } {
  res = res || {}
  for (let i = 0; i < fns.length; i++) {
    if (Array.isArray(fns[i])) {
      resolveScopedSlots(fns[i], res)
    } else {
      res[fns[i].key] = fns[i].fn
    }
  }
  return res
}
