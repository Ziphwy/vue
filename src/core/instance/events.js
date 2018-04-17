/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

/**
 * 笔记：
    初始化事件
 */
export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  /**
   * 笔记：
   *  初始化父组件上附加的事件，如果父组件上使用在子组件标签上绑定事件
   *  那么这些事件会在这时被注册到该组件事件系统中
   */
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: Component

// 笔记：添加事件
function add (event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

// 笔记：删除事件
function remove (event, fn) {
  target.$off(event, fn)
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  // 笔记：使用实例自定义事件机制，绑定和注销事件
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
}

export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/

  /**
   * 笔记：监听实例上自定义事件
   */
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    if (Array.isArray(event)) {
      // 笔记：支持数组定义`this.$on(['click', 'keyup'], ()=>{})`，迭代每个对象使用 $on
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
      // 笔记：在 vm_events 上记录各个事件的回调函数列表
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      // 翻译：使用一个布尔表示标记已注册而不是 hash 查找，优化 hook:event 的开销
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  /**
   * 笔记：监听一次实例上自定义事件
   */
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    // 笔记：借用 $on，在第一次回调后，注销监听
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    // 笔记：
    //  q: 为什么要在回调函数 on 留有引用 fn ？
    //  a: 因为用户调用 this.$off(event, fn)，真正要清空的是 fn，
    //     但是 $once 对它进行了包装，所以需要暴露出来给 $off 识别
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  /**
   * 笔记：注销实例上自定义事件
   */
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    // 笔记：没有参数，清空所有事件
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }

    // array of events
    // 笔记：数组语法`this.$on(['click', 'keyup'], ()=>{})`，迭代每一个元素使用 $off
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }

    // specific event
    // 笔记：指定事件
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }

    // 笔记：不带回调函数，清空该事件所有回调
    if (arguments.length === 1) {
      vm._events[event] = null
      return vm
    }

    // 笔记：带回调函数，删除指定的回调函数
    if (fn) {
      // specific handler
      let cb
      let i = cbs.length
      while (i--) {
        cb = cbs[i]
        if (cb === fn || cb.fn === fn) {
          cbs.splice(i, 1)
          break
        }
      }
    }
    return vm
  }

  /**
   * 笔记：触发事件回调
   */
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    // 笔记：取出 vm._events 对应事件回调列表，规范化参数传给回调并顺序调用
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          cbs[i].apply(vm, args)
        } catch (e) {
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}
