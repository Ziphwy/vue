/* @flow */

import { warn, extend, isPlainObject } from 'core/util/index'

/**
 * 笔记：
 *  绑定到 Vue.prototype._g
 *  模板编译器没有在编译时对 v-on="object" 进行 data.on 的转化
 *  正常的 v-on:xxx="" 已转化成 data.on 的，该工具合并 v-on="object" 到 vnode 的 data.on 中
 */
export function bindObjectListeners (data: any, value: any): VNodeData {
  if (value) {
    if (!isPlainObject(value)) {
      process.env.NODE_ENV !== 'production' && warn(
        'v-on without argument expects an Object value',
        this
      )
    } else {
      const on = data.on = data.on ? extend({}, data.on) : {}
      for (const key in value) {
        const existing = on[key]
        const ours = value[key]
        on[key] = existing ? [].concat(ours, existing) : ours
      }
    }
  }
  return data
}
