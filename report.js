(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SalaryReport = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const yuan = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
  const money = value => value === null || value === undefined ? "—" : yuan.format(Math.round(value));

  function create(result) {
    const { state, contributions, errors, netReady, hasIncome } = result;
    const gross = result.steady.recurringCash;
    const bonusMonths = state.bonusMode === "months" ? Number(state.bonusMonths || 0)
      : result.monthly > 0 ? result.bonus / result.monthly : null;
    const bonusDescription = state.bonusMode === "months"
      ? `${decimal.format(bonusMonths)} 个月工资`
      : "按税前金额填写";
    const salaryStructure = `固定工资 ${decimal.format(result.salaryMonths)} 个月 + 年终奖 ${state.bonusMode === "months" ? `${decimal.format(bonusMonths)} 个月` : money(result.bonus)}`;
    let headline = { label: "薪酬概览", value: "先填税前月薪", pending: true, secondary: "", caption: "月薪和奖金填好后，结果会实时更新" };
    if (hasIncome) {
      headline = netReady
        ? { label: "税后月均到手", value: money(result.monthlyNet), pending: false,
          secondary: result.bonus > 0 ? `含年终奖年均到手 ${money(result.monthlyWithBonus)}` : "",
          caption: "固定工资和补贴摊到每月，不含年终奖与股权" }
        : gross > 0
          ? { label: "全年税前现金", value: money(gross), pending: false, secondary: salaryStructure,
            caption: "选择缴费参数后，可继续查看税后到手" }
          : { label: "年均股权归属估值", value: result.equityReady ? money(result.annualEquity) : "待填基准估值",
            pending: !result.equityReady, secondary: "", caption: "股权估值单独列示，不计入到手现金" };
    }
    if (errors.length) headline.caption = "请修正标出的参数，税后金额暂不估算";
    if (!result.grossReady) headline = { ...headline, value: "请检查收入参数", pending: true, secondary: "" };

    const taxMode = result.steady.taxMode === "separate" ? "年终奖单独计税" : "并入综合所得";
    const contributionText = netReady
      ? `社保基数 ${money(contributions.socialBase)} × ${contributions.socialRate}%，公积金基数 ${money(contributions.housingBase)} × ${contributions.housingRate}%`
      : errors.length ? "缴费参数需要检查" : "缴费参数待设置，当前展示税前收入";
    const rows = [];
    if (result.monthly > 0) {
      rows.push({ key: "salary", label: "固定工资", detail: `${decimal.format(result.salaryMonths)} 个月`, value: money(result.annualSalary) });
      rows.push({ key: "bonus", label: "年终奖", detail: state.bonusMode === "months" ? `${decimal.format(bonusMonths)} 个月` : "税前金额", value: money(result.bonus) });
    } else if (result.bonus > 0) rows.push({ key: "bonus", label: "年终奖", detail: "税前金额", value: money(result.bonus) });
    if (result.annualAllowance > 0) rows.push({ key: "allowance", label: "现金补贴", value: money(result.annualAllowance) });
    if (Number(state.equityUnits) > 0) rows.push({ key: "equity", label: "年均股权归属估值", value: result.equityReady ? money(result.annualEquity) : "待填估值" });
    const deductions = [
      { key: "tax", label: "年度个税", detail: netReady ? taxMode : "待设置", value: money(result.steady.tax) },
      { key: "contribution", label: "个人社保与公积金", value: money(netReady ? contributions.monthly * 12 : null) }
    ];
    const firstYear = [
      { label: "首年税后可支配现金", value: money(result.years[0].net) },
      { label: "首年税前总包", value: hasIncome ? money(result.years[0].total) : "—" }
    ];
    const notes = [contributionText,
      `专项附加扣除 ${money(Number(state.specialDeduction || 0))}/年；税额按年度汇算估算，实际金额以工资单及申报为准`,
      ...(Number(state.equityUnits) > 0 ? ["股权估值未计流动性折价及离职失效条款"] : [])];
    const report = {
      title: "薪酬估算单", tag: result.isExample ? "示例方案" : hasIncome ? "当前方案" : "待填写",
      hasIncome, netReady, canExport: hasIncome && result.grossReady && errors.length === 0,
      errors, headline, salaryStructure, contributionText, notes,
      cashFormula: `${salaryStructure}${result.annualAllowance > 0 ? ` + 现金补贴 ${money(result.annualAllowance)}` : ""}`,
      bonus: { value: money(result.bonus), description: bonusDescription,
        expression: state.bonusMode === "months" ? `${money(result.monthly)} × ${decimal.format(bonusMonths)} 个月`
          : bonusMonths === null ? "填写月薪后显示对应月数" : `约 ${decimal.format(bonusMonths)} 个月工资` },
      annualCash: hasIncome && result.grossReady ? money(gross) : "—",
      kpis: [
        { label: "税后年现金", value: money(result.steady.net) },
        { label: Number(state.equityUnits) > 0 && !result.equityReady ? "已知税前总包" : "年化税前总包", value: hasIncome ? money(result.annualPackage) : "—" }
      ], rows, deductions, firstYear,
      mix: { cash: result.cashShare, equity: result.equityShare },
      years: hasIncome ? result.years.map((year, index) => ({
        label: `第 ${index + 1} 年`, value: money(year.total), total: year.total,
        cash: year.recurringCash, equity: year.equity || 0, signOn: year.signOn
      })) : [],
      fourYearTotal: hasIncome ? `四年税前合计 ${money(result.years.reduce((total, year) => total + year.total, 0))}` : "",
      scenarios: result.scenarios.map(item => ({ label: `${item.label} ${money(item.price)}/份`, value: money(item.total) })),
      exerciseCost: Number(state.equityUnits) > 0 ? money(result.exerciseCost) : "—",
      taxSummary: errors.some(error => /^(social|housing)/.test(error.field)) ? "基数上下限需要检查"
        : netReady ? `${state.useDefaultTax ? "常见参数" : "自定义参数"}，个人月缴 ${money(contributions.monthly)}` : "设置后显示税后到手",
      extrasSummary: `首年在职 ${state.firstYearMonths || 0} 个月${Number(state.signOnYear1) > 0 ? `，签字费 ${money(Number(state.signOnYear1))}` : ""}`,
      equitySummary: Number(state.equityUnits) > 0 ? `${decimal.format(Number(state.equityUnits))} 份，${state.vestingYears} 年归属` : "按需填写份数、归属和估值"
    };
    return report;
  }

  function toText(report) {
    return [report.title, `${report.headline.label}：${report.headline.value}`,
      ...(report.headline.secondary ? [report.headline.secondary] : []), report.cashFormula,
      `年终奖税前：${report.bonus.value}（${report.bonus.description}）`,
      ...report.kpis.map(item => `${item.label}：${item.value}`),
      ...[...report.rows, ...report.deductions].map(item => `${item.label}${item.detail ? `（${item.detail}）` : ""}：${item.value}`),
      ...report.firstYear.map(item => `${item.label}：${item.value}`), ...report.notes].join("\n");
  }
  return { create, toText, money };
});
