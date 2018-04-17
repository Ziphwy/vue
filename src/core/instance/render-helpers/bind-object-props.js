/* @flow */

import config from 'core/config'

import {
  warn,
  isObject,
  toObject,
  isReservedAttribute
} from 'core/util/index'

/**
 * Runtime helper for merging v-bind="object" into a VNode's data.
 *
 * 翻译：
 *  运行时工具，用来合并 v-bind="object" 到 VNode 的 data.
 *
 * 笔记：
 *  绑定在 Vue.prototype._b
 *  模板编译器没有在编译时对 v-bind="object" 进行 data.on 的转化
 *
 *  data 为正常 v-bind:xxx = "" 已经转化过的，解析 value 合并到 data 并返回
 */
export function bindObjectProps (
  data: any,
  tag: string,
  value: any,
  asProp: boolean,
  isSync?: boolean
): VNodeData {
  if (value) {
    if (!isObject(value)) {
      process.env.NODE_ENV !== 'production' && warn(
        'v-bind without argument expects an Object or Array value',
        this
      )
    } else {
      if (Array.isArray(value)) {
        value = toObject(value)
      }
      let hash
      for (const key in value) {
        if (
          key === 'class' ||
          key === 'style' ||
          isReservedAttribute(key)
        ) {
          // 笔记：如果是 class 或 style 或保留的属性，记录到 hash
          hash = data
        } else {
          // 笔记：q:
          const type = data.attrs && data.attrs.type
          hash = asProp || config.mustUseProp(tag, type, key)
            ? data.domProps || (data.domProps = {})
            : data.attrs || (data.attrs = {})
        }
        // 笔记：当前 key 在 data[*] 中未定义，为 data[*] 添加该属性
        if (!(key in hash)) {
          hash[key] = value[key]

          if (isSync) {
            // 笔记：`.sync` 语法糖，转换为事件，约定名称：`update:xxx`
            // q: 为什么修改的是 vnodeData 上的数据，vnodeData 和 vm 是怎么样的关系？
            const on = data.on || (data.on = {})
            on[`update:${key}`] = function ($event) {
              value[key] = $event
            }
          }
        }
      }
    }
  }
  return data
}
