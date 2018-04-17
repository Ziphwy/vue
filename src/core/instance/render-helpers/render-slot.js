/* @flow */

import { extend, warn, isObject } from 'core/util/index'

/**
 * Runtime helper for rendering <slot>
 *
 * 翻译：
 *  运行时工具，用来渲染 <slot></slot> 标签
 *
 * 笔记：
 *  绑定到 Vue.prototype._t
 *  普通 slot 是在父组件渲染，作为子组件的子节点
 *  作用域 slot 在父组件编译为 data.scopedSlots[*] = _u[]，是在子组件渲染的，
 *
 *  q: bindObject 是什么?
 *  a: <slot v-bind="object"></slot> 语法，模板会 将 object 以参数 bindObject 编译，作为运行时
 *
 *  q: fallback 是什么？
 *  a: <slot>fallback</slot>，如果不存在为 null
 */
export function renderSlot (
  name: string,
  fallback: ?Array<VNode>,
  props: ?Object,
  bindObject: ?Object
): ?Array<VNode> {
  const scopedSlotFn = this.$scopedSlots[name]
  if (scopedSlotFn) { // scoped slot
    // 笔记：作用域插槽
    props = props || {}
    if (bindObject) {
      if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
        warn(
          'slot v-bind without argument expects an Object',
          this
        )
      }
      props = extend(extend({}, bindObject), props)
    }
    return scopedSlotFn(props) || fallback
  } else {
    // 笔记：普通插槽
    const slotNodes = this.$slots[name]
    // warn duplicate slot usage
    if (slotNodes && process.env.NODE_ENV !== 'production') {
      slotNodes._rendered && warn(
        `Duplicate presence of slot "${name}" found in the same render tree ` +
        `- this will likely cause render errors.`,
        this
      )
      // 笔记：标记已渲染
      slotNodes._rendered = true
    }
    return slotNodes || fallback
  }
}
