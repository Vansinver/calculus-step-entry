const plotFunctions = Object.freeze({
  sin:Math.sin, cos:Math.cos, tan:Math.tan,
  asin:Math.asin, acos:Math.acos, atan:Math.atan,
  arcsin:Math.asin, arccos:Math.acos, arctan:Math.atan,
  arccot:x=>Math.PI/2-Math.atan(x),
  sqrt:Math.sqrt, abs:Math.abs, exp:Math.exp, log:Math.log, ln:Math.log,
});

function compilePlotExpression(source, variable = 'x') {
  if (typeof source !== 'string' || source.length > 160) throw Error('函数式过长或无效');
  const expression = source.toLowerCase().replace(/\s/g,'').replaceAll('π','pi').replaceAll('−','-').replaceAll('×','*');
  const tokens = expression.match(/\d+(?:\.\d*)?|\.\d+|[a-z]+|[()+\-*/^]/g) || [];
  if (!tokens.length || tokens.join('') !== expression) throw Error('表达式含未支持的字符');
  let i = 0;
  const take = token => tokens[i] === token && (++i > 0);
  function atom() {
    if (take('(')) {
      const value = sum();
      if (!take(')')) throw Error('括号不成对');
      return value;
    }
    const token = tokens[i++];
    if (token === variable) return x => x;
    if (token === 'pi') return () => Math.PI;
    if (token === 'e') return () => Math.E;
    if (/^(?:\d|\.)/.test(token || '') && Number.isFinite(Number(token))) return () => Number(token);
    if (!Object.hasOwn(plotFunctions,token) || !take('(')) throw Error('未支持的函数或运算');
    const fn = plotFunctions[token], value = sum();
    if (!take(')')) throw Error('函数缺少右括号');
    return x => fn(value(x));
  }
  function unary() {
    if (take('+')) return unary();
    if (take('-')) {
      const value = unary();
      return x => -value(x);
    }
    const left = atom();
    if (!take('^')) return left;
    const right = unary();
    return x => Math.pow(left(x),right(x));
  }
  function product() {
    let result = unary();
    while (tokens[i] === '*' || tokens[i] === '/') {
      const op = tokens[i++], left = result, right = unary();
      result = op === '*' ? x => left(x)*right(x) : x => left(x)/right(x);
    }
    return result;
  }
  function sum() {
    let result = product();
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++], left = result, right = product();
      result = op === '+' ? x => left(x)+right(x) : x => left(x)-right(x);
    }
    return result;
  }
  const evaluate = sum();
  if (i !== tokens.length) throw Error('请显式写出乘号');
  return x => {
    const y = evaluate(x);
    return Number.isFinite(y) ? y : null;
  };
}

function validateExpressionPlot(spec) {
  if (spec?.kind === 'parametric' || spec?.kind === 'polar') {
    const [min,max] = Array.isArray(spec.tRange) ? spec.tRange : [];
    if (![min,max].every(Number.isFinite) || min < -1000 || max > 1000 || max-min < 0.0001) throw Error('参数区间无效');
    if (spec.kind === 'parametric') {
      compilePlotExpression(spec.x, 't');
      compilePlotExpression(spec.y, 't');
      return {kind:spec.kind,x:spec.x,y:spec.y,tRange:[min,max]};
    }
    compilePlotExpression(spec.r, 't');
    return {kind:spec.kind,r:spec.r,tRange:[min,max]};
  }
  if (spec?.kind && spec.kind !== 'explicit') throw Error('未支持的绘图类型');
  if (!spec || !Array.isArray(spec.expressions) || ![1,2].includes(spec.expressions.length)) throw Error('需要一到两条函数曲线');
  const [min,max] = Array.isArray(spec.xRange) ? spec.xRange : [-5,5];
  if (![min,max].every(Number.isFinite) || min < -1000 || max > 1000 || max-min < 0.0001) throw Error('绘图区间无效');
  const expressions = spec.expressions.map(text => {
    compilePlotExpression(text);
    return text;
  });
  return {expressions,xRange:[min,max]};
}

function compilePlotPoint(spec) {
  if (spec.kind === 'parametric') {
    const x = compilePlotExpression(spec.x, 't'), y = compilePlotExpression(spec.y, 't');
    return t => [x(t),y(t)];
  }
  const radius = compilePlotExpression(spec.r, 't');
  return t => {
    const r = radius(t);
    return r === null ? [null,null] : [r*Math.cos(t),r*Math.sin(t)];
  };
}

function expressionPlotRequest(message, history) {
  const previous = history.filter(item=>item.expressionPlot).slice(-2).map(item=>item.expressionPlot);
  return message + '\n【平台表达式绘图】只有本轮明确需要图或修改上张图时才输出图。最后一行必须是 [[plot:JSON对象]]，不加代码围栏。\n'
    + '显函数示例 [[plot:{"expressions":["arccot(x)"],"xRange":[-5,5]}]]。参数曲线示例 [[plot:{"kind":"parametric","x":"t-sin(t)","y":"1-cos(t)","tRange":[0,6.283185307179586]}]]。极坐标示例 [[plot:{"kind":"polar","r":"2*cos(3*t)","tRange":[0,6.283185307179586]}]]。\n'
    + '参数和极角都写作 t，使用弧度，乘号必须写 *。表达式支持 + - * / ^、括号、pi、e、sin、cos、tan、arcsin、arccos、arctan、arccot、sqrt、abs、exp、ln。区间用两个有限数字。仅改范围时保留上张图的公式，仅改参数时保留其他条件。不能明确公式时先问清楚。近期图参数：'
    + JSON.stringify(previous);
}

function expressionPaths(fn, min, max, limit, project, count = 800) {
  const points = [];
  let previous = null;
  for (let i=0;i<=count;i++) {
    const x = min+(max-min)*i/count, y = fn(x);
    if (y === null || Math.abs(y) > limit) {
      previous = null;
      continue;
    }
    const middle = previous && fn((previous.x+x)/2);
    const joined = previous && middle !== null && Math.abs(middle) <= limit &&
      Math.abs(y-previous.y) < limit && Math.abs(middle-(y+previous.y)/2) < limit/3;
    points.push((joined?'L':'M')+project(x,y));
    previous = {x,y};
  }
  return points.join(' ');
}

function shouldUseExpressionPlot(message, history) {
  if (/别画|不要画|不用画|不必画|只要文字|怎么画|如何画/.test(message)) return false;
  const draw = /画|(?:来|看|生成|绘制|显示|给).{0,25}(?:图|曲线)|用图解释/.test(message);
  const edit = /放在一起|叠在|放大|缩小|(?:横轴|纵轴|区间|范围|半径|参数|系数|底数).{0,15}(?:改|换|设|调|缩到|扩到)/.test(message);
  const hasExpression = history.some(item=>item.expressionPlot);
  if (edit && hasExpression) return true;
  if (!draw) return false;
  if (hasExpression) return true;
  const namedTrial = /反正弦|arcsin|倒数函数|1\s*\/\s*x/i.test(message);
  const formula = /[=^*]|\([^)]+\)|x\s*[-+]\s*\d|反余切|arccot/i.test(message);
  return !namedTrial || formula;
}

function readExpressionPlot(raw) {
  const reply = raw.trim();
  const marker = /(?:^|\n)(?:[ \t]*```(?:json)?[ \t]*\r?\n)?[ \t]*\[\[plot:/gi;
  const block = Array.from(reply.matchAll(marker)).pop();
  if (!block) {
    return {text:reply+'\n\n本轮没有生成图卡。可以补充函数式或绘图范围，再试一次。'};
  }
  const text = reply.slice(0,block.index).trim();
  const content = reply.slice(block.index+block[0].length);
  const payload = content.match(/^\s*(\{[\s\S]*\})\s*\]\](?:[ \t]*\r?\n[ \t]*```)?\s*$/);
  try {
    if (!payload) throw Error('绘图参数不完整');
    return {text:text||'拖动滑块观察曲线。',spec:validateExpressionPlot(JSON.parse(payload[1]))};
  } catch {
    return {text:(text ? text+'\n\n' : '')+'这次的绘图参数没有通过检查。可以用更具体的函数式再试一次。'};
  }
}
