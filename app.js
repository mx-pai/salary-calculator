(() => {
  "use strict";
  const Calc = window.SalaryCalculator, Report = window.SalaryReport;
  const storageKey = "mx-pai-salary-calculator-v1";
  const fields = [...document.querySelectorAll("[data-key]")];
  const fieldsByKey = new Map(fields.map(field => [field.dataset.key, field]));
  const $ = selector => document.querySelector(selector);
  const setText = (selector, value) => { $(selector).textContent = value; };
  let report, state, statusTimer, announceTimer, clearTimer;

  function readStored() {
    try {
      for (const key of [storageKey, "salary-ledger-v3", "salary-ledger-v2"]) {
        const saved = localStorage.getItem(key);
        if (saved) return Calc.migrateState(JSON.parse(saved));
      }
    } catch (_) { /* 受限环境仍可在当前页面计算 */ }
    return { ...Calc.DEFAULTS };
  }
  function writeForm(values) {
    for (const field of fields) {
      if (field.type === "checkbox") field.checked = values[field.dataset.key] === true;
      else field.value = values[field.dataset.key] ?? "";
    }
  }
  function readForm() {
    return Object.fromEntries(fields.map(field => [field.dataset.key, field.type === "checkbox" ? field.checked : field.value]));
  }
  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function renderRows(selector, rows) {
    $(selector).replaceChildren(...rows.map(item => {
      const row = element("div", "breakdown-row");
      row.dataset.kind = item.key;
      const label = element("span", "row-label", item.label);
      if (item.detail) label.append(element("small", "", item.detail));
      const leader = element("i", "leader");
      leader.setAttribute("aria-hidden", "true");
      row.append(label, leader, element("strong", "", item.value));
      return row;
    }));
  }
  function renderErrors(errors) {
    for (const field of fields) {
      const message = errors.filter(error => error.field === field.dataset.key).map(error => error.message).join("，");
      const label = document.querySelector(`[data-error-for="${field.dataset.key}"]`);
      field.setAttribute("aria-invalid", String(Boolean(message)));
      field.closest(".field")?.classList.toggle("is-invalid", Boolean(message));
      if (label) { label.textContent = message; label.hidden = !message; }
      if (message) {
        for (let parent = field.parentElement; parent; parent = parent.parentElement) {
          if (parent.tagName === "DETAILS") parent.open = true;
        }
      }
    }
    const income = errors.filter(error => ["monthlySalary", "salaryMonths", "bonusMonths", "annualBonus"].includes(error.field));
    const tax = errors.filter(error => /^(social|housing|specialDeduction)/.test(error.field));
    for (const [selector, group] of [["#income-errors", income], ["#tax-errors", tax]]) {
      const node = $(selector);
      node.hidden = !group.length;
      node.textContent = group.length ? "请检查下方标出的输入参数" : "";
    }
  }
  function render(value) {
    const mode = state.bonusMode;
    document.querySelectorAll("[data-bonus-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.bonusMode === mode)));
    document.querySelectorAll("[data-bonus-panel]").forEach(panel => {
      panel.hidden = panel.dataset.bonusPanel !== mode;
      panel.querySelector("input").disabled = panel.hidden;
    });
    setText("#bonus-equivalent-label", mode === "months" ? "税前金额" : "折合工资");
    setText("#bonus-equivalent", mode === "months" ? value.bonus.value : value.bonus.expression);
    setText("#bonus-expression", mode === "months" ? value.bonus.expression : `年终奖税前 ${value.bonus.value}`);
    setText("#cash-preview", value.annualCash);
    setText("#income-formula", value.cashFormula);
    setText("#example-tag", value.tag);
    setText("#headline-label", value.headline.label);
    setText("#monthly-net", value.headline.value);
    $("#monthly-net").classList.toggle("is-pending", value.headline.pending);
    setText("#monthly-with-bonus", value.headline.secondary);
    $("#monthly-with-bonus").hidden = !value.headline.secondary;
    setText("#result-caption", value.headline.caption);
    setText("#assumption-hint", value.contributionText);
    setText("#tax-settings-summary", value.taxSummary);
    setText("#extras-summary", value.extrasSummary);
    setText("#equity-summary", value.equitySummary);
    $("#result-kpis").replaceChildren(...value.kpis.map(item => {
      const node = element("div"); node.append(element("span", "", item.label), element("strong", "", item.value)); return node;
    }));
    $("#cash-fill").style.width = `${value.mix.cash * 100}%`;
    $("#equity-fill").style.width = `${value.mix.equity * 100}%`;
    renderRows("#income-breakdown", value.rows);
    renderRows("#deduction-breakdown", value.deductions);
    $("#deduction-breakdown").hidden = !value.hasIncome;
    $("#first-year-results").hidden = !value.hasIncome;
    $("#first-year-results").replaceChildren(...value.firstYear.map(item => {
      const node = element("div", "first-year"); node.append(element("span", "", item.label), element("strong", "", item.value)); return node;
    }));
    const maxYear = Math.max(...value.years.map(year => year.total), 1);
    $("#year-list").replaceChildren(...value.years.map(year => {
      const row = element("div", "year-row"), track = element("div", "year-track");
      track.setAttribute("aria-label", `${year.label} ${year.value}`);
      for (const [amount, className] of [[year.cash, "year-cash"], [year.equity, "year-equity"], [year.signOn, "year-sign-on"]]) {
        const segment = element("span", className); segment.style.width = `${amount / maxYear * 100}%`; track.append(segment);
      }
      row.append(element("span", "year-name", year.label), track, element("strong", "year-total", year.value)); return row;
    }));
    setText("#four-year-total", value.fourYearTotal);
    $("#scenario-list").replaceChildren(...(value.scenarios.length ? value.scenarios.map(item => {
      const node = element("div", "scenario"); node.append(element("span", "", item.label), element("strong", "", item.value)); return node;
    }) : [element("p", "empty-result", "填写期权份数和三个估值后显示") ]));
    setText("#exercise-cost", value.exerciseCost);
    $(".result-more").hidden = !value.hasIncome;
    for (const selector of ["#copy-results", "#copy-image", "#download-image"]) $(selector).disabled = !value.canExport;
    renderErrors(value.errors);
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => setText("#result-announcer", `${value.headline.label} ${value.headline.value}`), 700);
  }
  function update() {
    state = readForm();
    report = Report.create(Calc.calculate(state));
    render(report);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ schemaVersion: 2, ...state }));
      setText("#storage-note", "输入保存在此浏览器");
    } catch (_) { setText("#storage-note", "输入仅保留在当前页面"); }
  }
  function setStatus(message) {
    clearTimeout(statusTimer); setText("#action-status", message);
    statusTimer = setTimeout(() => setText("#action-status", ""), 3500);
  }
  async function copyText() {
    const value = Report.toText(report);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setStatus("结果已复制");
    } catch (_) {
      const focused = document.activeElement;
      const buffer = element("textarea"); buffer.value = value; buffer.className = "visually-hidden";
      document.body.append(buffer); buffer.select();
      let copied = false;
      try { copied = document.execCommand("copy"); } catch (_) { /* 浏览器可能限制旧式复制 */ }
      buffer.remove(); focused?.focus({ preventScroll: true });
      setStatus(copied ? "结果已复制" : "复制未完成，请使用图片下载");
    }
  }
  function imageBlob(snapshot) {
    const css = getComputedStyle(document.documentElement);
    const tokens = { page: "--page", paper: "--paper-warm", ink: "--ink", muted: "--muted", line: "--line", cash: "--cash", equity: "--equity", green: "--hero", greenInk: "--hero-ink", greenSoft: "--hero-soft", greenBorder: "--hero-border", accent: "--accent" };
    const palette = Object.fromEntries(Object.entries(tokens).map(([key, token]) => [key, css.getPropertyValue(token).trim()]));
    return Promise.resolve(document.fonts?.ready).then(() => {
      const canvas = window.SalaryImage.render(snapshot, { palette, fontFamily: css.fontFamily });
      return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG unavailable")), "image/png"));
    });
  }
  function saveImageFile(blob) {
    const url = URL.createObjectURL(blob), link = element("a"), now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    link.href = url; link.download = `薪资估算-${date}.png`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportImage(copy) {
    const pending = imageBlob(report);
    try {
      if (copy && navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": pending })]);
        setStatus("图片已复制，可直接粘贴");
      } else { saveImageFile(await pending); setStatus(copy ? "当前环境改为下载 PNG" : "PNG 已下载"); }
    } catch (_) {
      try { saveImageFile(await pending); setStatus("复制未完成，已下载 PNG"); }
      catch (_) { setStatus("图片生成未完成，请重试"); }
    }
  }
  function resetClearButton() {
    clearTimeout(clearTimer); $("#clear-button").classList.remove("is-confirming"); setText("#clear-button", "清空输入");
  }
  fields.forEach(field => field.addEventListener(field.type === "checkbox" || field.tagName === "SELECT" ? "change" : "input", update));
  document.querySelectorAll("[data-bonus-mode]").forEach(button => button.addEventListener("click", () => {
    state = Calc.switchBonusMode(readForm(), button.dataset.bonusMode); writeForm(state); update();
  }));
  $("#reset-button").addEventListener("click", () => { resetClearButton(); writeForm(Calc.EXAMPLE); update(); });
  $("#clear-button").addEventListener("click", () => {
    if (!$("#clear-button").classList.contains("is-confirming")) {
      $("#clear-button").classList.add("is-confirming"); setText("#clear-button", "确认清空");
      clearTimer = setTimeout(resetClearButton, 3500); return;
    }
    resetClearButton(); writeForm(Calc.DEFAULTS); update();
  });
  $("#edit-tax").addEventListener("click", () => {
    $("#tax-settings").open = true;
    $("#tax-settings").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    fieldsByKey.get("socialBase").focus({ preventScroll: true });
  });
  $("#copy-results").addEventListener("click", copyText);
  $("#copy-image").addEventListener("click", () => exportImage(true));
  $("#download-image").addEventListener("click", () => exportImage(false));
  state = readStored(); writeForm(state); update();
})();
