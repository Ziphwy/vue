/* @flow */

import { mergeOptions } from '../util/index'

/**
 * 笔记：
 *  mixin 操作实际上就是合并选项的工具
 */
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
