/* @flow */

import { isObject, isDef } from 'core/util/index'

/**
 * Runtime helper for rendering v-for lists.
 *
 * 翻译：
 *  渲染 v-for 列表的运行时工具
 *
 * 笔记：
 *  绑定到了 Vue.prototype._l
 *  用于辅助解析迭代的类型
 */
export function renderList (
  val: any,
  render: (
    val: any,
    keyOrIndex: string | number,
    index?: number
  ) => VNode
): ?Array<VNode> {
  let ret: ?Array<VNode>, i, l, keys, key
  if (Array.isArray(val) || typeof val === 'string') {
    // 笔记：数组或者字符串，为 render 传递每个元素的值
    ret = new Array(val.length)
    for (i = 0, l = val.length; i < l; i++) {
      ret[i] = render(val[i], i)
    }
  } else if (typeof val === 'number') {
    // 笔记：数字，为 render 传递 0 到 val 的每个数
    ret = new Array(val)
    for (i = 0; i < val; i++) {
      ret[i] = render(i + 1, i)
    }
  } else if (isObject(val)) {
    // 笔记：对象，为 render 传递每个键值对和索引
    keys = Object.keys(val)
    ret = new Array(keys.length)
    for (i = 0, l = keys.length; i < l; i++) {
      key = keys[i]
      ret[i] = render(val[key], key, i)
    }
  }
  // 笔记：给数组增加 _isVList 标记该节点列表是 v-for 生成，用于标准/规范化，参见 normalize-children.js
  if (isDef(ret)) {
    (ret: any)._isVList = true
  }
  return ret
}
