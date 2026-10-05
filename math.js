export function evaluateArithmetic(source) {
  if (typeof source !== "string" || source.length === 0 || source.length > 100) {
    throw new Error("Enter an expression under 100 characters.");
  }

  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%^]/g) ?? [];
  if (tokens.join("").replaceAll(".", "") === "" || tokens.join("") !== source.replace(/\s+/g, "")) {
    throw new Error("Only numbers, parentheses, and + - * / % ^ are supported.");
  }

  let cursor = 0;
  let depth = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];

  function primary() {
    if (++depth > 30) throw new Error("That expression is nested too deeply.");
    const token = take();
    let value;
    if (token === "(") {
      value = additive();
      if (take() !== ")") throw new Error("Check the parentheses in that expression.");
    } else if (token === "+" || token === "-") {
      const operand = primary();
      value = token === "-" ? -operand : operand;
    } else if (token !== undefined && /^\d*\.?\d+$/.test(token)) {
      value = Number(token);
    } else {
      throw new Error("That expression is incomplete.");
    }
    depth--;
    return value;
  }

  function power() {
    const left = primary();
    if (peek() !== "^") return left;
    take();
    const exponent = power();
    if (Math.abs(exponent) > 20) throw new Error("Exponents must be between -20 and 20.");
    return left ** exponent;
  }

  function multiplicative() {
    let value = power();
    while (["*", "/", "%"].includes(peek())) {
      const operator = take();
      const right = power();
      if ((operator === "/" || operator === "%") && right === 0) throw new Error("Division by zero is undefined.");
      value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
    }
    return value;
  }

  function additive() {
    let value = multiplicative();
    while (peek() === "+" || peek() === "-") {
      const operator = take();
      const right = multiplicative();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = additive();
  if (cursor !== tokens.length) throw new Error("There is extra text after the expression.");
  if (!Number.isFinite(result)) throw new Error("That calculation is outside the supported range.");
  return result;
}

export function parseDuration(input) {
  const match = /^(\d{1,5})(s|m|h|d)$/i.exec(input ?? "");
  if (!match) return null;
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2].toLowerCase()];
  return Number(match[1]) * multiplier;
}