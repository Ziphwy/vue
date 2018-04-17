/* @flow */

import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isPrimitive,
  resolveAsset
} from '../util/index'

import {
  normalizeChildren,
  simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
export function createElement (
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode {
  // 笔记：如果 data 是数组或者基本类型，将 data 认为是 children，格式化 data 为空
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  // 笔记：自定义 render 函数、v-for 等必须标准化 children，见 ./helper/normalize-children.js
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  return _createElement(context, tag, data, children, normalizationType)
}

export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode {
  /**
   * 笔记：
   *  如果 data 存在 __ob__ 属性，说明该节点被用户 watch 了
   *  这是不合理的，返回一个注释节点
   */
  if (isDef(data) && isDef((data: any).__ob__)) {
    process.env.NODE_ENV !== 'production' && warn(
      `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
      'Always create fresh vnode data objects in each render!',
      context
    )
    return createEmptyVNode()
  }

  /**
   * 笔记：
   *  处理动态组件
   *  如果 is 存在，用以更新 tag 属性
   *  如果 tag 仍不存在，返回注释节点
   */
  // object syntax in v-bind
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }

  // warn against non-primitive key
  // 翻译：避免 key 是一个非基本类型
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) {
    warn(
      'Avoid using non-primitive value as key, ' +
      'use string/number value instead.',
      context
    )
  }

  // support single function children as default scoped slot
  // 翻译：支持使用单个函数子元素作为默认的作用域插槽
  // 笔记：即：子元素数组首个元素是函数，则认为是默认作用域插槽
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {} // 笔记：q: data 为什么在这里需要默认值？
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }

  // 笔记：参见 ./helper/normalize-children.js，normalizationType 大部分情况由 complier 生成到 render 函数
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }

  let vnode, ns
  if (typeof tag === 'string') {
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      // 翻译：如果是保留标签的话，创建內建节点
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      // 笔记：如果在 context.$options.components 登记了 tag，创建组件
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      // 翻译：未知标签或者没有命名空间的元素会在运行时再检查，因为它的父节点可能规范化子元素是分配了命名空间
      // 笔记：q: 未能理解
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    // 翻译：直接使用传递的组件构造器或者 option 创建组件
    vnode = createComponent(tag, data, context, children)
  }

  if (isDef(vnode)) {
    if (ns) applyNS(vnode, ns)
    return vnode
  } else {
    return createEmptyVNode()
  }
}

/**
 * 笔记：
 *  申请命名空间
 *  但是只有一处调用，force 为 undefined
 */
function applyNS (vnode, ns, force) {
  vnode.ns = ns
  if (vnode.tag === 'foreignObject') {
    // use default namespace inside foreignObject
    ns = undefined
    force = true
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      if (isDef(child.tag) && (isUndef(child.ns) || isTrue(force))) {
        // 笔记：子元素 tag 存在，子元素命名空间不存在或者强制的情况下，给子元素添加相同命名空间
        applyNS(child, ns, force)
      }
    }
  }
}
