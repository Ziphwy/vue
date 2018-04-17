/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  /**
   * 笔记：
   *  组件的初始化函数，初始化实例各个选项的入口
   */
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    // 笔记：实例计数
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    // 笔记：标记以避免被观察
    vm._isVue = true
    // 合并选项
    if (options && options._isComponent) {
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 翻译：因为动态选项合并是很慢的，并且没有内部组件的选项需要特殊处理
      // 笔记：
      //  vue 内部（在生成虚拟 DOM 时）自己触发的组件实例化，实例化参数选项（options）是内部使用的隐藏属性，
      //  不会与用户自定义选项重合，且应该覆盖用户自定义，所以不需要进行动态合并，直接直接原型继承优化性能
      initInternalComponent(vm, options)
    } else {
      // 笔记：用户手动触发的实例化，合并构造器默认选项（Ctor.options）和实例化参数选项（options）
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 笔记：开发环境下，对用户未定义的响应式属性或者非法全局调用进行提示
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

/**
 * 笔记：
 *  因为内部创建组件时，实例化参数选项都是隐藏属性和必须覆盖的属性，所以直接原型继承合并，用于优化
 */
function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  // 笔记：内部组件不会有实例化参数选项，可以直接作为构造器默认选项使用
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  // 翻译：使用下面的处理比动态枚举要快
  opts.parent = options.parent
  opts.propsData = options.propsData
  opts._parentVnode = options._parentVnode
  opts._parentListeners = options._parentListeners
  opts._renderChildren = options._renderChildren
  opts._componentTag = options._componentTag
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

/**
 * 笔记：
 *  解析构造器选项
 *  主要检查扩展的构造器选项是否发生变更
 *
 *  热更新，mixin 等资源注册 api 是运行时可任意调用，
 *  会导致构造器生成后，默认选项仍得到新的附加选项，并且已扩展的子构造器需要响应这个变化，
 *  所以在实例化或者重新渲染的过程中，必须对选项进行修改检查
 */
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    // 如果存在父构造器，递归解析父构造器的选项
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 翻译：如果父构造器选项发生变更，需要重新解析新选项
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 翻译：检查当前默认选项是否有一些后期的更改和附加
      // 笔记：这里主要为了避免开发环境下热更新，构造器的扩展选项的变化被丢弃
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        // 笔记：覆盖修改的选项到组件的扩展选项中
        extend(Ctor.extendOptions, modifiedOptions)
      }
      // 笔记：构造器新默认选项 = 父构造器新默认选项 * 老扩展选项
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

/**
 * 笔记：
 *  主要检查热更新时，扩展选项发生什么更改，返回变化的内容
 */
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  // 笔记：最新默认选项 = extendOptions(新) * Ctor.superOptions(原)
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  // 笔记：封闭的选项 = Ctor.extendOptions(原) * Ctor.superOptions(原)
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    // 笔记：如果最新的选项和已封存选项不一致，说明默认选项被修改了
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  // 翻译：对比最新的和封存的，确保生命周期钩子没有重复合并
  // 笔记：主要原因是数组选项需要比对每个元素
  if (Array.isArray(latest)) {
    const res = []
    // 笔记：格式化为数组
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      // 笔记：
      //  1. 在最新选项中，且在扩展选项中，说明是老的，说明是原有
      //  2. 在最新选项中，但不在封闭选项中的最新值，说明是新增的
      //  3. 不符合以上两种情况，就是删除的
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    // 如果不是数组，直接返回最新的选项
    return latest
  }
}
