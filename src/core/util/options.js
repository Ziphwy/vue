/* @flow */

import config from '../config'
import { warn } from './debug'
import { nativeWatch } from './env'
import { set } from '../observer/index'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 *
 * 翻译:
 *  选项覆盖策略是一系列的函数，处理如何合并一个父选项和子选项的值
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 * 笔记：
 *
 */
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 * 翻译：
 *  递归合并连个 data 对象
 * 笔记：
 *  data 合并的真正操作函数，将 from 的值合并到 to 中
 */
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal
  const keys = Object.keys(from)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      // 把 from 的属性添加到 to 上
      set(to, key, fromVal)
    } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    // 翻译：在 Vue.extend 合并中，data 都应该是 function
    // 笔记：q: Vue.extend 中，parentVal 默认是 undefined，此处注释何解？
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    /**
     * 翻译：
     *  父选项值 和 子选项值 都存在，我们需要返回一个函数，该函数合并两个函数的结果，
     *  不需要检查 父选项值 是否是一个函数，因为它只能是上一个返回合并函数的函数
     *
     * 笔记：
     *  因为所有组件都是继承自 Vue 的，所以保证了子类的 data 肯定是一个 mergedDataFn 函数，
     *  所以当前合并的 父选项值 肯定是父类继承时与其父类合并的 mergedDataFn 函数
     *
     *  q: 为什么需要 call ？存在 data 函数需要使用到组件实例？
     */
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this) : parentVal
      )
    }
  } else if (parentVal || childVal) {
    // 笔记：如果实例存在，则正在实例化，返回
    return function mergedInstanceDataFn () {
      // instance merge
      // 笔记：实例化是传给构造器的 data
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm)
        : childVal
      // 笔记：构造器上默认的 data（包括继承的）
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm)
        : parentVal
      // 笔记：如果存在实例化 data，进行合并
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

/**
 * 笔记：
 *  data 的合并策略
 *  不存在 vm 时，说明是在进行继承(extend)，合并到 options
 *  存在 vm 时，说明是在实例化，合并到 vm.$options
 */
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // 笔记：
    //  保证实例的 data 是函数
    //  由于所有的组件构造器都是 Vue 的子类，此处保证了所有子类 data 必为 函数
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    // 笔记：没有实例的话，意味着 Vue.extend 调用的，为什么需要 call 调用？
    return mergeDataOrFn.call(this, parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 * 翻译：合并钩子和属性为数组
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}

// 笔记：注册钩子函数合并策略
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 *
 * 翻译：
 *  当一个实例存在，我们需要对构造器选项，实例选项，父构造器选项进行三方合并
 *
 * 笔记：
 *  此处 vm 存在和不存在，好像没区别，都是使用一种策略：原型继承
 *  之所以可以这么处理的原因是：
 *    资源选项可以共享，子类可以访问父类的资源
 *    data 选项是函数合并，
 *    钩子 选项是数组合并
 */
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

// 笔记：注册资源合并策略
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 *
 * 翻译：
 *  watcher 的 hash 名不能覆另一个，我们合并为一个数组
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  // 笔记：firefox 有一个原生的 watch 函数
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  // 笔记：如果子选项不存在，就共享一个父选项
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  // 笔记：如果父选项不存在，就直接返回子选项
  if (!parentVal) return childVal
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    // 笔记：用数组将父子选项串在一起
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 *
 * 笔记：
 *  其他 hash 对象，采取子选项覆盖父选项原则
 */
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 * 笔记：
 *  默认合并策略，子选项存在用子选项，否则用父选项
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 * 翻译：检查组件名称
 * 笔记：不能是內建
 */
function checkComponents (options: Object) {
  for (const key in options.components) {
    const lower = key.toLowerCase()
    if (isBuiltInTag(lower) || config.isReservedTag(lower)) {
      warn(
        'Do not use built-in or reserved HTML elements as component ' +
        'id: ' + key
      )
    }
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 *
 * 翻译：确保所有的属性选项都是对象格式
 */
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        // 笔记：确保数组都是字符串，更改为驼峰，类型为 null
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      // 笔记：对象情况下，值是不是纯对象，用作类型；值是纯对象，直接赋值
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production' && props) {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 * 翻译：规范化所有注入都是对象格式
 */
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      // 笔记：数组写法默认为 from 的值
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production' && inject) {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 * 翻译：规范化原始函数指令为对象格式
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        // 笔记：支持单个函数表示注册 bind 和 update 钩子
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 *
 * 笔记：
 *  合并两个选项到一个
 *  核心工具，用于实例化和继承
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  // 笔记：检查 components 选项的 tag 是否是內建的
  if (process.env.NODE_ENV !== 'production') {
    checkComponents(child)
  }

  // 笔记：q: 为什么 child 是一个函数？
  if (typeof child === 'function') {
    child = child.options
  }

  // 笔记：标准化 prop inject directive，保证对象格式
  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)

  // 笔记：支持组件内 extends 属性继承
  const extendsFrom = child.extends
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm)
  }

  // 笔记：将 mixins 合并到父选项
  if (child.mixins) {
    for (let i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm)
    }
  }

  const options = {}
  let key

  // 笔记：先合并父构造选项
  for (key in parent) {
    mergeField(key)
  }

  // 笔记：再合并剩下的子构造器选项
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }

  // 笔记：根据选项名选择合并策略
  function mergeField (key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 *
 * 翻译：
 *  查找资源。
 *  使用这个函数是因为子实例需要访问定义在原型链上的资源
 *
 * 笔记：
 *  定义这个方法主要的原因是：连字符 === 驼峰 === 帕斯卡 === 同一个资源
 *  所以必须从对象上排除三种键名都不存在以后，才能取原型链上的值
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  // 翻译：优化返回本地注册的
  // 笔记：分别检查连字符，驼峰，帕斯卡键名
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  // 翻译：没有的话找原型链
  // 笔记：
  //  q: 直接 assets[id] 不就可以了吗？先取对象定义的，再取原型链上的
  //  a: 因为 id，camelizedId，PascalCaseId 三种形式都有可能，必须先排除对象上三种形式都没有，才能从原型上取
  //     所以只能以编码形式写。
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
