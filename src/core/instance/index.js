import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

/**
 * 笔记：Vue 构造器
 */
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

/**
 * 笔记：
 *  分模块附加到 vue.prototype 上：
 *  1. 初始化实例核心方法
 *  2. 状态相关的方法（如 $set，$watch）和属性（$data，$props）
 *  3. 事件系统相关方法（如 $on，$emit）
 *  4. 事件系统相关方法（如 $on，$emit）
 *  5. 生命周期相关方法（如 $destroy，_update）
 *  6. 渲染相关方法（如 $nextTick，_render）
 *
 *  注意此处只为添加原型方法，各模块的对实例初始化在 1 中内部调用
 */
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
