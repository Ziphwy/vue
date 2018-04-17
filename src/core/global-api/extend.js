/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { warn, extend, mergeOptions } from '../util/index'
import { defineComputed, proxy } from '../instance/state'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   *
   * 翻译：
   *  每一个实例构造器，包括 Vue，有一个唯一的 cid
   *  这允许我们能够为原型继承创建包装的子构造器并且进行缓存
   *
   * 笔记：
   *  所有组件构造器（包括 Vue），有 4 种选项：
   *    1. Ctor.extend(options) 扩展选项
   *    2. Ctor.options 默认选项，包括原型继承合并的
   *    3. new Ctor(options) 实例化参数选项，参数传递的
   *    4. vm.$options 实例选项，最终合并结果选项，实例当前的选项
   *  默认选择 = 父构造器选项 * 扩展选项
   *  实例选项 = 默认选项 * 实例化参数选项
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   * 翻译：类继承
   *
   * 该工具是继承的核心方法
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    /**
     * 笔记：
     *  所有构造器的祖先构造器都是 Vue
     *  由于 extend 方法会挂载到所有构造器，所以使用 this，可以认为 super 是父构造器
     *  cid 是构造器计数和唯一标识
     */
    const Super = this
    const SuperId = Super.cid

    // 笔记：
    //  在子构造器选项上缓存子构造器，使用父构造器 cid 作为 hash
    //  意味着在相同父构造器上，同一扩展选项，只需要返回上次的子构造器
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    // 笔记：组件名称，没有定义则继承父构造器的名称
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production') {
      if (!/^[a-zA-Z][\w-]*$/.test(name)) {
        warn(
          'Invalid component name: "' + name + '". Component names ' +
          'can only contain alphanumeric characters and the hyphen, ' +
          'and must start with a letter.'
        )
      }
    }

    // 笔记：
    //  定义子构造器函数，内部调用核心方法初始化实例，构造器接受一个 options 参数扩展
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
    // 笔记：合并选项
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // 笔记：保留父构造器的引用
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    // 翻译：
    //  对于 props 和 computed 属性，我们扩展的时候在 vue 实例的原型上定义了代理的 getter 函数，
    //  这避免了每个实例都调用 Object.defineProperty 创建重复的访问器
    // 笔记：
    //  对于实例的 props 和 computed 值，本不该暴露，但 js 语法没有私有变量，只能按约定下划线变量为私有，
    //  用户访问这些属性时，vue 提供 proxy 对象，所以在原型上先定义实例共享的 proxy 对象，指向实例的私有属性
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    // 翻译：允许更多的扩展/混合/插件使用
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    // 翻译：把资源注册到扩展类，这样扩展类能够有自己的私有的资源
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })

    // enable recursive self-lookup
    // 翻译：为了支持递归检索
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    // 翻译：在扩展时候，保持父组件 option 引用，稍后在实例化的时候，我们能检查父组件的选项是否被更新
    // 笔记：
    //  父构造器默认选项 * 扩展选项 = 子构造器默认选项（此处做了封闭处理）
    //  主要用于实例化时，简单父构造器选项是否被更改了
    //  q: 父构造器选项处理热更新以外，会有变化需求吗?
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
