/* @flow */

import config from '../config'
import Dep from '../observer/dep'
import Watcher from '../observer/watcher'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  observerState,
  defineReactive
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

/**
 * 笔记：
 *  共享的代理方法
 *  主要用于定义一些隐藏属性的 getter/setter 访问器给用户
 */
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * 笔记：
 *  按顺序初始化 props，methods，data，computed，watch
 *  主要是类型检查，命名冲突，和在实例上挂实例方法和隐藏属性的访问代理
 *
 *  {
 *    _data: 真正的 data 对象，
 *    _prop: 真正的 prop 对象，
 *    _computedWatchers: computed 的 watcher 存放位置
 *  }
 */
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    // 如果 data 不存在，直接创建一个空的 _data 属性并观察它
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/**
 * 笔记：初始化属性
 */
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 翻译：缓存 prop 的 key，这样以后 props 更新就可以用数组迭代而不需要对动态对象进行枚举 key
  // 笔记：定义上 props 是不会变的
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  observerState.shouldConvert = isRoot
  for (const key in propsOptions) {
    keys.push(key)
    // 笔记：检查 prop 是否合法（用户自定义的 type, required 和 validate）
    const value = validateProp(key, propsOptions, propsData, vm)

    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 笔记：开发环境下，检查 prop 是否为保留特性
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }

      // 笔记：
      //  开发环境下，设置 vm._props 为响应式属性，添加警告：
      //  避免改变直接改变一个 prop ，因为父组件在重新渲染的时候都会重写这个值
      //  换而言之，使用这个父组件传递下来的 prop 的值定义 data 或者 computed 属性
      //  vue 提倡的单向数据流
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      // 笔记：生产环境，设置 vm._props 为响应式属性，不需要深入观察
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // 翻译：
    //   静态 props（指的是构造器上的）已经在 Vue.extend 的时候，在组件的原型上代理了，
    //   我们仅需要在实例化定义的那些 props
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  observerState.shouldConvert = true
}

/**
 * 笔记：初始化 data
 */
function initData (vm: Component) {
  let data = vm.$options.data
  // 笔记：如果 data 是函数，调用 data 取到值
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  // 笔记：检查 data 是否简单对象
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  // 笔记：在实例上挂载 data 的访问代理
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      // 笔记：开发环境下，检查是否与 method 名冲突
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // 笔记：检查是否与 prop 名冲突
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 笔记：没有与 props 冲突且不是私有变量命名，在实例上创建该属性的访问代理
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 笔记：对 data 进行观察（响应式改造）
  observe(data, true /* asRootData */)
}

/**
 *  笔记：纯粹调用 data 函数，因为是用户自定义的，需要捕捉异常
 */
function getData (data: Function, vm: Component): any {
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  }
}

/**
 * 笔记：
 *  computed 实际上是一个惰性 watcher，见 observer/watcher.js
 *  this._computedWatchers 上保留 computed 的 watcher 引用
 */
const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  // 笔记：computed 属性在服务端渲染仅仅是 getter 函数
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    // 笔记：兼容 computed 的函数定义 `cpt(){}` 和对象定义 `cpt: { get(){}, set(){} }`
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 笔记：非服务端渲染，创建惰性 watcher
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    /**
     * 翻译：
     *  组件构造器定义的 computed 属性已经定义在组件的原型上，
     *  我们仅需要创建实例定义的 computed 的访问器即可
     *
     * 笔记：同 props 理，在组件构造器生成时（extend），共享的访问器已经定义好了
     */
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // 笔记：开发环境下，检查定义在构造器上的 computed 属性是否与已有的 data 和 props 发生命名冲突
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        // 笔记：
        //  q: 为什么可以使用 $data，但不能使用 $props ?
        //  a: 应该是 vm.$options.data 不能用，因为是个 function
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
      // 笔记: 没有涉及到 methods，存在命名冲突；
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 笔记：在服务端渲染不做缓存
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    // 笔记：支持函数语法定义 `cpt(){}`
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : userDef
    sharedPropertyDefinition.set = noop
  } else {
    // 笔记：支持对象语法定义 `cpt: { get(){}, set(){} }`
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        // 笔记：不使用缓存的意思是：每次访问的时候都重新计算值
        ? createComputedGetter(key)
        : userDef.get
      : noop
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  // 开发环境下，如果用户没有定义 computed 属性的 set 但是调用则警告用户
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * 笔记：为 computed 属性返回一个 getter 函数
 */
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        // 笔记：如果 watcher 是脏值，则触发求值计算和依赖收集
        watcher.evaluate()
      }
      if (Dep.target) {
        // 笔记：
        //  如果当前存在正在计算的 watcher，那当前 watcher 需要订阅该 computed 的所有依赖
        //  因为 computed 设计上是响应式属性，但实际上是 watcher，
        //  存在依赖于 computedWatcher 的 watcher（render 函数 / computedWatcher）
        //  依赖于 computed 实际上依赖于 computed 的依赖
        //  所以，需要将依赖于 computed 的 watcher 订阅 computed 的所有依赖
        watcher.depend()
      }
      return watcher.value
    }
  }
}

/**
 * 笔记：
 *  初始化 methods 选项
 */
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    // 笔记：开发环境下添加提示
    if (process.env.NODE_ENV !== 'production') {
      // 笔记：方法定义成 null 了
      if (methods[key] == null) {
        warn(
          `Method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 笔记：方法名和 prop 名冲突了
      // q: 为什么需要取
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 笔记：方法名和实例上的私有变量冲突了
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 笔记：将方法绑定 this 为实例并挂到实例上
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
  }
}

/**
 * 笔记：
 *  初始化 watch 选项
 *  兼容数组定义多个 watcher，使用对象语法创建
 */
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

/**
 * 笔记：
 *  兼容对象语法，规范化参数后调用 $watch API 创建 watcher
 *  {
 *    hander: 回调函数,
 *    deep,
 *    immediate,
 *  }
 */
function createWatcher (
  vm: Component,
  keyOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 笔记：如果 handler 是字符串，尝试回调实例上的方法
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(keyOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  // 翻译：
  //  在使用 Object.defineProperty 时，flow 会以某种形式存在直接声明的定义对象的问题
  //  所以我们必须在这里以程序的方式创建对象
  // 笔记：q: flow 的问题？不解
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }

  // 笔记：开发环境下，只读警告
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }

  // 笔记：
  //  为 _data 和 _props 定义访问器，实例可通过 this.$data 和 this.$props 访问
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  // 笔记：给 Vue 的原型挂载 set/del 方法，让用户在实例中可以动态添加响应式属性
  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // 笔记：给 Vue 的原型挂载 $watch 方法，让用户在实例中可以添加自定义的 watcher
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      // 笔记：如果 cb 是纯对象，兼容对象定义
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // 笔记：immediate 表示立刻得到回调，因此直接手动触发
    if (options.immediate) {
      cb.call(vm, watcher.value)
    }
    // 笔记：在卸载 watcher 时，取消所有实例上的引用和注销所有依赖的订阅
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
