/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { observerState } from '../observer/index'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'

import {
  warn,
  noop,
  remove,
  handleError,
  emptyObject,
  validateProp
} from '../util/index'

// 笔记：当前正在更新（patch）的实例
export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

/**
 * 笔记：初始化生命周期，建立父子关系，创建隐含变量
 */
export function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  // 笔记：找到最近的非抽象祖先，建立父子绑定
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    parent.$children.push(vm)
  }

  vm.$parent = parent
  // 笔记：如果父实例不存在，那么当前实例就是根实例
  vm.$root = parent ? parent.$root : vm

  vm.$children = []
  vm.$refs = {}

  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

export function lifecycleMixin (Vue: Class<Component>) {
  /**
   * 笔记：
   *  内部的组件渲染更新核心方法，数据改变时或者强制更新视图，会间接触发该函数
   *
   *  vnode 参数，实例的新/目标 vnode，与老 vnode 进行 patch 操作
   *  hydrating 参数用于合并服务端渲染
   */
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    // 笔记：更新时，如果已经挂载，调用 beforeUpdate 钩子
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }
    // 笔记：缓存当前节点，vnode 和 上一个更新（patch）的实例
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance
    activeInstance = vm

    // 笔记：将新 vnode 记录到 vm._vnode
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // 翻译：Vue.prototype.__patch__ 根据各个平台渲染的需要在入口处注入，
    if (!prevVnode) {
      // initial render
      // 笔记：如果不存在老 vnode，使用 vm.$el 生成一个同类型空节点，初始化渲染
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      // 翻译：
      //  在初始化 patch 之后，不需要参考节点
      //  这可以组织在内存在保留分离的 DOM 树
      // 笔记：
      //  q: 内存泄露如何产生？
      vm.$options._parentElm = vm.$options._refElm = null
    } else {
      // updates
      // 笔记：
      //  q: 为什么初始化的时候需要 _parentElm 和 _refElm，而更新不需要？
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    // 笔记：q: 为什么要恢复前一个活动实例为活动实例？
    activeInstance = prevActiveInstance

    // update __vue__ reference
    // 笔记：清除前一个 DOM 子树的实例引用（__vue__），在新 DOM 子树上绑定当前实例
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }

    // if parent is an HOC, update its $el as well
    // 翻译：如果父组件是一个高阶组件，需要同时更新它的 $el
    // 笔记：
    //  根据 vm.$vnode 和 vm.$parent._vnode，如果节点一致，父组件是高阶组件
    //  高阶组件一般是 render 函数返回增强属性的组件 render: h => h(targetCtor, { enhance })
    //  q: 为什么要同步更新？
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
    // 翻译：updated 钩子会在 watcher 调度器中调用，确保在父组件的 updated 钩子中，子组件全都更新
    // 笔记：因为 watcher 调度器是由父组件到子组件调用的，参见 observer/scheduler.js
  }

  /**
   * 笔记：
   *  强制刷新
   *  在异步组件和过渡等都会用到，即手动调用 updateComponent 函数
   */
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  /**
   * 笔记：
   *  销毁组件实例
   */
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    // 笔记：防止重复销毁
    if (vm._isBeingDestroyed) {
      return
    }
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    // 翻译：从父实例总移除引用
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      // 笔记：满足父实例存在，父实例不在销毁，当前实例不是抽象组件，移除引用
      remove(parent.$children, vm)
    }
    // teardown watchers
    // 笔记：卸载 render watcher，移除依赖关系
    if (vm._watcher) {
      vm._watcher.teardown()
    }
    // 笔记：卸载普通 watcher，移除依赖关系
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // frozen object may not have observer.
    // 翻译：移除观察者的实例引用计数，冻结数据可能没有观察者
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }

    // call the last hook...
    // 笔记：标记实例已经销毁完成
    vm._isDestroyed = true

    // invoke destroy hooks on current rendered tree
    // 笔记：进行 patch 操作，调用组件 vnode 的 destory 钩子
    vm.__patch__(vm._vnode, null)

    // fire destroyed hook
    // 笔记：触发组件 destroyed 钩子
    callHook(vm, 'destroyed')

    // turn off all instance listeners.
    // 笔记：移除所有实例监听器
    vm.$off()

    // remove __vue__ reference
    // 笔记：最后移除真实节点上的实例引用，等待垃圾回收
    if (vm.$el) {
      vm.$el.__vue__ = null
    }

    // release circular reference (#6759)
    // 笔记：$vnode 指向组件的占位节点，组件的占位节点存在 componentInstance 的实例引用
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

/**
 * 笔记：
 *  挂载组件
 *  为 render 函数创建一个 watcher，即 render watcher
 *  使视图作为一个订阅者加入依赖收集
 *
 *  render watcher 会在依赖发生变化的时候，
 *  重新触发 render 函数生成新的 vnode 以进行 patch 操作
 *
 *  beforeMount 和 mounted 钩子会在挂载时调用
 */
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el
  if (!vm.$options.render) {
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  callHook(vm, 'beforeMount')

  let updateComponent
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    // 笔记： render watcher 的求值函数，生成新的 vnode 并且进行 patch
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }

  vm._watcher = new Watcher(vm, updateComponent, noop)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

/**
 * 笔记：
 *  更新子组件，实际上
 */
export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: VNode,
  renderChildren: ?Array<VNode>
) {
  // 翻译：开发环境下标记正在更新子组件
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  /**
   * 翻译：
   *  确定组件是否有 slot 子元素
   *  我们需要在覆盖 $options._renderChildren 做这件事
   * 笔记：
   *  q: 为什么？
   *  a: 因为需要判断旧节点上是否有 slot，所以要在覆盖前判断
   */
  const hasChildren = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    parentVnode.data.scopedSlots || // has new scoped slots
    vm.$scopedSlots !== emptyObject // has old scoped slots
  )

  // 笔记：更新三个原有的组件占位节点引用
  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render
  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }

  // 笔记：更新已渲染的 slot 节点
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  // 翻译：更新 $attrs 和 $listeners，因为他们都是响应的，所以子元素在 render 过程中使用他们，必须触发更新
  vm.$attrs = (parentVnode.data && parentVnode.data.attrs) || emptyObject
  vm.$listeners = listeners || emptyObject

  // update props
  // 笔记：更新 props，触发依赖于此的子组件 render watcher，此处是子组件的更新的关键
  if (propsData && vm.$options.props) {
    // 笔记：关闭转换，不需要对 props 进行观察
    observerState.shouldConvert = false
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      props[key] = validateProp(key, vm.$options.props, propsData, vm)
    }
    observerState.shouldConvert = true
    // keep a copy of raw propsData
    // 翻译：存一份原始 propsData 副本
    vm.$options.propsData = propsData
  }

  // update listeners
  // 笔记：移除旧监听器，增加新监听器，此处是自定义事件
  if (listeners) {
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)
  }

  // resolve slots + force update if has children
  // 笔记：
  //  如果存在已渲染的 slot，强制刷新子实例的 render watcher，
  //  因为 slot 不在依赖收集系统中，slot 的内容是在父组件上渲染，但是在子组件上更新的
  //  如果有变化，需要强制触发更新
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

/**
 * 笔记：
 *  判断实例是否存在一个被停用的祖先实例
 *  如果存在，则说明当前实例和其子实例已被停用，没必要再向下递归停用
 */
function isInInactiveTree (vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

/**
 * 笔记：
 *  激活子组件
 *  _inactive 标识当前组件处于停用状态
 *  _directInactive 标识表示该组件是 keep-alive 的直接作用组件
 *
 *  递归子实例时，direct 参数恒为 false
 *  这个机制保证了父子组件的嵌套 keep-alive 在激活时相互独立
 */
export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    // 笔记：重置 _directInactive 标识，检查是否存在不活动的祖先，如果存在，当前组件仍然不能被激活
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    // 笔记：保证了不会间接激活子实例中嵌套 keep-alive 组件
    return
  }
  // 笔记：如果当前实例是停用状态，更新为活动状态，并递归激活子实例
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

/**
 * 笔记：
 *  停用子组件
 *  direct 参数表示该实例是 keep-alive 直接实例，参考上面 activateChildComponent 注释
 */
export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    // 笔记：
    //  标记 _directInactive 标识，检查当前实例是否在一个停用的祖先，如果存在则不需要递归停用子实例
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  // 笔记：如果当前实例是活动状态，更新为停用状态，并递归停用子实例
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

/**
 * 笔记：调用 vue 组件实例的钩子，通知发射钩子事件
 */
export function callHook (vm: Component, hook: string) {
  const handlers = vm.$options[hook]
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      try {
        handlers[i].call(vm)
      } catch (e) {
        handleError(e, vm, `${hook} hook`)
      }
    }
  }
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
}
