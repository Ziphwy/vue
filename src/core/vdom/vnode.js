/* @flow */

export default class VNode {

  // 笔记：标签
  tag: string | void;

  // 笔记：数据
  data: VNodeData | void;

  // 笔记：子节点集合
  children: ?Array<VNode>;

  // 笔记：节点文本
  text: string | void;

  // 笔记：真实 DOM 引用
  elm: Node | void;

  // 笔记：命名空间
  ns: string | void;

  // 笔记：
  //  q: context 和 componentInstance 区别是什么？
  //  a: componentInstance 处已解释，context 是该节点所在的组件实例
  context: Component | void; // rendered in this component's scope

  // 笔记：唯一标识？
  key: string | number | void;

  /**
   * 笔记：
   *  q: 节点所在的组件配置？
   *  a: 区别于构造器的 Ctor.options 和 实例的 vm.$options，该属性主要是：
   *     { Ctor, propsData, listeners, tag, children }
   *     即在父组件中提取的，需要传递给子组件的各种配置，如 props 的值，父组件上渲染的 slot
   */
  componentOptions: VNodeComponentOptions | void;

  /**
   * 笔记：
   *  q: 节点所在的组件实例？
   *  a: 不能这么说，而是该节点指向（代替）的组件的实例，虚拟 dom 的构筑和我原来想象的不一样
   *     我原来认为是纯粹的树结构，通过 children 链接，但实际上，如果 dom 如下：
   *     <div>
   *      <div></div>
   *      <my-component></my-component>
   *     </div>
   *     那么虚拟 dom 是这种结构:
   *     rootInstance._vnode = rootVnode;
   *     rootVnode = {
   *      tag: 'div',
   *      context: rootInstance,
   *      children: [
   *        {
   *          tag: 'div'
   *        },
   *        {
   *          tag: 'my-component',
   *          componentInstance: myComponentInstance,
   *        }
   *      ]
   *     }
   *     myComponentInstance._vnode = myComponentVnode;
   *     myComponentVnode = {
   *      tag: 'div',
   *      componentInstance: undefined
   *     }
   */
  componentInstance: Component | void; // component instance

  /**
   * component placeholder node
   *
   * 翻译:
   *  组件占位节点
   *
   * 笔记:
   *  q: 虽然写的是父节点，但注释的是占位节点，挂载节点相关？
   *     创建空节点，先替换旧节点，生成新节点，再替换空节点
   *  a: 不是的，当一个节点是组件时，按上述 componentInstance 说的树，当前节点的父节点的 children 里面有一个占位节点，
   *     占位节点 componentInstance 指向当前节点的实例，当前节点 parent 指向这个占位节点
   */
  parent: VNode | void;

  // strictly internal
  raw: boolean; // contains raw HTML? (server only)

  // 笔记：挂起静态节点
  isStatic: boolean; // hoisted static node

  /**
   * necessary for enter transition check
   *
   * 翻译：
   *  进入过渡检查所必需的
   *
   * 笔记：
   *  1. 是否作为根节点插入，不太理解是进入 transition 节点，还是动画
   */
  isRootInsert: boolean;

  // 笔记：是否空注释占位符
  isComment: boolean; // empty comment placeholder?

  // 笔记：是否克隆节点
  isCloned: boolean; // is a cloned node?

  // 笔记：是否 v-once 节点
  isOnce: boolean; // is a v-once node?

  // 笔记：异步组件工厂函数
  asyncFactory: Function | void; // async component factory function

  // 笔记：异步元数据，q: 暂时不知道怎么用?
  //  a: 放置
  asyncMeta: Object | void;

  // 笔记：是否异步占位符
  isAsyncPlaceholder: boolean;

  // 笔记：服务端渲染上下文，暂时不知道怎么用
  ssrContext: Object | void;

  // 笔记：函数式组件上下文，真实上下文（猜想指向函数式组件的父组件）
  functionalContext: Component | void; // real context vm for functional nodes

  // 笔记：函数式组件配置，用于服务端渲染缓存，暂不清楚具体细节
  functionalOptions: ?ComponentOptions; // for SSR caching

  // 笔记：函数式组件作用域 ID 支持？
  functionalScopeId: ?string; // functioanl scope id support

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.functionalContext = undefined
    this.functionalOptions = undefined
    this.functionalScopeId = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}

// 笔记：创建一个空节点（即注释： <!-- text -->）
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

// 笔记：创建一个文本节点（即匿名块）
export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
/**
 * 翻译：
 *  优化浅复制
 *  用于静态节点和slot节点，因为这些节点可能在多个 render 函数钟被复用，
 *  克隆元素，避免当 DOM 操作依赖于他们的元素引用时发生错误。
 *
 * 笔记：
 *  1. deep 参数表示是否深克隆，但层级只到克隆节点的子节点，为什么？
 *  2. 克隆节点的 isCloned 属性为 true，其他属性大部分源节点一致，为什么不是完全一致呢？
 */
export function cloneVNode (vnode: VNode, deep?: boolean): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    vnode.children,
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.isCloned = true
  if (deep && vnode.children) {
    // 笔记：此处并未对子节点传递 deep = true ?
    cloned.children = cloneVNodes(vnode.children)
  }
  return cloned
}

// 笔记：批量克隆节点
export function cloneVNodes (vnodes: Array<VNode>, deep?: boolean): Array<VNode> {
  const len = vnodes.length
  const res = new Array(len)
  for (let i = 0; i < len; i++) {
    res[i] = cloneVNode(vnodes[i], deep)
  }
  return res
}
