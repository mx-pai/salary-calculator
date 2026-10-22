(function (root) {
  "use strict";
  function render(report, { palette: p, fontFamily }) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    const width = 960, margin = 36, left = 84, right = 876, content = right - left;
    const font = (size, weight = 400) => { ctx.font = `${weight} ${size}px ${fontFamily}`; };
    const wrap = (value, size, maxWidth) => {
      font(size);
      const lines = []; let line = "";
      for (const char of value) {
        if (ctx.measureText(line + char).width > maxWidth && line) { lines.push(line); line = char; }
        else line += char;
      }
      if (line) lines.push(line);
      return lines;
    };
    const notes = report.notes.flatMap(note => wrap(note, 16, content));
    const rows = report.rows.length;
    const gridTop = 522, gridHeight = Math.ceil(rows / 2) * 92;
    const deductionTop = gridTop + gridHeight + 15;
    const firstYearTop = deductionTop + 110;
    const footerTop = firstYearTop + 100;
    const height = footerTop + notes.length * 25 + 100;
    canvas.width = width * 2; canvas.height = height * 2; ctx.scale(2, 2);
    const box = (x, y, w, h, color, radius = 0) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
    };
    const text = (value, x, y, size = 20, color = p.ink, weight = 400, align = "left") => {
      font(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillText(value, x, y);
    };
    const fittedText = (value, x, y, size, maxWidth, color, weight = 600) => {
      font(size, weight);
      while (ctx.measureText(value).width > maxWidth && size > 18) font(--size, weight);
      text(value, x, y, size, color, weight);
    };
    const rule = y => box(left, y, content, 1.5, p.line);
    // The export is composed independently for sharing, using the same report as the page
    box(0, 0, width, height, p.page);
    box(margin, margin, width - margin * 2, height - margin * 2, p.paper, 28);
    ctx.save(); ctx.beginPath(); ctx.roundRect(margin, margin, width - margin * 2, height - margin * 2, 28); ctx.clip();
    box(margin, margin, width - margin * 2, 412, p.green);
    // A small stack of pay components is the calculator's own mark
    ctx.strokeStyle = p.cash; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let i = 0; i < 3; i++) {
      const y = 79 + i * 8; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + 13, y + 7); ctx.lineTo(left + 26, y); ctx.stroke();
    }
    text("薪资计算器", left + 44, 103, 23, p.greenInk, 600);
    text(report.tag, right, 102, 17, p.greenSoft, 400, "right");
    text(report.headline.label, left, 171, 21, p.greenSoft);
    fittedText(report.headline.value, left - 4, 269, report.headline.pending ? 48 : 94, content, p.greenInk);
    if (report.headline.secondary) text(report.headline.secondary, left, 312, 21, p.cash, 600);
    text(report.headline.caption, left, report.headline.secondary ? 341 : 314, 16, p.greenSoft);
    box(left, 367, content, 1.5, p.greenBorder);
    report.kpis.forEach((item, index) => {
      const x = left + index * 416;
      text(item.label, x, 398, 16, p.greenSoft);
      fittedText(item.value, x, 434, 32, 355, p.greenInk);
    });
    text("全年收入构成", left, 492, 22, p.ink, 600);
    text("税前", right, 492, 16, p.muted, 400, "right");
    const cashWidth = content * report.mix.cash, equityWidth = content * report.mix.equity;
    box(left, 508, content, 8, p.line, 3);
    if (cashWidth > 0) box(left, 508, cashWidth, 8, p.cash, 3);
    if (equityWidth > 0) box(left + cashWidth + 3, 508, Math.max(0, equityWidth - 3), 8, p.equity, 3);
    report.rows.forEach((item, index) => {
      const x = left + (index % 2) * 416, y = gridTop + Math.floor(index / 2) * 92;
      const label = `${item.label}${item.detail ? ` · ${item.detail}` : ""}`;
      box(x, y + 20, 8, 8, item.key === "equity" ? p.equity : p.cash, 2);
      text(label, x + 18, y + 32, 17, p.muted);
      fittedText(item.value, x, y + 69, 31, 355, p.ink, 600);
    });
    rule(deductionTop);
    report.deductions.forEach((item, index) => {
      const x = left + index * 416;
      text(item.label, x, deductionTop + 35, 17, p.muted);
      text(item.value, x, deductionTop + 73, 29, p.ink, 600);
    });
    box(left - 20, firstYearTop, content + 40, 79, p.page, 12);
    report.firstYear.forEach((item, index) => {
      const y = firstYearTop + 29 + index * 29;
      text(item.label, left, y, 17, p.muted);
      text(item.value, right, y, 19, p.ink, 600, "right");
    });
    notes.forEach((note, index) => text(note, left, footerTop + 22 + index * 25, 16, p.muted));
    text("mx-pai.cn/salary-calculator", left, height - 70, 16, p.cash, 600);
    text("薪酬估算", right, height - 70, 16, p.muted, 400, "right");
    ctx.restore();
    return canvas;
  }
  root.SalaryImage = { render };
})(typeof globalThis === "object" ? globalThis : this);
