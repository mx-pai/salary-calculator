(() => {
  "use strict";
  const Calc = window.SalaryCalculator, Report = window.SalaryReport;
  const storageKey = "mx-pai-salary-calculator-v1";
  const fields = [...document.querySelectorAll("[data-key]")];
  const fieldsByKey = new Map(fields.map(field => [field.dataset.key, field]));
  const $ = selector => document.querySelector(selector);
  const setText = (selector, value) => { $(selector).textContent = value; };
  let report, state, statusTimer, announceTimer, clearTimer;
  let receiptStyle = "paper", resultView = "receipt", selectedMonth = 1;
  let exportSnapshot, exportStyle, exportMeta, exportBlob, exportUrl, exportRevision = 0;
  try { receiptStyle = localStorage.getItem("mx-pai-receipt-style") === "thermal" ? "thermal" : "paper"; } catch (_) { /* 使用默认纸张 */ }

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
    setText("#salary-equivalent", value.annualSalary);
    setText("#inline-monthly-net", value.headline.value);
    $("#live-net-summary").hidden = !value.netReady;
    setText("#income-formula", value.cashFormula);
    setText("#example-tag", value.tag);
    setText("#headline-label", value.headline.label);
    setText("#monthly-net", value.headline.value);
    $("#monthly-net").classList.toggle("is-pending", value.headline.pending);
    setText("#monthly-with-bonus", value.headline.secondary);
    $("#monthly-with-bonus").hidden = !value.headline.secondary;
    setText("#result-caption", value.headline.caption);
    setText("#assumption-hint", value.contributionText);
    $("#tax-assumption-help").hidden = value.netReady;
    setText("#tax-settings-summary", value.taxSummary);
    setText("#extras-summary", value.extrasSummary);
    setText("#equity-summary", value.equitySummary);
    $("#result-kpis").replaceChildren(...value.kpis.map(item => {
      const node = element("div"); node.append(element("span", "", item.label), element("strong", "", item.value)); return node;
    }));
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
    $("#generate-receipt").disabled = !value.canExport;
    renderErrors(value.errors);
    document.querySelectorAll("[data-quick-key]").forEach(button => button.setAttribute("aria-pressed", String(String(state[button.dataset.quickKey]).trim() !== "" && Number(state[button.dataset.quickKey]) === Number(button.dataset.quickValue))));
    document.querySelectorAll("[data-step-key]").forEach(button => {
      const field = fieldsByKey.get(button.dataset.stepKey), delta = Number(button.dataset.stepValue);
      const current = Number.isFinite(field.valueAsNumber) ? field.valueAsNumber : 0;
      const min = field.min === "" ? -Infinity : Number(field.min), max = field.max === "" ? Infinity : Number(field.max);
      button.disabled = field.disabled || (delta < 0 ? current <= min : current >= max);
    });
    $("#bonus-quick-picks").hidden = mode !== "months";
    renderPayroll(value.payroll);
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => setText("#result-announcer", `${value.headline.label} ${value.headline.value}`), 700);
  }
  function showResultView(view, focus = false) {
    resultView = view === "monthly" ? "monthly" : "receipt";
    $("#receipt-view").hidden = resultView !== "receipt";
    $("#monthly-view").hidden = resultView !== "monthly";
    document.querySelectorAll("[data-result-view]").forEach(button => {
      const active = button.dataset.resultView === resultView;
      button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
  }
  function renderPayroll(payroll) {
    $("#bonus-timing-field").hidden = !report.timing.bonus;
    $("#extra-timing-field").hidden = !report.timing.extra;
    $(".payroll-settings").hidden = $("#bonus-timing-field").hidden && $("#extra-timing-field").hidden;
    $("#monthly-empty").hidden = Boolean(payroll); $("#monthly-content").hidden = !payroll;
    if (!payroll) return;
    setText("#monthly-timing", payroll.timing);
    setText("#monthly-scope", payroll.scope);
    setText("#monthly-reconciliation", payroll.reconciliation);
    $("#monthly-reconciliation").hidden = !payroll.reconciliation;
    setText("#year-payroll-tax", payroll.totalTax); setText("#year-payroll-net", payroll.totalNet);
    $("#month-chart").replaceChildren(...payroll.months.map(month => {
      const button = element("button", "month-column"); button.type = "button"; button.dataset.payrollMonth = month.month;
      button.setAttribute("aria-label", `${month.label}到手 ${month.net}，个税 ${month.tax}`);
      const bar = element("span", "month-bar"); bar.style.height = `${4 + month.height * 52}px`; bar.setAttribute("aria-hidden", "true");
      button.append(bar, element("span", "month-name", String(month.month)));
      button.title = `${month.label}到手 ${month.net}`; return button;
    }));
    $("#monthly-table-body").replaceChildren(...payroll.months.map(month => {
      const row = element("tr"), heading = element("th"); heading.scope = "row"; row.dataset.monthRow = month.month;
      const button = element("button", "", `${month.month}月`); button.type = "button"; button.dataset.payrollMonth = month.month;
      heading.append(button); row.append(heading, element("td", "", month.tax), element("td", "", month.cumulativeTax), element("td", "", month.net)); return row;
    }));
    renderSelectedMonth();
  }
  function renderSelectedMonth() {
    const payroll = report.payroll;
    if (!payroll) return;
    const month = payroll.months[selectedMonth - 1];
    setText("#selected-month-label", `${month.label}预计到手`);
    setText("#selected-month-net", month.net); setText("#selected-month-tax", month.tax);
    setText("#selected-month-cumulative", month.cumulativeTax);
    setText("#selected-month-event", month.event); $("#selected-month-event").hidden = !month.event;
    renderRows("#monthly-current", month.current); renderRows("#month-tax-calculation", month.calculation);
    document.querySelectorAll("[data-payroll-month]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.payrollMonth) === selectedMonth)));
    document.querySelectorAll("[data-month-row]").forEach(row => row.classList.toggle("is-selected", Number(row.dataset.monthRow) === selectedMonth));
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
    clearTimeout(statusTimer);
    setText("#export-status", message);
    statusTimer = setTimeout(() => setText("#export-status", ""), 4500);
  }
  async function imageBlob(snapshot, options) {
    const css = getComputedStyle(document.documentElement);
    await document.fonts?.ready;
    const canvas = window.SalaryImage.render(snapshot, { ...options, fontFamily: css.fontFamily });
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG unavailable")), "image/png"));
  }
  function saveImageFile(blob, style = exportStyle, meta = exportMeta) {
    const url = URL.createObjectURL(blob), link = element("a");
    link.href = url; link.download = `薪酬估算-${meta.date}-${style === "thermal" ? "热敏" : "和纸"}.png`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function setReceiptStyle(style) {
    receiptStyle = style === "thermal" ? "thermal" : "paper";
    $("#receipt-sheet").dataset.style = receiptStyle;
    $("#receipt-style").value = receiptStyle;
    try { localStorage.setItem("mx-pai-receipt-style", receiptStyle); } catch (_) { /* 当前页面仍可切换 */ }
  }
  async function refreshExport() {
    const revision = ++exportRevision;
    exportBlob = null;
    $("#copy-image").disabled = true; $("#download-image").disabled = true;
    $("#export-canvas").setAttribute("aria-busy", "true");
    setText("#export-loading", "正在生成工资条"); $("#export-loading").hidden = false;
    setText("#export-status", "");
    const options = { style: exportStyle, meta: exportMeta };
    try {
      const blob = await imageBlob(exportSnapshot, options);
      if (revision !== exportRevision || !$("#receipt-dialog").open) return;
      if (exportUrl) URL.revokeObjectURL(exportUrl);
      exportBlob = blob; exportUrl = URL.createObjectURL(blob);
      $("#export-preview").src = exportUrl; $("#export-preview").hidden = false;
      $("#copy-image").disabled = false; $("#download-image").disabled = false;
      $("#export-loading").hidden = true;
    } catch (_) { if (revision === exportRevision) setText("#export-loading", "图片生成未完成，请关闭后重试"); }
    finally { if (revision === exportRevision) $("#export-canvas").setAttribute("aria-busy", "false"); }
  }
  function openExport() {
    if (!report.canExport) return;
    exportSnapshot = report; exportStyle = receiptStyle; exportMeta = window.SalaryImage.metadata(report);
    $("#export-preview").hidden = true;
    $("#export-canvas").classList.remove("is-zoomed");
    $("#export-preview").setAttribute("aria-pressed", "false");
    $("#export-preview").setAttribute("aria-label", "放大工资条预览");
    $("#receipt-dialog").showModal(); refreshExport();
  }
  async function exportImage(copy) {
    const blob = exportBlob, style = exportStyle, meta = exportMeta;
    if (!blob) return;
    try {
      if (copy && navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setStatus("图片已复制，可直接粘贴");
      } else { saveImageFile(blob, style, meta); setStatus(copy ? "当前环境已改为保存 PNG" : "工资条已保存"); }
    } catch (_) { saveImageFile(blob, style, meta); setStatus("复制未完成，已改为保存图片"); }
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
  function editTax() {
    $("#tax-settings").open = true;
    $("#tax-settings").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    fieldsByKey.get("socialBase").focus({ preventScroll: true });
  }
  $("#edit-tax").addEventListener("click", editTax);
  document.querySelectorAll("[data-edit-tax]").forEach(button => button.addEventListener("click", editTax));
  document.querySelectorAll("[data-quick-key]").forEach(button => button.addEventListener("click", () => {
    fieldsByKey.get(button.dataset.quickKey).value = button.dataset.quickValue; update();
  }));
  document.querySelectorAll("[data-step-key]").forEach(button => button.addEventListener("click", () => {
    const field = fieldsByKey.get(button.dataset.stepKey);
    const current = Number.isFinite(field.valueAsNumber) ? field.valueAsNumber : 0;
    const min = field.min === "" ? -Infinity : Number(field.min), max = field.max === "" ? Infinity : Number(field.max);
    field.value = Math.min(max, Math.max(min, Number((current + Number(button.dataset.stepValue)).toPrecision(12))));
    update();
  }));
  document.querySelectorAll("[data-result-view]").forEach(button => {
    button.addEventListener("click", () => showResultView(button.dataset.resultView));
    button.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      showResultView(event.key === "Home" ? "receipt" : event.key === "End" ? "monthly" : resultView === "receipt" ? "monthly" : "receipt", true);
    });
  });
  $("#monthly-view").addEventListener("click", event => {
    const button = event.target.closest("[data-payroll-month]");
    if (button) {
      selectedMonth = Number(button.dataset.payrollMonth); renderSelectedMonth();
      if (button.closest("table")) {
        $("#monthly-headline").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        $("#monthly-headline").focus({ preventScroll: true });
      }
    }
  });
  $("#receipt-style").addEventListener("change", event => setReceiptStyle(event.target.value));
  $("#generate-receipt").addEventListener("click", openExport);
  function toggleImageZoom() {
    const zoomed = $("#export-canvas").classList.toggle("is-zoomed");
    $("#export-preview").setAttribute("aria-pressed", String(zoomed));
    $("#export-preview").setAttribute("aria-label", zoomed ? "缩小工资条预览" : "放大工资条预览");
  }
  $("#export-preview").addEventListener("click", toggleImageZoom);
  $("#export-preview").addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleImageZoom(); }
  });
  $("#close-export").addEventListener("click", () => $("#receipt-dialog").close());
  $("#receipt-dialog").addEventListener("close", () => {
    ++exportRevision; exportBlob = null;
    $("#export-preview").removeAttribute("src");
    if (exportUrl) { URL.revokeObjectURL(exportUrl); exportUrl = null; }
  });
  $("#copy-image").addEventListener("click", () => exportImage(true));
  $("#download-image").addEventListener("click", () => exportImage(false));
  state = readStored(); writeForm(state); setReceiptStyle(receiptStyle); update();
})();
