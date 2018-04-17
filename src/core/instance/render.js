/* @flow */

import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import VNode, { cloneVNodes, createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'

// 笔记：初始化 render 函数
export function initRender (vm: Component) {
  // 笔记：子树的根节点
  vm._vnode = null // the root of the child tree
  const options = vm.$options

  // 笔记：父树上的占位节点
  const parentVnode = vm.$vnode = options._parentVnode // the placeholder node in parent tree

  // 笔记：render 渲染的组件实例
  const renderContext = parentVnode && parentVnode.context

  // 笔记：解析 slot
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  // q: 作用域 slot 为什么是空对象
  // a: 默认值，在 render 的时候，会生成作用域插槽函数
  vm.$scopedSlots = emptyObject

  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  /**
   * 翻译：
   *  createElement 函数绑定到实例
   *  以便于我们在里面得到适当的渲染上下文实例
   *  参数顺序是：tag, data, children, normalizationType, alwaysNormalize
   *  内部版本由模板编译的 render 函数使用
   *
   * 笔记：
   *  该函数是内部函数，主要给模板编译的 render 调用，false 表示根据情况 d 判断如何规范化子节点
   */
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)

  // normalization is always applied for the public version, used in
  // user-written render functions.
  // 翻译：规范化常常在公开版本使用，用于用户自定义的 render 函数
  // 笔记：该函数是公开函数，主要提供给用户自定义 render 函数，true 表示总是使用标准规范化子节点，因为用户传递的参数类型是不可测的
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  // 翻译：
  //  暴露 $attrs 和 $listeners 便于更简单地创建高阶组件
  //  他们需要响应式以便于高阶组件在使用的时候都是最新的
  // 笔记：
  //  自定义 render 函数会通过这两个属性访问父节点上的属性和监听器，所以将其设置为响应式的
  const parentData = parentVnode && parentVnode.data

  /* istanbul ignore else */
  if (process.env.NODE_ENV !== 'production') {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
  }
}

export function renderMixin (Vue: Class<Component>) {
  // install runtime convenience helpers
  // 笔记：安装运行时辅助工具，提供给模板编译的 render 函数使用，减少代码量
  installRenderHelpers(Vue.prototype)

  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  // 笔记：核心方法，内部使用的 render 函数
  Vue.prototype._render = function (): VNode {
    const vm: Component = this

    // 笔记：_parentVnode 指的是组件在父组件上的占位节点
    const { render, _parentVnode } = vm.$options

    if (vm._isMounted) {
      // if the parent didn't update, the slot nodes will be the ones from
      // last render. They need to be cloned to ensure "freshness" for this render.
      // 翻译：如果父组件没有更新，slot 节点将，
      for (const key in vm.$slots) {
        const slot = vm.$slots[key]
        if (slot._rendered) {
          vm.$slots[key] = cloneVNodes(slot, true /* deep */)
        }
      }
    }

    // 笔记：在实例上保持 scope slot 的 render 函数
    vm.$scopedSlots = (_parentVnode && _parentVnode.data.scopedSlots) || emptyObject

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    // 翻译：设置父节点，这允许 render 可以访问占位节点上的 data
    vm.$vnode = _parentVnode
    // render self
    let vnode
    try {
      // 笔记：调用真实的 render 函数生成 vnode，_renderProxy 指向 render 上下文实例
      // q: 为什么需要 _renderProxy，而不是直接指向实例？
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      handleError(e, vm, `render`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        if (vm.$options.renderError) {
          try {
            vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
          } catch (e) {
            handleError(e, vm, `renderError`)
            vnode = vm._vnode
          }
        } else {
          vnode = vm._vnode
        }
      } else {
        // 笔记：异常情况，仍然使用之前的 vnode
        vnode = vm._vnode
      }
    }
    // return empty vnode in case the render function errored out
    // 笔记：返回一个空注释节点如果 render 函数抛出异常
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // set parent
    vnode.parent = _parentVnode
    return vnode
  }
}
