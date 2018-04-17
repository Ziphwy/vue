/* @flow */

import { inBrowser } from 'core/util/env'
import { makeMap } from 'shared/util'

// 笔记：命名空间
export const namespaceMap = {
  svg: 'http://www.w3.org/2000/svg',
  math: 'http://www.w3.org/1998/Math/MathML'
}

// 笔记：保留的 HTML 标签
export const isHTMLTag = makeMap(
  'html,body,base,head,link,meta,style,title,' +
  'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
  'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
  'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
  's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
  'embed,object,param,source,canvas,script,noscript,del,ins,' +
  'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
  'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
  'output,progress,select,textarea,' +
  'details,dialog,menu,menuitem,summary,' +
  'content,element,shadow,template,blockquote,iframe,tfoot'
)

// this map is intentionally selective, only covering SVG elements that may
// contain child elements.
// 翻译：这个 hashmap 是故意有选择的，只覆盖 那些可能有子元素的 SVG 元素
// 笔记：保留的 SVG 标签
export const isSVG = makeMap(
  'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
  'foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
  'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
  true
)

// 笔记：是否是 pre 标签
export const isPreTag = (tag: ?string): boolean => tag === 'pre'

// 是否是保留标签
export const isReservedTag = (tag: string): ?boolean => {
  return isHTMLTag(tag) || isSVG(tag)
}

// 笔记：检查标签的命名空间（编程式创建 SVG 元素需要命名空间）
export function getTagNamespace (tag: string): ?string {
  if (isSVG(tag)) {
    return 'svg'
  }
  // basic support for MathML
  // note it doesn't support other MathML elements being component roots
  // 翻译：只支持最基本的 MathML，注意不支持其他的 MathML 元素作为组件的根节点
  if (tag === 'math') {
    return 'math'
  }
}

// 笔记：用来保存未知元素的缓冲区
const unknownElementCache = Object.create(null)
/**
 * 笔记：
 *  是否未知元素，满足下列任一条件
 *    1. 不是在浏览器环境中的所有元素
 *    2. 不是保留标签（副作用：将使用 document.createElement 创建元素）
 */
export function isUnknownElement (tag: string): boolean {
  /* istanbul ignore if */
  // 非浏览器环境
  if (!inBrowser) {
    return true
  }
  if (isReservedTag(tag)) {
    return false
  }
  tag = tag.toLowerCase()
  /* istanbul ignore if */
  if (unknownElementCache[tag] != null) {
    return unknownElementCache[tag]
  }
  /**
   * 笔记：
   *  没有注册的情况下（document.registerElement）
   *  合法的标签，构造器指向HTMLElement，
   *  非法的标签，元素的构造器会指向 HTMLUnknownElement
   *    其中之一：没有注册且不带连字符的 => 非法
   */
  const el = document.createElement(tag)
  if (tag.indexOf('-') > -1) {
    // http://stackoverflow.com/a/28210364/1070244
    return (unknownElementCache[tag] = (
      el.constructor === window.HTMLUnknownElement ||
      el.constructor === window.HTMLElement
    ))
  } else {
    return (unknownElementCache[tag] = /HTMLUnknownElement/.test(el.toString()))
  }
}

// 笔记：检查 input 的 type 是否合法
export const isTextInputType = makeMap('text,number,password,search,email,tel,url')
