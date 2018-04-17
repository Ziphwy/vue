/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

// hooks to be invoked on component VNodes during patch
// 翻译：在 patch 过程中，这些钩子在组件 vnode 上调用
const componentVNodeHooks = {
  /**
   * 笔记：
   *  初始化钩子，在 vnode 首次创建后调用，vnode 为当前创建的
   */
  init (
    vnode: VNodeWithData,
    hydrating: boolean,
    parentElm: ?Node,
    refElm: ?Node
  ): ?boolean {
    /**
     * 笔记:
     * q: 什么情况下会不存在组件实例？
     * a: 普通节点不存在，组件占位节点存在，见 ./vnode.js
     *
     * 此处是组件节点钩子，所以默认应该存在 componentInstance，不然就是未创建
     * 创建实例后，调用 $mount 方法挂载
     */
    if (!vnode.componentInstance || vnode.componentInstance._isDestroyed) {
      // 笔记：不存在组件实例或者实例被销毁了，创建实例并挂载。
      // 因为该组件实例就是当前组件（context）的子组件，所以命名为 child
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        // 笔记：当前渲染的组件实例
        activeInstance,
        parentElm,
        refElm
      )
      // 笔记：组件第一次创建，进行挂载操作，触发子节点的 render 函数生成子节点 vnode，是深度遍历的关键
      // 笔记：如果是混合，使用空挂载（因为 DOM 已经展现了）
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    } else if (vnode.data.keepAlive) {
      // kept-alive components, treat as a patch
      // 翻译：kept-alive 组件, 看作是一个 patch 对待
      // 笔记：
      //  q: 为什么？
      //  a:
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    }
  },

  /**
   * 笔记：patch 前的一些操作
   */
  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    /**
     * 笔记：
     *  q: 为什么要把旧节点组件实例传给新节点？
     *  a：在进行实例不被销毁的情况下，实际上实例是没有变化的，没必要也不应该重新实例化
     */
    const child = vnode.componentInstance = oldVnode.componentInstance

    /**
     * 笔记：
     * 这里更新的是：传递的子组件的 prop，listen，slot 等值
     *  q: 为什么要在父节点 patch 之前更新子组件？
     *  a:
     */
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  /**
   * 笔记：默认的 insert 钩子，触发组件的 mounted 钩子
   */
  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  /**
   * 笔记：
   *  如果是 keep-alive 组件，将组件置为不活动，否则调用组件销毁方法
   */
  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

/**
 * 笔记：
 *  提供给 render 函数使用，生成组件的 vnode
 *
 *  提取占位节点上的 props 和 listeners，
 *  和内部的 slot（实际上就是占位节点的 children）
 */
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | void {
  if (isUndef(Ctor)) {
    return
  }

  /**
   * 笔记：
   *  q: _base 指向哪个构造器？
   *  a: Vue
   */
  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  // 笔记：标准化构造器
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  // 翻译：如果在这个阶段它不是一个构造器或者异步组件工厂函数，提示异常并返回
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // async component
  // 笔记：处理异步组件，cid 不存在，说明是异步？
  let asyncFactory
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context)
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      // 翻译：
      //  为异步组件返回一个占位节点，该节点作为注释节点渲染，但是保留异步组件的所有原始信息
      //  这些信息将被异步服务端渲染和合成中使用
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  // 翻译：解析构造器选项，因为全局的 mixins 可能会在组件构造器生成之后被调用
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  // 翻译：转换组件的 v-model data 为 props 和 events
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  // 翻译：提取 props
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  // 翻译：函数式组件
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  // 翻译：提取 listener，因为这些需要被视为子组件的的 listeners 而不是 DOM 的 listeners
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  // 翻译：替换 带 .native 修饰符的 listeners，因此它在父组件 patch 时就可以得到处理
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot
    // 翻译：抽象组件不会保留 props，listeners 和 slot 以外的东西

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // merge component management hooks onto the placeholder node
  // 翻译：在组件占位节点上合并管理钩子
  mergeHooks(data)

  // return a placeholder vnode
  // 翻译：返回一个占位节点
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )
  return vnode
}

/**
 * 笔记：
 *  为 vnode 创建一个组件实例
 *  此处的 vnode 是一个占位节点，上面存放着组件的选项，
 *  以及写在模板或者 render 函数上的事件监听器 (events) 和属性 (props)
 */
export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
  parentElm?: ?Node,
  refElm?: ?Node
): Component {
  const vnodeComponentOptions = vnode.componentOptions
  const options: InternalComponentOptions = {
    // 笔记：是否组件
    _isComponent: true,

    // 笔记：父组件实例
    parent,

    // 笔记：父组件中占位节点传递的属性（props）
    propsData: vnodeComponentOptions.propsData,

    // 笔记：父组件中占位节点的标签名
    _componentTag: vnodeComponentOptions.tag,

    // 笔记：父组件中的占位节点
    _parentVnode: vnode,

    // 笔记：父组件中的占位节点上的事件监听器（events）
    _parentListeners: vnodeComponentOptions.listeners,

    // 笔记：父组件中渲染的 slot 节点的 vnode 集合
    _renderChildren: vnodeComponentOptions.children,
    _parentElm: parentElm || null,
    _refElm: refElm || null
  }
  // check inline-template render functions
  // 翻译：检查是否有内联模板 render 函数
  // 笔记：组件内联模板会覆盖组件自定义的模板和 render 函数
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  // 笔记：创建一个 vue 组件实例
  return new vnodeComponentOptions.Ctor(options)
}

/**
 * 笔记：合并內建钩子和自定义钩子
 */
function mergeHooks (data: VNodeData) {
  if (!data.hook) {
    data.hook = {}
  }
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const fromParent = data.hook[key]
    const ours = componentVNodeHooks[key]
    data.hook[key] = fromParent ? mergeHook(ours, fromParent) : ours
  }
}

/**
 * 笔记：合并两个钩子函数
 */
function mergeHook (one: Function, two: Function): Function {
  return function (a, b, c, d) {
    one(a, b, c, d)
    two(a, b, c, d)
  }
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
// 翻译：转换组件的 v-model 为 prop 和 event
function transformModel (options, data: any) {
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
  ;(data.props || (data.props = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  if (isDef(on[event])) {
    on[event] = [data.model.callback].concat(on[event])
  } else {
    on[event] = data.model.callback
  }
}
