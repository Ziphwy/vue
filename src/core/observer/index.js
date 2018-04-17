/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * By default, when a reactive property is set, the new value is
 * also converted to become reactive. However when passing down props,
 * we don't want to force conversion because the value may be a nested value
 * under a frozen data structure. Converting it would defeat the optimization.
 *
 * 翻译：
 *  默认地，当一个属性被设置为响应属性，重新赋值也会被转换成响应的。
 *  但是当向子组件传递 props 时，我们不打算强制转换，因为值有可能是冻结对象里的一个嵌套值。
 *  转换它的话将会冻结优化失效
 *
 * 笔记：
 *  Object.freeze 只对当前层级冻结，子结构仍然可以修改
 *  props 传递时，可能传递的冻结对象的内层结果，在对 _props 进行观察时，是不知道外层是否被冻结的
 *  设置 shouldConvert 为 false 后，不会进行观察
 */
export const observerState = {
  shouldConvert: true
}

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 *
 * 翻译：
 *  观察者类会附加到每一个观察对象。
 *  一旦附加，观察者转换目标对象的属性为 getter 和 setter 函数，
 *  用于收集依赖和分发更新
 *
 * 笔记：
 *  拥有观察者对象说明该对象/数组已进行观察（变化监听）
 */
export class Observer {
  // 笔记：被观察的对象/数组
  value: any;

  /**
   * 笔记：
   *  一个观察者对象是一个依赖
   *
   *  明显地，所有对象属性我们都可以通过 getter/setter 劫持，每个对象属性就是一个依赖（dep）
   *  那为什么要把观察者注册为依赖（dep）呢？
   *
   *  因为在运行时给对象/数组添加属性/元素，发生了变更，而这个变更同样需要被观察，
   *  所以把观察者对象也注册为依赖（dep）
   *  订阅者（watcher）要订阅的内容：
   *    1. 对象属性值的变更
   *    2. 对象属性增删的变更
   *    3. 数组元素的增删变更
   *    4. 内部嵌套的对象/数组的上述三种变更
   *  所以依赖（dep）收集时，订阅者（watcher）除了收集属性依赖（dep），还需要收集整个对象/数组依赖（dep）
   */
  dep: Dep;

  /**
   * 翻译：
   *  使用这个被观察的对象作为 data 实例数
   *
   * 笔记：
   *  当组件的 data 选项是对象，或者返回值是同一个对象，此时多个实例监听同一个观察者
   *  vue 建议多个实例不应该共享一个 data，应使用函数返回独立的 data，避免意料之外的数据响应
   */
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 笔记：在被观察的数据上保留本观察者引用
    def(value, '__ob__', this)

    if (Array.isArray(value)) {
      // 笔记：
      //  被观察的是数组，修改原型，或者直接在数组上重写方法拦截
      const augment = hasProto
        ? protoAugment
        : copyAugment
      augment(value, arrayMethods, arrayKeys)
      this.observeArray(value)
    } else {
      // 笔记：被观察的是对象，遍历属性创建访问器
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   *
   * 翻译：
   *  遍历每一个属性并且转换成 getter/setters。
   *  这个方法只适用于值类型是对象
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i], obj[keys[i]])
    }
  }

  /**
   * Observe a list of Array items.
   * 翻译：观察一个数组
   * 笔记：
   *  递归地为数组每个元素创建观察者
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 *
 * 翻译：使用 __proto__ 拦截原型, 增强一个目标对象或者数组
 * 笔记：
 *  主要是数组使用
 *  vue 使用一个数组作为原型创建了一个对象，用于替换被观察数组的原型
 */
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 *
 * 翻译：定义隐藏属性，增强一个目标对象或者数组
 * 笔记：
 *  如果访问不了实例的原型，那么复制属性到在属性上
 *  主要提供给数组变异方法
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 *
 * 翻译：
 *  尝试为一个对象创建一个观察者实例，
 *  如果成功创建，返回一个新的观察者；
 *  如果已经存在，返回存在的观察者
 *
 * 笔记：
 *  只对外保留创建观察者的方法，而不是观察者构造器
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 笔记：非对象或者是 vnode 实例不允许创建
  if (!isObject(value) || value instanceof VNode) {
    return
  }

  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // 笔记：已经存在观察者，返回
    ob = value.__ob__
  } else if (
    observerState.shouldConvert &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 笔记：
    //  不存在存在观察者，允许观察，
    //  需要观察的值，不是服务端渲染，数组或者纯对象，没有被冻结，则创建新观察者对象
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 *
 * 翻译：
 *  在一个对象上定义响应属性
 *
 * 笔记：
 *  核心方法，为每个属性创建 getter/setter 函数，
 *  进行依赖收集和变更通知
 *
 *  对属性访问的拦截，观察属性值是否变化，
 *  把每个属性注册为一个依赖，
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 笔记：一个属性就是一个依赖
  const dep = new Dep()

  // 笔记：获取属性的描述符，如果不可读取的话，无法监听
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 翻译：保留原先定义的 getter/setters
  const getter = property && property.get
  const setter = property && property.set

  // 笔记: 如果不是浅观察，对该属性的值进行深层观察，并返回子观察者
  let childOb = !shallow && observe(val)

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // 笔记：一般是计算属性使用 getter 计算当前值
      const value = getter ? getter.call(obj) : val
      /**
       * 笔记：
       *  依赖收集是以模拟栈的形式进行的
       *  如果发现当前有正在计算的订阅者（watcher），说明该订阅者（watcher）依赖于此数据
       *  往当前订阅者（watcher）的新依赖列表添加依赖
       *  过程中，订阅者（watcher）也会被依赖（dep）添加到订阅者列表
       */
      if (Dep.target) {
        dep.depend()
        if (childOb) {
          // 笔记：需要订阅嵌套对象/数组的增删变更，添加依赖（dep）到订阅者（watcher）
          childOb.dep.depend()
          // 笔记：如果属性值是数组，需要订阅每个元素的增删变更，添加依赖（dep）到订阅者（watcher）
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      // 笔记：一般是计算属性使用 getter 计算当前值
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      /**
       * 笔记：
       *  如果新旧值一致，直接返回
       *  q: 为什么除了新旧值不相等，还需自我比较不相等的值
       *  这里为了避免新旧值都为 NaN 时，触发刷新（只有 NaN 自我比较为 false）
       */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        // 笔记：开发环境下的自定义 setter
        customSetter()
      }
      // 笔记：调用原先存在 setter，或者直接赋值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 笔记：如果不是浅观察，对新值进行观察，注意 childOb 是闭包变量
      childOb = !shallow && observe(newVal)
      // 笔记：通知订阅者更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 *
 * 翻译：
 *  在对象上设置属性。
 *  添加一个新属性，并且如果该属性原本不存在，触发更改通知。
 *
 * 笔记：
 *  如果设置的对象为被观察者，则设置属性为响应式属性
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  // 笔记：如果是个数组，索引合法，替换对应索引的值
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }

  // 笔记：如果存在这个属性，更新属性的值，返回该值
  if (hasOwn(target, key)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    // 笔记：在运行时 vue 实例和 根级别数据（$data） 不应该设置任何响应式属性，应该在选项中声明它
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }

  // 笔记：如果没有观察者对象，直接赋值，不进行数据劫持
  if (!ob) {
    target[key] = val
    return val
  }
  // 笔记：进行数据劫持，并通知该依赖（dep）的订阅者（watcher）
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 *
 * 翻译：删除一个属性并在必要的话触发更改
 */
export function del (target: Array<any> | Object, key: any) {
  // 笔记：如果是属性值是数组，且是合法索引，使用变异的 splice 方法删除元素
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    // 笔记：在运行时 vue 实例和 根级别数据（$data） 不应该删除任何响应式属性
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // 笔记：如果本来不存在该属性，返回
  if (!hasOwn(target, key)) {
    return
  }

  // 笔记：存在，删除该属性，如果对象被观察，通知订阅者（watcher）
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 *
 * 翻译：
 *  当数组被修改，在数组元素上收集依赖（dep），因为我们无法像属性 getters 那样拦截数组元素访问
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]

    // 笔记：如果元素是被观察了，需要订阅元素的增删变更，往当前计算的订阅者（watcher）依赖列表添加依赖（dep）
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
