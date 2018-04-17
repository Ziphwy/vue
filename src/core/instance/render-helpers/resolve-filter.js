/* @flow */

import { identity, resolveAsset } from 'core/util/index'

/**
 * Runtime helper for resolving filters
 *
 * 翻译：解析 filters 的运行时工具
 * 笔记：作用就是返回 filters 选项
 */
export function resolveFilter (id: string): Function {
  return resolveAsset(this.$options, 'filters', id, true) || identity
}
