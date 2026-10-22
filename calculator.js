(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SalaryCalculator = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const DEFAULTS = Object.freeze({
    monthlySalary: "", salaryMonths: 12, bonusMode: "months", bonusMonths: "", annualBonus: "",
    annualAllowance: "", firstYearMonths: 12, probationMonths: 0, probationRate: 100,
    signOnYear1: "", signOnYear2: "", signOnReserve: "", useDefaultTax: false,
    socialBase: "", socialRate: "", socialFloor: "", socialCeiling: "",
    housingBase: "", housingRate: "", housingFloor: "", housingCeiling: "",
    specialDeduction: "", bonusTaxMode: "auto", bonusPayMonth: 12, extraSalaryPayMonth: 12, equityUnits: "", vestingYears: 4,
    cliffMonths: 12, strikePrice: "", shareLow: "", shareBase: "", shareHigh: ""
  });
  const EXAMPLE = Object.freeze({
    ...DEFAULTS, monthlySalary: 28000, bonusMonths: 3, annualAllowance: 3000,
    signOnYear1: 10000, useDefaultTax: true, equityUnits: 10000,
    strikePrice: 4, shareLow: 6, shareBase: 12, shareHigh: 18
  });
  const LIMITS = {
    salaryMonths: [0, 24], bonusMonths: [0, 36], firstYearMonths: [0, 12],
    probationMonths: [0, 12], bonusPayMonth: [1, 12], extraSalaryPayMonth: [1, 12], probationRate: [0, 100], socialRate: [0, 30],
    housingRate: [0, 30], vestingYears: [0.25, 20], cliffMonths: [0, 240]
  };
  const hasValue = value => value !== null && value !== undefined && String(value).trim() !== "";
  const number = (state, key, fallback = 0) => {
    const value = Number(state[key]);
    return hasValue(state[key]) && Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function migrateState(saved) {
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { ...DEFAULTS };
    const state = Object.fromEntries(Object.keys(DEFAULTS).map(key => [key,
      Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] : DEFAULTS[key]
    ]));
    state.useDefaultTax = saved.useDefaultTax === true;
    if (!["months", "amount"].includes(saved.bonusMode)) {
      if (Object.prototype.hasOwnProperty.call(saved, "annualBonus") && hasValue(saved.annualBonus)) state.bonusMode = "amount";
      else if (Object.prototype.hasOwnProperty.call(saved, "bonusMonths")) {
        state.bonusMode = "months";
        state.bonusMonths = number(saved, "bonusMonths") * number(saved, "bonusPayout", 100) / 100;
      }
    }
    if (!["auto", "combined", "separate"].includes(state.bonusTaxMode)) state.bonusTaxMode = "auto";
    return state;
  }

  function bonusAmount(state) {
    return state.bonusMode === "amount" ? number(state, "annualBonus")
      : number(state, "monthlySalary") * number(state, "bonusMonths");
  }

  function switchBonusMode(state, mode) {
    if (mode === state.bonusMode) return { ...state };
    const amount = bonusAmount(state);
    const monthly = number(state, "monthlySalary");
    return mode === "amount"
      ? { ...state, bonusMode: mode, annualBonus: amount || "" }
      : { ...state, bonusMode: mode, bonusMonths: monthly > 0 ? Number((amount / monthly).toPrecision(12)) : "" };
  }

  function validate(state) {
    const errors = [];
    for (const [key, value] of Object.entries(state)) {
      if (key === "useDefaultTax" || key === "bonusMode" || key === "bonusTaxMode" || !hasValue(value)) continue;
      if ((key === "annualBonus" && state.bonusMode !== "amount") || (key === "bonusMonths" && state.bonusMode !== "months")) continue;
      const amount = Number(value);
      const [low, high] = LIMITS[key] || [0, Infinity];
      if (!Number.isFinite(amount) || amount < low || amount > high || (["bonusPayMonth", "extraSalaryPayMonth"].includes(key) && !Number.isInteger(amount))) {
        errors.push({ field: key, message: high === Infinity ? "请输入不小于 0 的数字" : `请输入 ${low} 到 ${high} 之间的数值` });
      }
    }
    for (const prefix of ["social", "housing"]) {
      const floor = `${prefix}Floor`, ceiling = `${prefix}Ceiling`;
      if (hasValue(state[floor]) && hasValue(state[ceiling]) && number(state, floor) > number(state, ceiling)) {
        errors.push({ field: floor, message: "下限不能高于上限" }, { field: ceiling, message: "上限不能低于下限" });
      }
    }
    return errors;
  }

  function effectiveContributions(state) {
    const assumed = state.useDefaultTax;
    const monthly = number(state, "monthlySalary");
    const base = prefix => {
      if (hasValue(state[`${prefix}Base`])) return number(state, `${prefix}Base`);
      if (!assumed) return null;
      const low = number(state, `${prefix}Floor`);
      const high = hasValue(state[`${prefix}Ceiling`]) ? number(state, `${prefix}Ceiling`) : Infinity;
      return low <= high ? clamp(monthly, low, high) : null;
    };
    const rate = (prefix, fallback) => hasValue(state[`${prefix}Rate`])
      ? number(state, `${prefix}Rate`) : assumed ? fallback : null;
    const socialBase = base("social"), housingBase = base("housing");
    const socialRate = rate("social", 10.5), housingRate = rate("housing", 7);
    const ready = [socialBase, socialRate, housingBase, housingRate].every(value => value !== null);
    return { socialBase, socialRate, housingBase, housingRate, ready,
      monthly: ready ? socialBase * socialRate / 100 + housingBase * housingRate / 100 : null };
  }

  const INCOME_BRACKETS = [[36000, .03, 0], [144000, .1, 2520], [300000, .2, 16920],
    [420000, .25, 31920], [660000, .3, 52920], [960000, .35, 85920], [Infinity, .45, 181920]];
  const bracketFor = income => INCOME_BRACKETS.find(([limit]) => Math.max(0, income) <= limit);
  function progressiveTax(income) {
    const taxable = Math.max(0, income);
    const [, rate, deduction] = bracketFor(taxable);
    return Math.max(0, taxable * rate - deduction);
  }

  function separateBonusTax(bonus) {
    if (bonus <= 0) return 0;
    const brackets = [[3000, .03, 0], [12000, .1, 210], [25000, .2, 1410],
      [35000, .25, 2660], [55000, .3, 4410], [80000, .35, 7160], [Infinity, .45, 15160]];
    const [, rate, deduction] = brackets.find(([limit]) => bonus / 12 <= limit);
    return Math.max(0, bonus * rate - deduction);
  }

  function taxForYear({ salary, bonus, allowance, signOn, contributions, specialDeduction, mode }) {
    const taxable = salary + allowance + signOn - 60000 - contributions - specialDeduction;
    const combined = progressiveTax(taxable + bonus);
    const separate = progressiveTax(taxable) + separateBonusTax(bonus);
    const selected = mode === "auto" ? separate < combined ? "separate" : "combined" : mode;
    return { tax: selected === "separate" ? separate : combined, selected };
  }

  // Standard full-year payroll: cumulative withholding, no monthly refunds
  function monthlyPayroll(state, contributions, mode) {
    const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
    const allocate = (total, month) => round(total * month / 12) - round(total * (month - 1) / 12);
    const salary = number(state, "monthlySalary"), salaryMonths = number(state, "salaryMonths");
    const ordinarySalary = salary * Math.min(salaryMonths, 12);
    const extraSalary = round(salary * Math.max(0, salaryMonths - 12));
    const bonus = round(bonusAmount(state));
    const bonusMonth = number(state, "bonusPayMonth", 12), extraMonth = number(state, "extraSalaryPayMonth", 12);
    let cumulativeIncome = 0, cumulativeContributions = 0, cumulativeSalaryTax = 0, cumulativeBonusTax = 0, cumulativeGross = 0;
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const wages = round(allocate(ordinarySalary, month) + (month === extraMonth ? extraSalary : 0));
      const allowance = allocate(number(state, "annualAllowance"), month);
      const paidBonus = month === bonusMonth ? bonus : 0;
      const contribution = round(contributions.monthly);
      const gross = round(wages + allowance + paidBonus);
      cumulativeGross = round(cumulativeGross + gross);
      cumulativeIncome = round(cumulativeIncome + wages + allowance + (mode === "combined" ? paidBonus : 0));
      cumulativeContributions = round(cumulativeContributions + contribution);
      const basicDeduction = 5000 * month;
      const specialDeduction = round(number(state, "specialDeduction") * month / 12);
      const taxable = Math.max(0, round(cumulativeIncome - cumulativeContributions - basicDeduction - specialDeduction));
      const [, rate, quickDeduction] = bracketFor(taxable);
      const salaryTaxDue = round(progressiveTax(taxable));
      const salaryTax = Math.max(0, round(salaryTaxDue - cumulativeSalaryTax));
      const bonusTax = mode === "separate" ? round(separateBonusTax(paidBonus)) : 0;
      cumulativeSalaryTax = round(cumulativeSalaryTax + salaryTax);
      cumulativeBonusTax = round(cumulativeBonusTax + bonusTax);
      const tax = round(salaryTax + bonusTax);
      return { month, wages, allowance, bonus: paidBonus, gross, contributions: contribution,
        salaryTax, bonusTax, tax, net: round(gross - contribution - tax),
        cumulativeIncome, cumulativeGross, cumulativeContributions, basicDeduction, specialDeduction,
        taxable, rate, quickDeduction, salaryTaxDue, cumulativeSalaryTax, cumulativeBonusTax,
        cumulativeTax: round(cumulativeSalaryTax + cumulativeBonusTax) };
    });
    const totalTax = months[11].cumulativeTax;
    const annual = taxForYear({ salary: round(salary * salaryMonths), bonus,
      allowance: round(number(state, "annualAllowance")), signOn: 0,
      contributions: cumulativeContributions, specialDeduction: round(number(state, "specialDeduction")), mode });
    return { months, mode, bonusMonth, extraMonth, extraSalary, totalTax,
      annualTax: round(annual.tax), refund: Math.max(0, round(totalTax - annual.tax)),
      totalNet: round(months.reduce((total, month) => total + month.net, 0)),
      totalGross: cumulativeGross, totalContributions: cumulativeContributions };
  }

  function calculate(input) {
    const state = migrateState(input);
    const errors = validate(state);
    const monthly = number(state, "monthlySalary"), salaryMonths = number(state, "salaryMonths");
    const bonus = bonusAmount(state), allowance = number(state, "annualAllowance");
    const firstMonths = clamp(number(state, "firstYearMonths"), 0, 12);
    const units = number(state, "equityUnits"), strike = number(state, "strikePrice");
    const vestMonths = Math.max(number(state, "vestingYears"), .25) * 12;
    const cliff = clamp(number(state, "cliffMonths"), 0, vestMonths);
    const equityReady = units > 0 && hasValue(state.shareBase);
    const intrinsic = units * Math.max(number(state, "shareBase") - strike, 0);
    const contributions = effectiveContributions(state);
    const incomeErrors = errors.some(({ field }) => ["monthlySalary", "salaryMonths", "bonusMonths", "annualBonus", "annualAllowance"].includes(field));
    const netReady = monthly > 0 && contributions.ready && errors.length === 0;
    const vestFraction = months => months < cliff ? 0 : clamp(months / vestMonths, 0, 1);
    function yearDetails(index, bonusOverride = bonus) {
      const months = index === 0 ? firstMonths : 12;
      const shortfall = index === 0 ? (1 - number(state, "probationRate") / 100) * Math.min(number(state, "probationMonths"), months) : 0;
      const salary = monthly * Math.max(0, salaryMonths * months / 12 - shortfall);
      const yearBonus = bonusOverride * months / 12, yearAllowance = allowance * months / 12;
      const signOn = index < 2 ? number(state, index === 0 ? "signOnYear1" : "signOnYear2") : 0;
      const contribution = netReady ? contributions.monthly * months : null;
      const taxResult = netReady ? taxForYear({ salary, bonus: yearBonus, allowance: yearAllowance, signOn,
        contributions: contribution, specialDeduction: number(state, "specialDeduction"), mode: state.bonusTaxMode }) : null;
      const start = index === 0 ? 0 : firstMonths + (index - 1) * 12;
      const fraction = Math.max(0, vestFraction(firstMonths + index * 12) - vestFraction(start));
      const equity = equityReady ? intrinsic * fraction : null;
      const cash = salary + yearBonus + yearAllowance + signOn;
      return { salary, bonus: yearBonus, allowance: yearAllowance, signOn, recurringCash: cash - signOn,
        cash, contributions: contribution, tax: taxResult?.tax ?? null, taxMode: taxResult?.selected ?? null,
        net: taxResult ? cash - contribution - taxResult.tax - (index === 0 ? number(state, "signOnReserve") : 0) : null,
        vestedUnits: units * fraction, equity, total: cash + (equity || 0) };
    }
    const years = Array.from({ length: 4 }, (_, index) => yearDetails(index));
    const steady = yearDetails(2), recurring = yearDetails(2, 0);
    const annualEquity = equityReady ? intrinsic / (vestMonths / 12) : null;
    const annualPackage = steady.recurringCash + (annualEquity || 0);
    const isExample = Object.keys(DEFAULTS).every(key => {
      const value = state[key], expected = EXAMPLE[key];
      if (typeof expected === "boolean") return value === expected;
      if (["bonusMode", "bonusTaxMode"].includes(key)) return value === expected;
      return expected === "" ? !hasValue(value) : hasValue(value) && Number(value) === expected;
    });
    return { state, errors, contributions, bonus, netReady, equityReady, annualEquity,
      monthly, salaryMonths, annualSalary: monthly * salaryMonths, annualAllowance: allowance,
      hasIncome: monthly > 0 || bonus > 0 || allowance > 0 || units > 0,
      grossReady: !incomeErrors, isExample, steady, years, annualPackage,
      payroll: netReady ? monthlyPayroll(state, contributions, steady.taxMode) : null,
      monthlyNet: netReady ? recurring.net / 12 : null,
      monthlyWithBonus: netReady ? steady.net / 12 : null,
      exerciseCost: years[0].vestedUnits * strike,
      cashShare: annualPackage > 0 ? steady.recurringCash / annualPackage : 0,
      equityShare: annualPackage > 0 ? (annualEquity || 0) / annualPackage : 0,
      scenarios: units > 0 && ["shareLow", "shareBase", "shareHigh"].every(key => hasValue(state[key]))
        ? ["shareLow", "shareBase", "shareHigh"].map((key, index) => ({
          label: ["低位", "基准", "高位"][index], price: number(state, key),
          total: steady.recurringCash + units * Math.max(number(state, key) - strike, 0) / (vestMonths / 12)
        })) : [] };
  }

  return { DEFAULTS, EXAMPLE, migrateState, bonusAmount, switchBonusMode, calculate, progressiveTax, taxForYear };
});
