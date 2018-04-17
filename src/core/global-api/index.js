/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

/**
 * 笔记：
 *  初始化全局 API，包括 Vue 构造器上的静态方法
 */
export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  // 笔记：初始化全局配置，只读
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  /**
   * 翻译：
   *  暴露工具方法
   *  注意：这些都不是经过仔细考虑的公共 API，除非你意识到风险，否则避免依赖他们
   */
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 笔记：设置/删除响应式属性
  Vue.set = set
  Vue.delete = del

  // 笔记：下一 tick 异步执行
  Vue.nextTick = nextTick

  // 笔记：Vue 默认选项
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // 笔记：这是用来表示 “原始” 构造器，在 weex 的多实例场景下，扩展简单对象组件
  Vue.options._base = Vue

  // 笔记：Vue 默认选项的内置组件（此处只有 keep-alive，因为其他如 transition 的依赖于平台实现）
  extend(Vue.options.components, builtInComponents)

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
