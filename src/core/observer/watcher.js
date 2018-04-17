/* @flow */

import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import type { ISet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 *
 * 翻译：
 *  一个订阅者在表达式的值变化时，会进行表达式计算，依赖收集和触发回调函数
 *  用于 $watch() 方法和指令
 *
 * 笔记：
 *  render 函数也被包装成 watcher
 */
export default class Watcher {
  // 笔记：所在的 vue 实例
  vm: Component;

  // 笔记：求值函数/表达式的字符串，开发环境下使用
  expression: string;

  // 笔记：回调函数
  cb: Function;

  // 笔记：唯一标识
  id: number;
  deep: boolean;
  user: boolean;

  // 笔记：是否是惰性，使用时再求值
  lazy: boolean;

  // 笔记：是否是同步，依赖更新后是否同步求值
  sync: boolean;

  // 笔记：是否是脏数据，需要重新求值
  dirty: boolean;

  // 笔记：是在处于活动状态，当实例被销毁和自定义watch卸载时，会被置为 false
  active: boolean;

  // 笔记：依赖列表
  deps: Array<Dep>;

  // 笔记：收集中的依赖列表
  newDeps: Array<Dep>;

  // 笔记：依赖列表的 hashmap，提高查重效率
  depIds: ISet;

  // 笔记：收集中的依赖列表的 hashmap，提高查重效率
  newDepIds: ISet;

  // 笔记：求值函数
  getter: Function;

  // 笔记：当前值
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    // vue 实例和 watcher 相互登记
    this.vm = vm
    vm._watchers.push(this)
    // options
    // 配置：默认配置为 false
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true

    // 笔记：使用惰性求值才需要 dirty 标记
    this.dirty = this.lazy // for lazy watchers

    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // 笔记：如果是个点操作符表达式，包装成函数
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }

    // 笔记：如果是惰性计算直接返回，否则计算当前值
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 翻译：
   *  执行求值函数，并重新收集依赖（dep）
   *
   * 笔记：
   *  依赖（dep）每次求值都需要重新收集，依赖是会增减的
   *  一种情况是，当值是嵌套观察对象时，如下：
   *  data = { a: { x: 1} }
   *  修改：
   *  data.a = { x: 2 }
   *  此时，原来的依赖 `{ x: 1 }` 和依赖 `x` ，更新为新依赖 { x: 2 } 和新依赖 `x`
   *
   *  收集依赖（dep）采取栈的形式，
   *  每当通过点操作符，或者变异方法操作数据，对应依赖（dep）就会注册到订阅者的依赖池中
   *  使用栈模拟函数嵌套，嵌套订阅者（watcher）存在时，
   *  保留未收集完的外层订阅者（watcher），先进后出地收集
   */
  get () {
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 笔记：执行求值函数，期间触发 getter 和变异方法
      value = this.getter.call(vm, vm)
    } catch (e) {
      // 笔记：异常捕捉，如果是用户定义的 watcher 进行提示
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 翻译：“触摸”每一个属性，这样所有的依赖都会被订阅，见 traverse 详解
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   *
   * 翻译：添加一个依赖到该指令
   *
   * 笔记：
   *  1. 向新依赖池中添加依赖（dep）
   *  2. 依赖（dep）记录当前订阅者（watcher）
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   *
   * 翻译：清扫依赖收集
   *
   * 笔记：
   *  对比新旧依赖表，如果旧表中有而新表中没有，说明该依赖（dep）已不需要，通知该依赖取消本订阅者（watcher）
   *  清空旧依赖表并交换新旧依赖表，始终保持两个表收集对比
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   *
   * 翻译：
   *  订阅者接口，将会在依赖变化是被调用
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      // 笔记：如果是惰性，只标记当前值是脏的
      this.dirty = true
    } else if (this.sync) {
      // 笔记：如果是同步 watcher，立刻求值
      this.run()
    } else {
      // 笔记：放入订阅者更新队列，异步求值
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   *
   * 翻译：
   *  调度任务的接口，在调度时被调用
   *
   * 笔记：
   *  主要作用是重新求值并触发回调
   */
  run () {
    // 笔记：订阅者是活动的
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        /**
         * 翻译：
         *  深度订阅者，在对象/数组上的订阅者，即使在值相同的时候也需要触发，因为内部可能变化了
         */
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        // 笔记：传递新旧值，触发订阅者回调函数
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   *
   * 翻译：
   *  订阅者求值，只用在惰性订阅者的情况下
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   *
   * 翻译：
   *  将当前订阅者注册到依赖池中的每一个依赖
   *
   * 笔记：
   *  用在惰性订阅者情况下
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   *
   * 翻译：
   *  将当前订阅者从依赖池每一个依赖的订阅者列表中移除
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      /**
       * 翻译：
       *  从 vue 实例的 watcher 列表中移除，这是一个稍微昂贵的操作，
       *  所以如果实例已经被销毁我们将跳过
       */
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      // 笔记：将当前 watcher 标记为不活动状态
      this.active = false
    }
  }
}

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 *
 * 翻译：
 *  递归遍历一个对象，换起所有拦截 getter 函数，在这个对象每一个嵌套属性
 *
 * 笔记:
 *  a: {
 *    b: {
 *      c: 1
 *    }
 *  }
 *  实际上，如果 $watch('a.b.c')，那么进行求值时 b 和 c 的 getter 都会触发，完成依赖收集
 *  但是，如果只是 $watch('a')，又希望订阅内部的 b 和 c 的变化，因为表达式没有涉及到 b，不会触发 b 的 getter
 *  因此需要手动指定 deep 模式，通过一次深遍历触发 getter
 *
 *  seenObjects 是除重
 */
const seenObjects = new Set()
function traverse (val: any) {
  seenObjects.clear()
  _traverse(val, seenObjects)
}

function _traverse (val: any, seen: ISet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || !Object.isExtensible(val)) {
    // 笔记：不是数组/对象，或者对象被冻结，直接返回
    return
  }
  // 笔记：如果该值被观察了，添加到 hashmap
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  // 笔记：递归对象/数组的属性/子元素，触发 getter 手机依赖
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
