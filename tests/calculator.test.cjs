const test = require("node:test");
const assert = require("node:assert/strict");
const Calc = require("../calculator.js");
const Report = require("../report.js");
const config = extra => ({ ...Calc.DEFAULTS, monthlySalary: 28000, ...extra });

test("奖金月数随月薪联动，固定薪资与奖金分别计入", () => {
  const result = Calc.calculate(config({ bonusMonths: 3 }));
  assert.equal(result.bonus, 84000);
  assert.equal(result.steady.cash, 420000);
  assert.equal(result.netReady, false);
  assert.equal(result.monthlyNet, null);
  assert.equal(Calc.calculate(config({ monthlySalary: 30000, bonusMonths: 3 })).bonus, 90000);
});
test("金额模式和模式切换保留奖金金额", () => {
  const months = config({ bonusMonths: 3 });
  const amount = Calc.switchBonusMode(months, "amount");
  assert.equal(amount.annualBonus, 84000);
  assert.equal(Calc.bonusAmount(Calc.switchBonusMode(amount, "months")), 84000);
  const direct = config({ bonusMode: "amount", annualBonus: 90000 });
  assert.equal(Calc.calculate(direct).steady.cash, 426000);
  assert.ok(Math.abs(Calc.bonusAmount(Calc.switchBonusMode(direct, "months")) - 90000) < .01);
});
test("旧奖金总额与早期奖金月数均能迁移", () => {
  const oldAmount = Calc.migrateState({ monthlySalary: 20000, annualBonus: 50000 });
  assert.equal(oldAmount.bonusMode, "amount");
  assert.equal(Calc.calculate(oldAmount).bonus, 50000);
  const oldMonths = Calc.migrateState({ monthlySalary: 20000, bonusMonths: 3, bonusPayout: 50 });
  assert.equal(oldMonths.bonusMonths, 1.5);
  assert.equal(Calc.calculate(oldMonths).bonus, 30000);
  assert.equal(Calc.migrateState({ monthlySalary: 20000, annualBonus: "" }).bonusMode, "months");
});
test("基数封顶与文字报告使用同一有效基数", () => {
  const result = Calc.calculate(config({ useDefaultTax: true, socialCeiling: 10000, housingCeiling: 10000 }));
  assert.equal(result.contributions.monthly, 1750);
  assert.equal(result.steady.contributions, 21000);
  const report = Report.create(result);
  assert.match(report.contributionText, /社保基数 ¥10,000 × 10.5%/);
  assert.match(Report.toText(report), /公积金基数 ¥10,000 × 7%/);
  assert.equal(report.deductions.find(item => item.key === "contribution").value, "¥21,000");
});
test("显式缴费基数优先，上限 0 与留空有不同含义", () => {
  const manual = Calc.calculate(config({ useDefaultTax: true, socialBase: 20000, socialCeiling: 10000 }));
  assert.equal(manual.contributions.socialBase, 20000);
  const zero = Calc.calculate(config({ useDefaultTax: true, socialCeiling: 0, housingCeiling: 0 }));
  assert.equal(zero.steady.contributions, 0);
});
test("反向上下限标记字段错误并暂停税后计算与导出", () => {
  const result = Calc.calculate(config({ useDefaultTax: true, socialFloor: 20000, socialCeiling: 10000 }));
  assert.ok(result.errors.some(error => error.field === "socialFloor"));
  assert.ok(result.errors.some(error => error.field === "socialCeiling"));
  assert.equal(result.netReady, false);
  assert.equal(result.steady.tax, null);
  assert.equal(Report.create(result).canExport, false);
});
test("试用期只影响首年，首年在职月数与全年扣除分别处理", () => {
  const result = Calc.calculate(config({ monthlySalary: 20000, useDefaultTax: true,
    socialRate: 0, housingRate: 0, firstYearMonths: 6, probationMonths: 2, probationRate: 80 }));
  assert.equal(result.years[0].salary, 112000);
  assert.equal(result.years[0].tax, 2680);
  assert.equal(result.steady.salary, 240000);
});
test("示例识别与两种税后月均口径保持一致", () => {
  const result = Calc.calculate(Calc.EXAMPLE);
  assert.equal(result.isExample, true);
  assert.equal(result.monthlyNet, 21090);
  assert.equal(result.monthlyWithBonus, result.steady.net / 12);
  assert.ok(result.monthlyWithBonus > result.monthlyNet);
  const report = Report.create(result);
  assert.equal(report.tag, "示例方案");
  assert.ok(Report.toText(report).includes(report.headline.value));
});
test("股权待估值时不展示成确定的零估值", () => {
  const report = Report.create(Calc.calculate(config({ equityUnits: 10000 })));
  assert.equal(report.rows.find(row => row.key === "equity").value, "待填估值");
});
